/**
 * 服务：OssCompatibleService
 * 用途：封装 OSS 兼容对象存储（S3 兼容 API）的连接、预签名 PUT 地址生成、key 生成与可访问 URL 拼接。
 * 红线：
 *  - 文件实体只存对象存储，绝不落服务器本地磁盘；本服务不接收文件二进制，只负责签名授权。
 *  - 密钥仅来自环境变量（ConfigService），不入库、不硬编码。
 *  - OSS 兼容对象存储未配置时抛清晰错误（503），不使用任何本地存储兜底。
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { FileKind } from '@prisma/client';
import { extractExtension } from './upload.constants';
import {
  MultipartInitResult,
  MultipartPartDescriptor,
  ObjectStorageService,
  PutObjectResult,
} from './object-storage.interface';

// 结构化的 OSS 兼容对象存储配置（来自 configuration() 的 oss 段）
interface OssCompatibleConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint: string;
  forcePathStyle: boolean;
  publicBase: string;
  presignExpires: number;
}

@Injectable()
export class OssCompatibleService implements ObjectStorageService {
  private readonly logger = new Logger(OssCompatibleService.name);
  private client?: S3Client; // 懒加载，未配置时不创建

  constructor(private readonly config: ConfigService) {}

  // 读取 OSS 兼容对象存储配置
  private get oss(): OssCompatibleConfig {
    return this.config.get<OssCompatibleConfig>('oss') as OssCompatibleConfig;
  }

  // 解析 S3 兼容端点：当前统一使用显式 OSS endpoint。
  private resolveEndpoint(oss: OssCompatibleConfig): string {
    if (oss.endpoint) return oss.endpoint;
    return '';
  }

  /**
   * 校验 OSS 兼容对象存储是否已配置；缺失关键项时抛 503，不做本地兜底。
   * 必需：accessKeyId、accessKeySecret、bucket、region、publicBase、endpoint。
   */
  private ensureConfigured(): { endpoint: string; oss: OssCompatibleConfig } {
    const oss = this.oss;
    const endpoint = this.resolveEndpoint(oss);
    const missing: string[] = [];
    if (!oss.accessKeyId) missing.push('OSS_ACCESS_KEY_ID');
    if (!oss.accessKeySecret) missing.push('OSS_ACCESS_KEY_SECRET');
    if (!oss.bucket) missing.push('OSS_BUCKET');
    if (!oss.region) missing.push('OSS_REGION');
    if (!oss.publicBase) missing.push('OSS_PUBLIC_BASE');
    if (!endpoint) missing.push('OSS_ENDPOINT');
    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `OSS 兼容对象存储未配置（缺少：${missing.join('、')}），请在服务器环境变量中配置后重试`,
      );
    }
    return { endpoint, oss };
  }

  // 获取（或惰性创建）S3 客户端
  private getClient(): S3Client {
    if (this.client) return this.client;
    const { endpoint, oss } = this.ensureConfigured();
    this.client = new S3Client({
      // region/forcePathStyle 走环境变量，兼容阿里云 OSS 与其他 S3 兼容对象存储
      region: oss.region || 'auto',
      endpoint,
      forcePathStyle: oss.forcePathStyle,
      // 对非 AWS 的 S3 兼容对象存储，仅在请求明确要求时才计算 checksum，
      // 避免预签名 PUT URL 自动附带 CRC32 参数导致阿里 OSS 等服务拒绝请求。
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: oss.accessKeyId,
        secretAccessKey: oss.accessKeySecret,
      },
      requestHandler: {
        requestTimeout: 300_000,
      },
    });
    return this.client;
  }

  // 生成安全的对象 key：uploads/{userId}/{yyyy}/{MM}/{uuid}.{ext}，避免使用前端原始文件名。
  buildKey(kind: FileKind, userId: bigint, originalName: string): string {
    void kind;
    const ext = extractExtension(originalName);
    const suffix = ext ? `.${ext}` : '';
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `uploads/${userId.toString()}/${yyyy}/${mm}/${randomUUID()}${suffix}`;
  }

  // 拼接可访问 URL（OSS 公共域 / 自定义域）
  publicUrl(key: string): string {
    const base = this.oss.publicBase.replace(/\/+$/, '');
    return `${base}/${key}`;
  }

  // 预签名有效期（秒）
  get presignExpires(): number {
    return this.oss.presignExpires || 600;
  }

  /**
   * 生成预签名 PUT 上传地址（前端用此地址直传 OSS 兼容对象存储，文件不经过本服务）。
   * 签名带 ContentType，前端直传时须带相同 Content-Type 头。
   */
  async presignPut(key: string, mime: string): Promise<string> {
    this.ensureConfigured();
    const command = new PutObjectCommand({
      Bucket: this.oss.bucket,
      Key: key,
      ContentType: mime,
    });
    return getSignedUrl(this.getClient(), command, {
      expiresIn: this.presignExpires,
    });
  }

  async initiateMultipartUpload(
    key: string,
    mime: string,
  ): Promise<MultipartInitResult> {
    this.ensureConfigured();
    try {
      const result = await this.getClient().send(
        new CreateMultipartUploadCommand({
          Bucket: this.oss.bucket,
          Key: key,
          ContentType: mime,
        }),
      );
      if (!result.UploadId) {
        throw new BadRequestException('对象存储未返回 uploadId');
      }
      return { uploadId: result.UploadId };
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`CreateMultipartUpload failed for key=${key}`, err);
      throw new BadRequestException('无法初始化 multipart 上传，请稍后重试');
    }
  }

  async presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string> {
    this.ensureConfigured();
    const command = new UploadPartCommand({
      Bucket: this.oss.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.getClient(), command, {
      expiresIn: this.presignExpires,
    });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPartDescriptor[],
  ): Promise<void> {
    this.ensureConfigured();
    try {
      await this.getClient().send(
        new CompleteMultipartUploadCommand({
          Bucket: this.oss.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((part) => ({
              PartNumber: part.partNumber,
              ETag: part.etag,
            })),
          },
        }),
      );
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`CompleteMultipartUpload failed for key=${key}`, err);
      throw new BadRequestException('无法完成 multipart 上传，请稍后重试');
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.ensureConfigured();
    try {
      await this.getClient().send(
        new AbortMultipartUploadCommand({
          Bucket: this.oss.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`AbortMultipartUpload failed for key=${key}`, err);
      throw new BadRequestException('无法中止 multipart 上传，请稍后重试');
    }
  }

  /**
   * 查询对象元信息（2G：callback 登记前必须成功）。
   * - 对象不存在 → 404 NotFoundException
   * - 大小无效 / 其它错误 → 400 BadRequestException
   * - OSS 兼容对象存储未配置 → 503 ServiceUnavailableException（无本地兜底）
   */
  async headObject(key: string): Promise<{ size: number; mime: string }> {
    this.ensureConfigured();
    try {
      const res = await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.oss.bucket, Key: key }),
      );
      const size = Number(res.ContentLength ?? 0);
      if (!Number.isFinite(size) || size <= 0) {
        throw new BadRequestException('对象存储中的文件大小无效');
      }
      const mime = (res.ContentType ?? '').split(';')[0]?.trim() ?? '';
      if (!mime) {
        throw new BadRequestException('对象存储中的文件类型无法识别');
      }
      return { size, mime };
    } catch (err: unknown) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      const meta = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (meta.name === 'NotFound' || meta.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException('对象存储中未找到该文件，请先完成上传');
      }
      this.logger.warn(`HeadObject failed for key=${key}`, err);
      throw new BadRequestException('无法确认对象存储中的文件，请稍后重试');
    }
  }

  async downloadObject(key: string): Promise<Buffer> {
    this.ensureConfigured();
    try {
      const res = await this.getClient().send(
        new GetObjectCommand({ Bucket: this.oss.bucket, Key: key }),
      );
      const body = res.Body;
      if (!body) {
        throw new NotFoundException('对象存储中未找到该文件，请先完成上传');
      }
      return await this.readBodyToBuffer(body);
    } catch (err: unknown) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      const meta = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (meta.name === 'NoSuchKey' || meta.name === 'NotFound' || meta.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException('对象存储中未找到该文件，请先完成上传');
      }
      this.logger.warn(`GetObject failed for key=${key}`, err);
      throw new BadRequestException('无法下载对象存储中的文件，请稍后重试');
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<PutObjectResult> {
    this.ensureConfigured();
    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: this.oss.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key, url: this.publicUrl(key) };
    } catch (err: unknown) {
      const meta = err as { name?: string; $metadata?: { httpStatusCode?: number; requestId?: string }; message?: string };
      this.logger.warn(
        `S3 PutObject failed | key=${key} name=${meta.name ?? 'unknown'} status=${meta.$metadata?.httpStatusCode ?? 0} requestId=${meta.$metadata?.requestId ?? 'N/A'} message=${meta.message ?? ''}`,
      );
      const detail =
        meta.message
          ? meta.message.replace(/^.*?(name|message)[=:]\s*/i, '').slice(0, 200)
          : '请稍后重试';
      throw new BadRequestException(
        `processed 文件上传 OSS 失败：${detail}`,
      );
    }
  }

  private async readBodyToBuffer(
    body:
      | Readable
      | ReadableStream<Uint8Array>
      | Blob
      | { transformToByteArray?: () => Promise<Uint8Array> },
  ): Promise<Buffer> {
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return Buffer.from(await body.arrayBuffer());
    }
    if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
      const bytes = await (
        body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      return Buffer.from(bytes);
    }
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    if (typeof (body as ReadableStream<Uint8Array>)?.getReader === 'function') {
      const reader = (body as ReadableStream<Uint8Array>).getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    }
    throw new BadRequestException('对象存储返回了无法读取的文件流');
  }
}
