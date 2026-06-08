/**
 * DTO：查询我的上传任务
 * 接口：GET /api/upload-tasks/me
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const MY_UPLOAD_TASK_FILTERS = ['incomplete', 'all'] as const;
export type MyUploadTaskFilter = (typeof MY_UPLOAD_TASK_FILTERS)[number];

export class QueryMyUploadTasksDto {
  @ApiPropertyOptional({
    description: '状态过滤',
    enum: MY_UPLOAD_TASK_FILTERS,
    default: 'incomplete',
  })
  @IsOptional()
  @IsIn(MY_UPLOAD_TASK_FILTERS, {
    message: 'status 必须为 incomplete/all 之一',
  })
  status: MyUploadTaskFilter = 'incomplete';
}
