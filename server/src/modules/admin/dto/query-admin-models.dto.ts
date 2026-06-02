/**
 * DTO：后台模型审核列表查询入参
 * 接口：GET /api/admin/models（仅 admin）
 * 字段：
 *  - status：审核状态过滤（all 全部 / draft / pending / published / rejected），默认 pending（后台默认看待审）
 *  - type：分类名过滤（可选）
 *  - keyword：关键词（标题 + 作者昵称，contains，不区分大小写）
 *  - page / pageSize：分页（继承 PaginationDto）
 * 说明：后台可见全部状态，不受 published + public 限制（区别于游客 GET /api/models）。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// 后台模型状态过滤枚举（all 不过滤；其余对应 Prisma ModelStatus）
export const ADMIN_MODEL_STATUS_FILTERS = [
  'all',
  'draft',
  'pending',
  'published',
  'rejected',
] as const;
export type AdminModelStatusFilter = (typeof ADMIN_MODEL_STATUS_FILTERS)[number];

export class QueryAdminModelsDto extends PaginationDto {
  // 状态过滤：默认 pending（后台默认聚焦待审核）
  @ApiPropertyOptional({
    description: '审核状态过滤',
    enum: ADMIN_MODEL_STATUS_FILTERS,
    default: 'pending',
  })
  @IsOptional()
  @IsIn(ADMIN_MODEL_STATUS_FILTERS, {
    message: 'status 必须为 all/draft/pending/published/rejected 之一',
  })
  status: AdminModelStatusFilter = 'pending';

  // 分类名过滤（可选）
  @ApiPropertyOptional({ description: '分类名过滤' })
  @IsOptional()
  @IsString({ message: 'type 必须为字符串' })
  @MaxLength(40, { message: 'type 长度不能超过 40' })
  type?: string;

  // 关键词（标题 + 作者昵称）
  @ApiPropertyOptional({ description: '关键词（标题 / 作者昵称）' })
  @IsOptional()
  @IsString({ message: 'keyword 必须为字符串' })
  @MaxLength(120, { message: 'keyword 长度不能超过 120' })
  keyword?: string;
}
