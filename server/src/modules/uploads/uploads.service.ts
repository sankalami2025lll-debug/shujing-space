/**
 * 服务：UploadsService
 * 用途：模型/封面/视频文件的「预签名直传授权」与「上传完成登记」业务。
 * 流程：presign（授权）→ 前端直传对象存储 → callback（HeadObject 确认对象存在后登记 model_files）。
 * 红线：文件实体只存对象存储；数据库只存 r2Key / url / mime / size / originalName 等元信息；禁止无对象登记（2G）。
 */
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PresignDto } from './dto/presign.dto';
import { UploadCallbackDto } from './dto/upload-callback.dto';
import { OssService } from './oss.service';
import { R2Service } from './r2.service';
import {
  ALLOWED_EXTENSIONS,
  extractExtension,
  isMimeAllowed,
  normalizeMime,
} from './upload.constants';
import { ObjectStorageService } from './object-storage.interface';

// presign 返回结构
export interface PresignResult {
  uploadUrl: string; // 预签名 PUT 地址
  objectKey: string; // 生成的对象 key
  r2Key: string; // 兼容旧前端字段
  publicUrl: string; // 上传成功后的可访问 URL
  method: 'PUT'; // 前端直传方法
  expiresIn: number; // 预签名有效期（秒）
  headers: Record<string, string>; // 直传必须携带的头（Content-Type 与签名一致）
  requiredHeaders: Record<string, string>; // 兼容旧前端字段
}

// callback 返回结构
export interface CallbackResult {
  fileId: number; // 新建 model_files.id
  url: string; // 可访问 URL
  r2Key: string;
  kind: FileKind;
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly oss: OssService,
    private readonly config: ConfigService,
  ) {}

  private get storageDriver(): 'r2' | 'oss' {
    return (this.config.get<'r2' | 'oss'>('storage.driver') ?? 'r2') as 'r2' | 'oss';
  }

  private get storage(): ObjectStorageService {
    return this.storageDriver === 'oss' ? this.oss : this.r2;
  }

  /**
   * 申请预签名上传地址（POST /api/uploads/presign）。
   * 校验：扩展名白名单 + 按 kind 的大小上限；生成安全 objectKey 并预签名。
   */
  async presign(userId: bigint, dto: PresignDto): Promise<PresignResult> {
    this.assertExtension(dto.kind, dto.fileName);
    this.assertSize(dto.kind, dto.size);

    const objectKey = this.storage.buildKey(dto.kind, userId, dto.fileName);
    const uploadUrl = await this.storage.presignPut(objectKey, dto.mime);
    const headers = { 'Content-Type': dto.mime };

    return {
      uploadUrl,
      objectKey,
      r2Key: objectKey,
      publicUrl: this.storage.publicUrl(objectKey),
      method: 'PUT',
      expiresIn: this.storage.presignExpires,
      headers,
      requiredHeaders: headers,
    };
  }

  /**
   * 上传完成回执（POST /api/uploads/callback，2G）。
   * 校验 r2Key 归属 → HeadObject 确认对象存在 → 以对象存储元信息登记 model_files；失败不写库。
   */
  async callback(userId: bigint, dto: UploadCallbackDto): Promise<CallbackResult> {
    // 防越权：key 必须形如 uploads/{userId}/yyyy/MM/...，即由本人 presign 生成
    const expectedPrefix = `uploads/${userId.toString()}/`;
    if (!dto.r2Key.startsWith(expectedPrefix)) {
      throw new ForbiddenException('r2Key 与当前用户不匹配，禁止登记');
    }
    // 扩展名再校验一次（防止 key 与 originalName 被篡改为非法类型）
    this.assertExtension(dto.kind, dto.originalName);

    // 2G：必须在 R2 上确认对象存在；size/mime 以 HeadObject 为准，禁止回退前端上报值（失败不写库）
    const head = await this.storage.headObject(dto.r2Key);

    this.assertSize(dto.kind, head.size);
    this.assertHeadMime(dto.kind, head.mime);

    const mime = normalizeMime(head.mime);
    const url = this.storage.publicUrl(dto.r2Key);
    const file = await this.prisma.modelFile.create({
      data: {
        userId,
        kind: dto.kind,
        originalName: dto.originalName,
        r2Key: dto.r2Key,
        url,
        size: BigInt(head.size),
        mime,
      },
    });

    return { fileId: Number(file.id), url, r2Key: dto.r2Key, kind: dto.kind };
  }

  // —— 内部校验 ——

  // 扩展名白名单校验
  private assertExtension(kind: FileKind, fileName: string): void {
    const ext = extractExtension(fileName);
    const allowed = ALLOWED_EXTENSIONS[kind];
    if (!ext || !allowed.includes(ext)) {
      throw new BadRequestException(
        `不支持的文件类型：.${ext || '(无扩展名)'}；${kind} 允许：${allowed.join('/')}`,
      );
    }
  }

  // HeadObject Content-Type 白名单校验（2G）
  private assertHeadMime(kind: FileKind, mime: string): void {
    if (!isMimeAllowed(kind, mime)) {
      throw new BadRequestException(
        `对象存储中的文件类型不允许：${normalizeMime(mime) || '(空)'}；请检查上传文件格式`,
      );
    }
  }

  // 大小上限校验（model / cover 各有上限；video 暂复用 model 上限）
  private assertSize(kind: FileKind, size: number): void {
    const maxModel = this.config.get<number>('upload.maxModelBytes') ?? 0;
    const maxCover = this.config.get<number>('upload.maxCoverBytes') ?? 0;
    const limit = kind === 'cover' ? maxCover : maxModel;
    if (limit > 0 && size > limit) {
      const limitMb = Math.round(limit / 1024 / 1024);
      throw new BadRequestException(`文件超过大小上限（${limitMb}MB）`);
    }
  }
}
