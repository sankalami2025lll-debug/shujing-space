/**
 * 服务：OssService
 * 用途：封装阿里云 OSS 的连接、PUT 预签名上传地址生成、对象信息校验与访问 URL 拼接。
 * 红线：
 *  - 文件只允许前端直传 OSS，不落服务器本地磁盘。
 *  - OSS 未完整配置时返回 503，不做本地兜底。
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import OSS from 'ali-oss';
import { FileKind } from '@prisma/client';
import { extractExtension } from './upload.constants';
import {
  ObjectStorageService,
  ObjectHeadResult,
  PutObjectResult,
  MultipartInitResult,
  MultipartPartDescriptor,
} from './object-storage.interface';

const LARGE_FILE_THRESHOLD_BYTES = 32 * 1024 * 1024;
const DEFAULT_PART_SIZE_BYTES = 16 * 1024 * 1024;
const DEFAULT_MULTIPART_CONCURRENCY = 2;

interface OssConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint: string;
  publicBase: string;
  presignExpires: number;
}

type HeaderMap = Record<string, string | string[] | undefined>;

interface OssHeadLike {
  headers?: HeaderMap;
  meta?: Record<string, string | undefined> | null;
  res?: {
    headers?: HeaderMap;
  };
}

interface OssMultipartClient extends OSS {
  initMultipartUpload(
    name: string,
    options?: Record<string, unknown>,
  ): Promise<{ uploadId: string }>;
  signatureUrlV4(
    method: string,
    expires: number,
    request?: {
      headers?: Record<string, string>;
      queries?: Record<string, string | number>;
    },
    objectName?: string,
    additionalHeaders?: string[],
  ): Promise<string>;
  completeMultipartUpload(
    name: string,
    uploadId: string,
    parts: Array<{ number: number; etag: string }>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  abortMultipartUpload(
    name: string,
    uploadId: string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

@Injectable()
export class OssService implements ObjectStorageService {
  private readonly logger = new Logger(OssService.name);
  private client?: OSS;

  constructor(private readonly config: ConfigService) {}

  private get oss(): OssConfig {
    return this.config.get<OssConfig>('oss') as OssConfig;
  }

  private ensureConfigured(): OssConfig {
    const oss = this.oss;
    const missing: string[] = [];
    if (!oss.accessKeyId) missing.push('OSS_ACCESS_KEY_ID');
    if (!oss.accessKeySecret) missing.push('OSS_ACCESS_KEY_SECRET');
    if (!oss.bucket) missing.push('OSS_BUCKET');
    if (!oss.region) missing.push('OSS_REGION');
    if (!oss.endpoint) missing.push('OSS_ENDPOINT');
    if (!oss.publicBase) missing.push('OSS_PUBLIC_BASE');
    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `OSS 对象存储未配置（缺少：${missing.join('、')}），请在服务器环境变量中配置后重试`,
      );
    }
    return oss;
  }

  private getClient(): OSS {
    if (this.client) return this.client;
    const oss = this.ensureConfigured();
    this.client = new OSS({
      region: oss.region,
      endpoint: oss.endpoint,
      accessKeyId: oss.accessKeyId,
      accessKeySecret: oss.accessKeySecret,
      bucket: oss.bucket,
      secure: true,
      timeout: 5 * 60 * 1000,
    } as any);
    return this.client;
  }

  private getMultipartClient(): OssMultipartClient {
    return this.getClient() as OssMultipartClient;
  }

  buildKey(kind: FileKind, userId: bigint, originalName: string): string {
    void kind;
    const ext = extractExtension(originalName);
    const suffix = ext ? `.${ext}` : '';
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `uploads/${userId.toString()}/${yyyy}/${mm}/${randomUUID()}${suffix}`;
  }

  publicUrl(key: string): string {
    const base = this.oss.publicBase.replace(/\/+$/, '');
    return `${base}/${key}`;
  }

  get presignExpires(): number {
    return this.oss.presignExpires || 900;
  }

  async presignPut(key: string, mime: string): Promise<string> {
    this.ensureConfigured();
    return this.getClient().signatureUrl(key, {
      method: 'PUT',
      expires: this.presignExpires,
      'Content-Type': mime,
    });
  }

  async initiateMultipartUpload(
    key: string,
    mime: string,
  ): Promise<MultipartInitResult> {
    this.ensureConfigured();
    try {
      const result = await this.getMultipartClient().initMultipartUpload(key, {
        mime,
      });
      if (!result.uploadId) {
        throw new BadRequestException('对象存储未返回 uploadId');
      }
      return { uploadId: result.uploadId };
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`OSS initMultipartUpload failed for key=${key}`, err);
      throw new BadRequestException('无法初始化 multipart 上传，请稍后重试');
    }
  }

  async presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<string> {
    this.ensureConfigured();
    try {
      return this.getClient().signatureUrl(key, {
        method: 'PUT',
        expires: this.presignExpires,
        subResource: {
          partNumber,
          uploadId,
        },
      } as Record<string, unknown> as Record<string, string | number | boolean | undefined>);
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(
        `OSS presignUploadPart failed for key=${key} part=${partNumber}`,
        err,
      );
      throw new BadRequestException('无法生成 multipart 分片上传地址，请稍后重试');
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPartDescriptor[],
  ): Promise<void> {
    this.ensureConfigured();
    try {
      await this.getMultipartClient().completeMultipartUpload(
        key,
        uploadId,
        parts.map((part) => ({
          number: part.partNumber,
          etag: part.etag,
        })),
      );
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`OSS completeMultipartUpload failed for key=${key}`, err);
      throw new BadRequestException('无法完成 multipart 上传，请稍后重试');
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.ensureConfigured();
    try {
      await this.getMultipartClient().abortMultipartUpload(key, uploadId);
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`OSS abortMultipartUpload failed for key=${key}`, err);
      throw new BadRequestException('无法中止 multipart 上传，请稍后重试');
    }
  }

  async headObject(key: string): Promise<{ size: number; mime: string }> {
    this.ensureConfigured();
    try {
      const client = this.getClient();
      // MIME 用 HeadObject 读取更稳定；大小优先以 ObjectMeta 为准，避免 gzip 影响长度判断。
      const [headRes, metaRes] = await Promise.all([client.head(key), client.getObjectMeta(key)]);
      const headHeaders = this.extractHeaders(headRes);
      const metaHeaders = this.extractHeaders(metaRes);
      const size = Number(
        this.pickHeader(metaHeaders, 'content-length') ??
          this.pickHeader(headHeaders, 'content-length') ??
          0,
      );
      if (!Number.isFinite(size) || size <= 0) {
        throw new BadRequestException('对象存储中的文件大小无效');
      }
      const mime = this.extractMime(headRes, metaRes);
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
      const meta = err as { code?: string; status?: number; message?: string };
      if (meta.code === 'NoSuchKey' || meta.status === 404) {
        throw new NotFoundException('对象存储中未找到该文件，请先完成上传');
      }
      this.logger.warn(`OSS HeadObject failed for key=${key}`, err);
      throw new BadRequestException('无法确认对象存储中的文件，请稍后重试');
    }
  }

  async downloadObject(key: string): Promise<Buffer> {
    this.ensureConfigured();
    try {
      const res = await this.getClient().get(key);
      const content = res.content;
      if (!content) {
        throw new NotFoundException('对象存储中未找到该文件，请先完成上传');
      }
      return Buffer.isBuffer(content) ? content : Buffer.from(content);
    } catch (err: unknown) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      const meta = err as { code?: string; status?: number };
      if (meta.code === 'NoSuchKey' || meta.status === 404) {
        throw new NotFoundException('对象存储中未找到该文件，请先完成上传');
      }
      this.logger.warn(`OSS GetObject failed for key=${key}`, err);
      throw new BadRequestException('无法下载对象存储中的文件，请稍后重试');
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<PutObjectResult> {
    this.ensureConfigured();
    try {
      await this.getClient().put(key, body, {
        timeout: 10 * 60 * 1000,
        headers: {
          'Content-Type': contentType,
        },
      } as never);
      return { key, url: this.publicUrl(key) };
    } catch (err: unknown) {
      const meta = err as { code?: string; status?: number; requestId?: string; message?: string };
      this.logger.warn(
        `OSS PutObject failed | key=${key} code=${meta.code ?? 'unknown'} status=${meta.status ?? 0} requestId=${meta.requestId ?? 'N/A'} message=${meta.message ?? ''}`,
      );
      const detail =
        meta.message
          ? meta.message.replace(/^.*?(code|message)[=:]\s*/i, '').slice(0, 200)
          : '请稍后重试';
      throw new BadRequestException(
        `processed 文件上传 OSS 失败：${detail}`,
      );
    }
  }

  private extractMime(...sources: OssHeadLike[]): string {
    const mime =
      sources
        .map((source) => this.extractHeaders(source))
        .map(
          (headers) =>
            this.pickHeader(headers, 'content-type') ??
            this.pickHeader(headers, 'x-oss-meta-content-type'),
        )
        .find(Boolean) ??
      sources
        .map((source) => this.extractMeta(source))
        .map(
          (meta) =>
            this.pickMeta(meta, 'content-type') ??
            this.pickMeta(meta, 'Content-Type') ??
            this.pickMeta(meta, 'mime'),
        )
        .find(Boolean) ??
      '';

    return String(mime).split(';')[0]?.trim();
  }

  private extractHeaders(source: OssHeadLike | undefined): HeaderMap {
    return {
      ...(source?.headers ?? {}),
      ...(source?.res?.headers ?? {}),
    };
  }

  private extractMeta(source: OssHeadLike | undefined): Record<string, string | undefined> {
    return source?.meta ?? {};
  }

  private pickHeader(headers: HeaderMap, key: string): string | undefined {
    for (const [headerKey, value] of Object.entries(headers)) {
      if (headerKey.toLowerCase() !== key.toLowerCase()) continue;
      return Array.isArray(value) ? value[0] : value;
    }
    return undefined;
  }

  private pickMeta(
    meta: Record<string, string | undefined>,
    key: string,
  ): string | undefined {
    for (const [metaKey, value] of Object.entries(meta)) {
      if (metaKey.toLowerCase() !== key.toLowerCase()) continue;
      return value;
    }
    return undefined;
  }

  async putObjectMultipart(
    key: string,
    body: Buffer,
    contentType: string,
    concurrency = DEFAULT_MULTIPART_CONCURRENCY,
    partSize = DEFAULT_PART_SIZE_BYTES,
  ): Promise<PutObjectResult> {
    this.ensureConfigured();
    const fileSize = body.byteLength;

    if (fileSize < LARGE_FILE_THRESHOLD_BYTES) {
      return await this.putObject(key, body, contentType);
    }

    const startAt = Date.now();
    try {
      const result = await (this.getClient() as unknown as {
        multipartUpload(key: string, body: Buffer, options: Record<string, unknown>): Promise<{ uploadId?: string }>;
      }).multipartUpload(key, body, {
        partSize,
        parallel: concurrency,
        timeout: 10 * 60 * 1000,
        headers: { 'Content-Type': contentType },
      } as never);
      const durationMs = Date.now() - startAt;
      this.logger.log(
        `[OSS] multipartUpload | key=${key} size=${fileSize} durationMs=${durationMs} partSize=${partSize} parallel=${concurrency} uploadId=${typeof result === 'object' && result && 'uploadId' in result ? (result as { uploadId: string }).uploadId : 'N/A'}`,
      );
      return { key, url: this.publicUrl(key) };
    } catch (err: unknown) {
      const durationMs = Date.now() - startAt;
      const meta = err as { code?: string; status?: number; requestId?: string; message?: string };
      this.logger.warn(
        `[OSS] multipartUpload failed | key=${key} size=${fileSize} durationMs=${durationMs} code=${meta.code ?? 'unknown'} status=${meta.status ?? 0} requestId=${meta.requestId ?? 'N/A'} message=${meta.message ?? ''}`,
      );
      const detail =
        meta.message
          ? meta.message.replace(/^.*?(code|message)[=:]\s*/i, '').slice(0, 200)
          : '请稍后重试';
      throw new BadRequestException(
        `processed 文件上传 OSS 失败：${detail}`,
      );
    }
  }
}
