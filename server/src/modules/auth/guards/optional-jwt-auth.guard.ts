/**
 * 守卫：OptionalJwtAuthGuard（可选登录态）
 * 用途：用于「游客可访问、但登录用户需附带个性化数据」的只读接口（如模型列表/详情附带 isLiked/isFavorited）。
 * 行为：
 *  - 携带有效 Bearer Token → 解析并把 { id, role } 挂到 req.user。
 *  - 未携带 Token → 直接放行（游客态，req.user 为 undefined），不抛 401。
 *  - 携带但失效/过期 Token → 静默放行为游客态，同样不抛 401。
 * 与 JwtAuthGuard 的区别：本守卫绝不拦截游客，保证「游客仍可浏览」红线。
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, JwtPayload } from '../jwt-payload.interface';
import { TokenService } from '../token.service';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    // 无 Authorization 头：游客态，直接放行
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return true;
    }

    // 有 Token：尝试解析；失效/过期则降级为游客态（不抛错）
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const payload: JwtPayload = this.tokenService.verifyAccessToken(token);
      request.user = { id: BigInt(payload.sub), role: payload.role };
    } catch {
      // 静默忽略：当作未登录处理
    }
    return true;
  }
}
