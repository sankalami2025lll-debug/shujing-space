/**
 * DTO：申请 R2 预签名上传地址入参
 * 接口：POST /api/uploads/presign
 * 字段：
 *  - kind：文件用途（model 模型 / cover 封面 / video 视频）
 *  - fileName：原始文件名（取扩展名做白名单校验，服务端生成安全 r2Key，不直接用作 key）
 *  - mime：MIME 类型（写入预签名 Content-Type，前端直传须保持一致）
 *  - size：文件大小（字节），按 kind 校验上限
 */
import { ApiProperty } from '@nestjs/swagger';
import { FileKind } from '@prisma/client';
import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

// 文件用途枚举值（与 Prisma FileKind 对应）
export const FILE_KINDS = ['model', 'cover', 'video'] as const;

export class PresignDto {
  // 文件用途
  @ApiProperty({ description: '文件用途', enum: FILE_KINDS })
  @IsIn(FILE_KINDS, { message: 'kind 必须为 model/cover/video 之一' })
  kind!: FileKind;

  // 原始文件名（用于取扩展名 + 校验白名单）
  @ApiProperty({ description: '原始文件名', example: 'building.glb' })
  @IsString({ message: 'fileName 必须为字符串' })
  @IsNotEmpty({ message: 'fileName 不能为空' })
  @MaxLength(255, { message: 'fileName 长度不能超过 255' })
  fileName!: string;

  // MIME 类型
  @ApiProperty({ description: 'MIME 类型', example: 'model/gltf-binary' })
  @IsString({ message: 'mime 必须为字符串' })
  @IsNotEmpty({ message: 'mime 不能为空' })
  @MaxLength(80, { message: 'mime 长度不能超过 80' })
  mime!: string;

  // 文件大小（字节）
  @ApiProperty({ description: '文件大小（字节）', example: 10485760 })
  @IsInt({ message: 'size 必须为整数（字节）' })
  @Min(1, { message: 'size 必须大于 0' })
  size!: number;
}
