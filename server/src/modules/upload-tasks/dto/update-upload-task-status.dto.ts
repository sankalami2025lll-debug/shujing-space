/**
 * DTO：更新上传任务状态 / 阶段 / 错误快照
 * 接口：POST /api/upload-tasks/:id/status
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const UPLOAD_TASK_STATUSES = [
  'queued',
  'running',
  'processing',
  'published',
  'failed',
  'canceled',
  'interrupted',
] as const;
export type UploadTaskStatusValue = (typeof UPLOAD_TASK_STATUSES)[number];

export const UPLOAD_TASK_STAGES = [
  'queued',
  'presigning_model',
  'uploading_model',
  'callbacking_model',
  'presigning_cover',
  'uploading_cover',
  'callbacking_cover',
  'creating_model',
  'processing',
  'published',
  'failed',
  'canceled',
  'interrupted',
] as const;
export type UploadTaskStageValue = (typeof UPLOAD_TASK_STAGES)[number];

export class UpdateUploadTaskStatusDto {
  @ApiPropertyOptional({ description: '任务总体状态', enum: UPLOAD_TASK_STATUSES })
  @IsOptional()
  @IsIn(UPLOAD_TASK_STATUSES, {
    message:
      'status 必须为 queued/running/processing/published/failed/canceled/interrupted 之一',
  })
  status?: UploadTaskStatusValue;

  @ApiPropertyOptional({ description: '任务阶段', enum: UPLOAD_TASK_STAGES })
  @IsOptional()
  @IsIn(UPLOAD_TASK_STAGES, {
    message:
      'stage 必须为 queued/presigning_model/uploading_model/callbacking_model/presigning_cover/uploading_cover/callbacking_cover/creating_model/processing/published/failed/canceled/interrupted 之一',
  })
  stage?: UploadTaskStageValue;

  @ApiPropertyOptional({ description: '最近失败阶段', enum: UPLOAD_TASK_STAGES })
  @IsOptional()
  @IsIn(UPLOAD_TASK_STAGES, {
    message:
      'lastErrorStage 必须为 queued/presigning_model/uploading_model/callbacking_model/presigning_cover/uploading_cover/callbacking_cover/creating_model/processing/published/failed/canceled/interrupted 之一',
  })
  lastErrorStage?: UploadTaskStageValue;

  @ApiPropertyOptional({ description: '最近错误码' })
  @IsOptional()
  @IsString({ message: 'lastErrorCode 必须为字符串' })
  @MaxLength(64, { message: 'lastErrorCode 长度不能超过 64' })
  lastErrorCode?: string;

  @ApiPropertyOptional({ description: '最近错误信息' })
  @IsOptional()
  @IsString({ message: 'lastErrorMessage 必须为字符串' })
  @MaxLength(2000, { message: 'lastErrorMessage 长度不能超过 2000' })
  lastErrorMessage?: string;

  @ApiPropertyOptional({ description: '当前模型 objectKey（presign 后持久化）' })
  @IsOptional()
  @IsString({ message: 'currentModelObjectKey 必须为字符串' })
  @MaxLength(255, { message: 'currentModelObjectKey 长度不能超过 255' })
  currentModelObjectKey?: string;

  @ApiPropertyOptional({ description: '当前封面 objectKey（presign 后持久化）' })
  @IsOptional()
  @IsString({ message: 'currentCoverObjectKey 必须为字符串' })
  @MaxLength(255, { message: 'currentCoverObjectKey 长度不能超过 255' })
  currentCoverObjectKey?: string;
}
