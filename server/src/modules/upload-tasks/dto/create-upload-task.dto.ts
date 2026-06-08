/**
 * DTO：创建上传任务入参
 * 接口：POST /api/upload-tasks
 * 说明：仅持久化任务快照，不上传文件实体。
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModelVisibility } from '@prisma/client';
import { MODEL_VISIBILITIES } from '../../models/dto/create-model.dto';

export class CreateUploadTaskDto {
  @ApiPropertyOptional({ description: '客户端幂等 token，同用户重复提交时返回已有任务' })
  @IsOptional()
  @IsString({ message: 'clientToken 必须为字符串' })
  @MaxLength(64, { message: 'clientToken 长度不能超过 64' })
  clientToken?: string;

  @ApiProperty({ description: '模型名称' })
  @IsString({ message: 'title 必须为字符串' })
  @MaxLength(120, { message: 'title 长度不能超过 120' })
  title!: string;

  @ApiProperty({ description: '模型分类名' })
  @IsString({ message: 'type 必须为字符串' })
  @MaxLength(40, { message: 'type 长度不能超过 40' })
  type!: string;

  @ApiPropertyOptional({ description: '应用场景多选' })
  @IsOptional()
  @IsArray({ message: 'scenes 必须为数组' })
  @ArrayMaxSize(20, { message: 'scenes 最多 20 项' })
  @IsString({ each: true, message: 'scenes 每一项必须为字符串' })
  scenes?: string[];

  @ApiPropertyOptional({ description: '模型简介' })
  @IsOptional()
  @IsString({ message: 'description 必须为字符串' })
  @MaxLength(2000, { message: 'description 长度不能超过 2000' })
  description?: string;

  @ApiProperty({ description: '发布权限', enum: MODEL_VISIBILITIES, default: 'public' })
  @IsIn(MODEL_VISIBILITIES, {
    message: 'visibility 必须为 public/private/review 之一',
  })
  visibility: ModelVisibility = ModelVisibility.public;

  @ApiPropertyOptional({ description: '外部查看链接（https）' })
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'viewerUrl 必须为 https 链接' },
  )
  @MaxLength(255, { message: 'viewerUrl 长度不能超过 255' })
  viewerUrl?: string;

  @ApiPropertyOptional({ description: '计划上传的模型文件名' })
  @IsOptional()
  @IsString({ message: 'plannedModelName 必须为字符串' })
  @MaxLength(255, { message: 'plannedModelName 长度不能超过 255' })
  plannedModelName?: string;

  @ApiPropertyOptional({ description: '计划上传的模型文件大小（字节）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'plannedModelSize 必须为整数' })
  @Min(0, { message: 'plannedModelSize 不能为负数' })
  plannedModelSize?: number;

  @ApiPropertyOptional({ description: '计划上传的模型文件 MIME' })
  @IsOptional()
  @IsString({ message: 'plannedModelMime 必须为字符串' })
  @MaxLength(80, { message: 'plannedModelMime 长度不能超过 80' })
  plannedModelMime?: string;

  @ApiPropertyOptional({ description: '计划上传的封面文件名' })
  @IsOptional()
  @IsString({ message: 'plannedCoverName 必须为字符串' })
  @MaxLength(255, { message: 'plannedCoverName 长度不能超过 255' })
  plannedCoverName?: string;

  @ApiPropertyOptional({ description: '计划上传的封面大小（字节）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'plannedCoverSize 必须为整数' })
  @Min(0, { message: 'plannedCoverSize 不能为负数' })
  plannedCoverSize?: number;

  @ApiPropertyOptional({ description: '计划上传的封面 MIME' })
  @IsOptional()
  @IsString({ message: 'plannedCoverMime 必须为字符串' })
  @MaxLength(80, { message: 'plannedCoverMime 长度不能超过 80' })
  plannedCoverMime?: string;
}
