/**
 * DTO：标注新增媒体入参
 * 接口：POST /api/models/:modelId/annotations/:annotationId/media
 * 字段：
 *  - fileId：uploads/callback 返回的 model_files.id（前端先走 /uploads/presign+callback，kind=cover）
 *  - mediaType：image / panorama / video（V1 仅完整支持 image；panorama/video 为类型预留，后端允许写入但前端 V1 仅 image）
 *  - fileName / mimeType / size：可选，缺省由 model_files 回填
 *  - sortOrder：可选
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ANNOTATION_MEDIA_TYPES = ['image', 'panorama', 'video'] as const;
export type AnnotationMediaTypeValue = (typeof ANNOTATION_MEDIA_TYPES)[number];

/**
 * 标注单张图片大小上限（字节）。
 * V1.1.1：与 uploads 模块 cover 上限 MAX_COVER_SIZE_MB（默认 10MB）对齐，
 * 标注图片复用 cover 上传链路，故此处软上限取 10MB。
 */
export const ANNOTATION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export class CreateAnnotationMediaDto {
  @ApiProperty({ description: 'uploads/callback 返回的 fileId' })
  @IsInt({ message: 'fileId 必须为整数' })
  @Min(1, { message: 'fileId 必须大于 0' })
  fileId!: number;

  @ApiProperty({ description: '媒体类型', enum: ANNOTATION_MEDIA_TYPES })
  @IsIn(ANNOTATION_MEDIA_TYPES, {
    message: 'mediaType 必须为 image/panorama/video 之一',
  })
  mediaType!: AnnotationMediaTypeValue;

  @ApiPropertyOptional({ description: '原始文件名' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: 'MIME 类型' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mimeType?: string;

  @ApiPropertyOptional({ description: '文件大小（字节）' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(ANNOTATION_IMAGE_MAX_BYTES, { message: '单张图片不超过 10MB' })
  size?: number;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
