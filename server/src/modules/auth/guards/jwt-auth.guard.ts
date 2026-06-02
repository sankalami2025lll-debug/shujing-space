/**
 * 守卫：JwtAuthGuard
 * 用途：校验请求头 Authorization: Bearer <token>，解析 access token，
 *       将 { id, role } 挂载到 req.user 供 @CurrentUser() 使用。
 * 触发：在需要登录态的路由上 @UseGuards(JwtAuthGuard)（如 /api/auth/me、/api/auth/logout）。
 * 失败：缺少/格式错误/无效/过期 token → 抛 401 未授权。
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, JwtPayload } from '../jwt-payload.interface';
import { TokenService } from '../token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    // 从 Authorization 头提取 Bearer Token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录或登录已失效');
    }
    const token = authHeader.slice('Bearer '.length).trim();

    // 校验并解析 token；失败统一抛 401
    let payload: JwtPayload;
    try {
      payload = this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    // 挂载当前用户上下文（id 由字符串转回 BigInt）
    request.user = { id: BigInt(payload.sub), role: payload.role };
    return true;
  }
}
