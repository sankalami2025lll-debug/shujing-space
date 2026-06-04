/**
 * DTO：后台模型处理状态操作入参
 * 接口：PATCH /api/admin/models/:id/processing（仅 admin）
 * 字段：
 *  - action：处理动作（mark_ready / mark_failed），必填
 *  - reason：失败原因；action=mark_failed 时必填，≤500
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export const MODEL_PROCESSING_ACTIONS = ['mark_ready', 'mark_failed'] as const;
export type ModelProcessingAction = (typeof MODEL_PROCESSING_ACTIONS)[number];

export class UpdateModelProcessingDto {
  @ApiProperty({ description: '处理动作', enum: MODEL_PROCESSING_ACTIONS })
  @IsIn(MODEL_PROCESSING_ACTIONS, {
    message: 'action 必须为 mark_ready 或 mark_failed',
  })
  action!: ModelProcessingAction;

  @ApiPropertyOptional({ description: '解析失败原因（mark_failed 时必填）', maxLength: 500 })
  @ValidateIf((o: UpdateModelProcessingDto) => o.action === 'mark_failed')
  @IsString({ message: 'reason 必须为字符串' })
  @IsNotEmpty({ message: '请填写解析失败原因' })
  @MaxLength(500, { message: 'reason 长度不能超过 500' })
  reason?: string;
}
