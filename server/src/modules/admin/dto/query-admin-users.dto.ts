/**
 * DTO：后台用户列表查询入参
 * 接口：GET /api/admin/users（仅 admin）
 * 字段：
 *  - keyword：关键词（昵称 / 手机 / 邮箱，contains，不区分大小写）
 *  - role：角色过滤（user / admin）
 *  - status：账号状态过滤（active / disabled）
 *  - page / pageSize：分页（继承 PaginationDto）
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAdminUsersDto extends PaginationDto {
  // 关键词（昵称 / 手机 / 邮箱）
  @ApiPropertyOptional({ description: '关键词（昵称 / 手机 / 邮箱）' })
  @IsOptional()
  @IsString({ message: 'keyword 必须为字符串' })
  @MaxLength(120, { message: 'keyword 长度不能超过 120' })
  keyword?: string;

  // 角色过滤（user / admin）
  @ApiPropertyOptional({ description: '角色过滤', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: 'role 必须为 user 或 admin' })
  role?: UserRole;

  // 账号状态过滤（active / disabled）
  @ApiPropertyOptional({ description: '账号状态过滤', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'status 必须为 active 或 disabled' })
  status?: UserStatus;
}
