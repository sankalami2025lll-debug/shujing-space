/**
 * 装饰器：@CurrentUser()
 * 用途：从请求上下文取出 JwtAuthGuard 解析挂载的当前登录用户（req.user）。
 * 示例：me(@CurrentUser() user: AuthUser) {...}
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
