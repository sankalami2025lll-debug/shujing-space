import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const UPLOAD_MULTIPART_KINDS = ['model', 'cover'] as const;
export type UploadMultipartKind = (typeof UPLOAD_MULTIPART_KINDS)[number];

export class InitUploadTaskMultipartDto {
  @ApiProperty({ description: '分片上传文件用途', enum: UPLOAD_MULTIPART_KINDS })
  @IsIn(UPLOAD_MULTIPART_KINDS, {
    message: 'kind 必须为 model/cover 之一',
  })
  kind!: UploadMultipartKind;

  @ApiProperty({ description: '原始文件名', example: 'building.zip' })
  @IsString({ message: 'fileName 必须为字符串' })
  @IsNotEmpty({ message: 'fileName 不能为空' })
  @MaxLength(255, { message: 'fileName 长度不能超过 255' })
  fileName!: string;

  @ApiProperty({ description: 'MIME 类型', example: 'application/zip' })
  @IsString({ message: 'mime 必须为字符串' })
  @IsNotEmpty({ message: 'mime 不能为空' })
  @MaxLength(80, { message: 'mime 长度不能超过 80' })
  mime!: string;

  @ApiProperty({ description: '文件大小（字节）', example: 536870912 })
  @Type(() => Number)
  @IsInt({ message: 'size 必须为整数' })
  @Min(1, { message: 'size 必须大于 0' })
  size!: number;

  @ApiProperty({
    description: '文件指纹算法',
    required: false,
    example: 'sample_sha256_v1',
  })
  @IsOptional()
  @IsString({ message: 'fingerprintAlgo 必须为字符串' })
  @MaxLength(40, { message: 'fingerprintAlgo 长度不能超过 40' })
  fingerprintAlgo?: string;

  @ApiProperty({
    description: '文件指纹',
    required: false,
    example: 'sha256:abc123',
  })
  @IsOptional()
  @IsString({ message: 'fingerprint 必须为字符串' })
  @MaxLength(255, { message: 'fingerprint 长度不能超过 255' })
  fingerprint?: string;

  @ApiProperty({
    description: '文件 lastModified（毫秒时间戳）',
    required: false,
    example: 1717766400000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'lastModified 必须为整数' })
  @Min(0, { message: 'lastModified 非法' })
  lastModified?: number;
}
