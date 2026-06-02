/**
 * DTO：我的模型列表查询入参
 * 接口：GET /api/users/me/models
 * 字段：
 *  - status：状态过滤（all 全部 / draft 草稿 / pending 审核中 / published 已发布 / rejected 已驳回），默认 all
 *  - page / pageSize：分页（继承 PaginationDto，page 默认 1、pageSize 默认 12、最大 100）
 * 说明：本接口为「本人视角」，返回本人全部状态模型，不受 published + public 限制。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// 我的模型状态过滤枚举（all 为不按 status 过滤；其余对应 Prisma ModelStatus）
export const MY_MODEL_STATUS_FILTERS = [
  'all',
  'draft',
  'pending',
  'published',
  'rejected',
] as const;
export type MyModelStatusFilter = (typeof MY_MODEL_STATUS_FILTERS)[number];

export class QueryMyModelsDto extends PaginationDto {
  // 状态过滤：默认 all（返回全部状态）
  @ApiPropertyOptional({
    description: '状态过滤',
    enum: MY_MODEL_STATUS_FILTERS,
    default: 'all',
  })
  @IsOptional()
  @IsIn(MY_MODEL_STATUS_FILTERS, {
    message: 'status 必须为 all/draft/pending/published/rejected 之一',
  })
  status: MyModelStatusFilter = 'all';
}
