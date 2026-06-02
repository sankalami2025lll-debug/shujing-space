/**
 * DTO：后台更新联系线索状态入参
 * 接口：PATCH /api/admin/leads/:id/status（仅 admin）
 * 字段：
 *  - status：线索状态（LeadStatus：new/contacted/qualified/quoted/won/lost），必填
 * 说明：状态值必须为现有 Prisma enum LeadStatus，不引入自定义状态。
 */
import { ApiProperty } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateLeadStatusDto {
  // 线索状态（必填，须为 LeadStatus 枚举）
  @ApiProperty({ description: '线索状态', enum: LeadStatus })
  @IsEnum(LeadStatus, {
    message: 'status 必须为 new/contacted/qualified/quoted/won/lost 之一',
  })
  status!: LeadStatus;
}
