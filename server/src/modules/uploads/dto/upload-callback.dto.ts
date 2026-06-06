/**
 * DTO：上传完成回执入参
 * 接口：POST /api/uploads/callback
 * 字段：
 *  - kind：文件用途（与 presign 一致）
 *  - objectKey：presign 返回的对象 key（服务端校验其前缀属于当前用户，防越权登记）
 *  - r2Key：deprecated 历史兼容别名；值与 objectKey 相同
 *  - originalName：原始文件名 → model_files.original_name
 *  - mime：MIME 类型 → model_files.mime
 *  - size：文件大小（字节）→ model_files.size
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileKind } from '@prisma/client';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { FILE_KINDS } from './presign.dto';

export class UploadCallbackDto {
  // 文件用途
  @ApiProperty({ description: '文件用途', enum: FILE_KINDS })
  @IsIn(FILE_KINDS, { message: 'kind 必须为 model/cover/video 之一' })
  kind!: FileKind;

  // 正式对象 key（presign 返回）
  @ApiPropertyOptional({ description: 'presign 返回的 objectKey', example: 'uploads/2/uuid.glb' })
  @IsOptional()
  @IsString({ message: 'objectKey 必须为字符串' })
  @IsNotEmpty({ message: 'objectKey 不能为空' })
  @MaxLength(255, { message: 'objectKey 长度不能超过 255' })
  objectKey?: string;

  // deprecated 历史兼容字段
  @ApiPropertyOptional({
    description: 'deprecated：历史兼容字段 r2Key，值与 objectKey 相同',
    example: 'uploads/2/uuid.glb',
    deprecated: true,
  })
  @IsOptional()
  @IsString({ message: 'r2Key 必须为字符串' })
  @IsNotEmpty({ message: 'r2Key 不能为空' })
  @MaxLength(255, { message: 'r2Key 长度不能超过 255' })
  r2Key?: string;

  // 原始文件名
  @ApiProperty({ description: '原始文件名', example: 'building.glb' })
  @IsString({ message: 'originalName 必须为字符串' })
  @IsNotEmpty({ message: 'originalName 不能为空' })
  @MaxLength(255, { message: 'originalName 长度不能超过 255' })
  originalName!: string;

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
