/**
 * DTO：后台更新训练数据服务申请状态入参
 * 接口：PATCH /api/admin/training-applications/:id/status（仅 admin）
 * 字段：
 *  - status：申请状态（TrainingStatus：submitted/contacted/evaluating/quoted/closed），必填
 * 说明：状态值必须为现有 Prisma enum TrainingStatus，不引入自定义状态。
 */
import { ApiProperty } from '@nestjs/swagger';
import { TrainingStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTrainingStatusDto {
  // 申请状态（必填，须为 TrainingStatus 枚举）
  @ApiProperty({ description: '申请状态', enum: TrainingStatus })
  @IsEnum(TrainingStatus, {
    message: 'status 必须为 submitted/contacted/evaluating/quoted/closed 之一',
  })
  status!: TrainingStatus;
}
