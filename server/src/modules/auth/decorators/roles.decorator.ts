/**
 * 装饰器：@Roles(...roles)
 * 用途：标记路由所需的系统角色，配合 RolesGuard 做权限校验。
 * 示例：@Roles('admin') 表示仅管理员可访问（供第 9 步后台 /api/admin/* 复用）。
 */
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// 元数据键名：RolesGuard 据此读取所需角色
export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
