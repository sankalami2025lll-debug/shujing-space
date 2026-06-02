/**
 * DTO：后台联系线索列表查询入参
 * 接口：GET /api/admin/leads（仅 admin）
 * 字段：
 *  - status：线索状态过滤（LeadStatus：new/contacted/qualified/quoted/won/lost）
 *  - keyword：关键词（姓名 / 联系方式 / 公司 / 邮箱，contains，不区分大小写）
 *  - page / pageSize：分页（继承 PaginationDto）
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAdminLeadsDto extends PaginationDto {
  // 线索状态过滤
  @ApiPropertyOptional({ description: '线索状态过滤', enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus, {
    message: 'status 必须为 new/contacted/qualified/quoted/won/lost 之一',
  })
  status?: LeadStatus;

  // 关键词（姓名 / 联系方式 / 公司 / 邮箱）
  @ApiPropertyOptional({ description: '关键词（姓名 / 联系方式 / 公司 / 邮箱）' })
  @IsOptional()
  @IsString({ message: 'keyword 必须为字符串' })
  @MaxLength(120, { message: 'keyword 长度不能超过 120' })
  keyword?: string;
}
