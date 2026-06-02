/**
 * DTO：后台更新用户状态 / 角色入参
 * 接口：PATCH /api/admin/users/:id/status（仅 admin）
 * 字段（status / role 至少传一项，由 service 校验）：
 *  - status：账号状态（active 启用 / disabled 禁用）
 *  - role：系统角色（user / admin）
 * 安全红线：管理员不能禁用或降级自己（由 service 用当前登录 id 拦截）。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateUserStatusDto {
  // 账号状态（active / disabled）
  @ApiPropertyOptional({ description: '账号状态', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'status 必须为 active 或 disabled' })
  status?: UserStatus;

  // 系统角色（user / admin）
  @ApiPropertyOptional({ description: '系统角色', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: 'role 必须为 user 或 admin' })
  role?: UserRole;
}
