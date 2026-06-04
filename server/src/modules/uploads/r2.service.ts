/**
 * 服务：R2Service
 * 用途：封装 Cloudflare R2（S3 兼容 API）的连接、预签名 PUT 地址生成、key 生成与可访问 URL 拼接。
 * 红线：
 *  - 文件实体只存 R2，绝不落服务器本地磁盘；本服务不接收文件二进制，只负责签名授权。
 *  - R2 密钥仅来自环境变量（ConfigService），不入库、不硬编码。
 *  - R2 未配置时抛清晰错误（503），不使用任何本地存储兜底。
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
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { FileKind } from '@prisma/client';
import { extractExtension } from './upload.constants';
import { ObjectStorageService } from './object-storage.interface';

// 结构化的 R2 配置（来自 configuration() 的 r2 段）
interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  endpoint: string;
  forcePathStyle: boolean;
  publicBase: string;
  presignExpires: number;
}

@Injectable()
export class R2Service implements ObjectStorageService {
  private readonly logger = new Logger(R2Service.name);
  private client?: S3Client; // 懒加载，未配置时不创建

  constructor(private readonly config: ConfigService) {}

  // 读取 R2 配置
  private get r2(): R2Config {
    return this.config.get<R2Config>('r2') as R2Config;
  }

  // 解析 S3 端点：优先用显式 endpoint；仅在 Cloudflare R2 下由 accountId 推导默认端点
  private resolveEndpoint(r2: R2Config): string {
    if (r2.endpoint) return r2.endpoint;
    if (r2.accountId) return `https://${r2.accountId}.r2.cloudflarestorage.com`;
    return '';
  }

  /**
   * 校验 R2 是否已配置；缺失关键项时抛 503，不做本地兜底。
   * 必需：accessKeyId、secretAccessKey、bucket、publicBase，以及 endpoint 或 accountId 之一。
   */
  private ensureConfigured(): { endpoint: string; r2: R2Config } {
    const r2 = this.r2;
    const endpoint = this.resolveEndpoint(r2);
    const missing: string[] = [];
    if (!r2.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!r2.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!r2.bucket) missing.push('R2_BUCKET');
    if (!r2.publicBase) missing.push('R2_PUBLIC_BASE');
    if (!endpoint) missing.push('R2_ENDPOINT 或 R2_ACCOUNT_ID');
    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `R2 对象存储未配置（缺少：${missing.join('、')}），请在服务器环境变量中配置后重试`,
      );
    }
    return { endpoint, r2 };
  }

  // 获取（或惰性创建）S3 客户端
  private getClient(): S3Client {
    if (this.client) return this.client;
    const { endpoint, r2 } = this.ensureConfigured();
    this.client = new S3Client({
      // region/forcePathStyle 走环境变量，兼容 Cloudflare R2 与阿里云 OSS 等 S3 兼容对象存储
      region: r2.region || 'auto',
      endpoint,
      forcePathStyle: r2.forcePathStyle,
      // 对非 AWS 的 S3 兼容对象存储，仅在请求明确要求时才计算 checksum，
      // 避免预签名 PUT URL 自动附带 CRC32 参数导致阿里 OSS 等服务拒绝请求。
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
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

  // 拼接可访问 URL（R2 公共域 / 绑定的 Cloudflare 自定义域）
  publicUrl(key: string): string {
    const base = this.r2.publicBase.replace(/\/+$/, '');
    return `${base}/${key}`;
  }

  // 预签名有效期（秒）
  get presignExpires(): number {
    return this.r2.presignExpires || 600;
  }

  /**
   * 生成预签名 PUT 上传地址（前端用此地址直传 R2，文件不经过本服务）。
   * 签名带 ContentType，前端直传时须带相同 Content-Type 头。
   */
  async presignPut(key: string, mime: string): Promise<string> {
    this.ensureConfigured();
    const command = new PutObjectCommand({
      Bucket: this.r2.bucket,
      Key: key,
      ContentType: mime,
    });
    return getSignedUrl(this.getClient(), command, {
      expiresIn: this.presignExpires,
    });
  }

  /**
   * 查询对象元信息（2G：callback 登记前必须成功）。
   * - 对象不存在 → 404 NotFoundException
   * - 大小无效 / 其它错误 → 400 BadRequestException
   * - R2 未配置 → 503 ServiceUnavailableException（无本地兜底）
   */
  async headObject(key: string): Promise<{ size: number; mime: string }> {
    this.ensureConfigured();
    try {
      const res = await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.r2.bucket, Key: key }),
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
}
