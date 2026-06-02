/**
 * 守卫：RolesGuard
 * 用途：读取 @Roles(...) 元数据，校验当前登录用户的角色是否满足要求。
 * 依赖：需在 JwtAuthGuard 之后执行（req.user 已存在）。
 * 触发：@UseGuards(JwtAuthGuard, RolesGuard) + @Roles('admin')（供第 9 步后台复用）。
 * 失败：未登录抛 401；角色不足抛 403。
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 读取路由声明的所需角色；未声明则放行
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('未登录或登录已失效');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('无权限访问');
    }
    return true;
  }
}
