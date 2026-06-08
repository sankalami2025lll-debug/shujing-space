/**
 * DTO：绑定上传任务文件
 * 接口：POST /api/upload-tasks/:id/files
 */
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';

export const UPLOAD_TASK_FILE_KINDS = ['model', 'cover'] as const;
export type UploadTaskFileKind = (typeof UPLOAD_TASK_FILE_KINDS)[number];

export class BindUploadTaskFileDto {
  @ApiProperty({ description: '绑定文件用途', enum: UPLOAD_TASK_FILE_KINDS })
  @IsIn(UPLOAD_TASK_FILE_KINDS, {
    message: 'kind 必须为 model/cover 之一',
  })
  kind!: UploadTaskFileKind;

  @ApiProperty({ description: '已登记的 model_files.id' })
  @Type(() => Number)
  @IsInt({ message: 'fileId 必须为整数' })
  @Min(1, { message: 'fileId 非法' })
  fileId!: number;
}
