/**
 * 服务：TokenService
 * 用途：封装 access token 的签发与校验（本阶段 access-only，无 refresh token）。
 * 说明：密钥与有效期由 JwtModule 统一配置（来自环境变量 JWT_ACCESS_SECRET / JWT_ACCESS_EXPIRES）。
 */
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  // 签发 access token：sub 用字符串承载用户 id（规避 BigInt 序列化问题）
  signAccessToken(userId: bigint, role: UserRole): string {
    const payload: JwtPayload = { sub: userId.toString(), role };
    return this.jwtService.sign(payload);
  }

  // 校验并解析 access token；无效/过期时抛错，由调用方（Guard）转 401
  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }
}
