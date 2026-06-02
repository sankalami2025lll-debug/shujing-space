/**
 * DTO：后台模型审核操作入参
 * 接口：PATCH /api/admin/models/:id/status（仅 admin）
 * 字段：
 *  - action：审核动作（approve 通过 / reject 驳回），必填
 *  - rejectReason：驳回原因；action=reject 时必填，≤500
 * 状态机红线：
 *  - approve 仅允许 pending → published
 *  - reject 仅允许 pending → rejected，且 rejectReason 必填
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

// 审核动作枚举
export const MODEL_REVIEW_ACTIONS = ['approve', 'reject'] as const;
export type ModelReviewAction = (typeof MODEL_REVIEW_ACTIONS)[number];

export class UpdateModelStatusDto {
  // 审核动作：approve 通过 / reject 驳回
  @ApiProperty({ description: '审核动作', enum: MODEL_REVIEW_ACTIONS })
  @IsIn(MODEL_REVIEW_ACTIONS, { message: 'action 必须为 approve 或 reject' })
  action!: ModelReviewAction;

  // 驳回原因：action=reject 时必填（≤500）；approve 时该字段被忽略（不校验）
  @ApiPropertyOptional({ description: '驳回原因（reject 时必填）', maxLength: 500 })
  @ValidateIf((o: UpdateModelStatusDto) => o.action === 'reject')
  @IsString({ message: 'rejectReason 必须为字符串' })
  @IsNotEmpty({ message: 'reject 时 rejectReason 不能为空' })
  @MaxLength(500, { message: 'rejectReason 长度不能超过 500' })
  rejectReason?: string;
}
