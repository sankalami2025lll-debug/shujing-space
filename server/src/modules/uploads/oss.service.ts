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
import OSS = require('ali-oss');
import { FileKind } from '@prisma/client';
import { extractExtension } from './upload.constants';
import { ObjectStorageService } from './object-storage.interface';

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
    });
    return this.client;
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
}
