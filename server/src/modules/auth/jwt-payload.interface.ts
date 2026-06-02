/**
 * 类型：JWT 载荷与登录用户上下文
 * 用途：约定 access token 内携带的字段，以及解析后挂载到请求上的当前用户结构。
 */
import { UserRole } from '@prisma/client';

// access token 载荷：sub 为用户 id（字符串，规避 BigInt 序列化问题），role 为系统角色
export interface JwtPayload {
  sub: string;
  role: UserRole;
}

// 经 JwtAuthGuard 解析后挂载到 req.user 的当前用户上下文
export interface AuthUser {
  id: bigint;
  role: UserRole;
}
