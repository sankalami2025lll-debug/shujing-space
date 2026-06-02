/**
 * 模块：认证接口封装 api/auth.ts
 * 用途：封装 /api/auth/* 全部认证接口，供 AuthProvider 与后续 AuthPage 调用；统一基于 http.ts（已处理 Bearer/错误/401）。
 * 对应后端：AuthModule（server/src/modules/auth），字段严格对齐各 DTO 与 AuthService 返回的 UserVm。
 */
import { http } from "../http";
import type { AuthResult, User } from "../types";

// VerificationScene：验证码用途场景，必须与后端 SendCodeDto 枚举一致（注册 / 登录 / 找回密码）。
export type VerificationScene = "register" | "login" | "reset";

// SendCodeResult：发送验证码返回；devCode 仅开发环境返回（生产为 undefined），用于本地联调。
export interface SendCodeResult {
  sent: boolean;
  expiresIn: number;
  devCode?: string;
}

// SendCodePayload：发送验证码入参（POST /api/auth/send-code）。
export interface SendCodePayload {
  target: string; // 接收验证码的手机号或邮箱
  scene: VerificationScene; // 用途场景
}

// RegisterPayload：注册入参（POST /api/auth/register），对齐后端 RegisterDto。
export interface RegisterPayload {
  account: string; // 手机号或邮箱（唯一）
  code: string; // 注册验证码（scene=register）
  password: string; // 登录密码（≥6 位）
  company?: string; // 公司名称（可选）
  roleType?: string; // 角色 / 需求类型（可选，对应注册表单「使用目的」）
  agreed: boolean; // 协议勾选，必须为 true
}

// LoginPayload：登录入参（POST /api/auth/login），对齐后端 LoginDto。
export interface LoginPayload {
  account: string; // 手机号或邮箱
  loginType: "password" | "code"; // 登录方式
  password?: string; // 密码登录时必填
  code?: string; // 验证码登录时必填
}

// ResetPasswordPayload：找回 / 重置密码入参（POST /api/auth/reset-password），对齐后端 ResetPasswordDto。
export interface ResetPasswordPayload {
  account: string; // 手机号或邮箱
  code: string; // 重置验证码（scene=reset）
  newPassword: string; // 新密码（≥6 位）
}

// sendCode：发送验证码；公开接口，无需登录态（auth:false 避免无谓携带 token）。
export function sendCode(payload: SendCodePayload): Promise<SendCodeResult> {
  return http.post<SendCodeResult>("/auth/send-code", payload, { auth: false });
}

// register：注册并直接返回登录态（accessToken + user）；公开接口。
export function register(payload: RegisterPayload): Promise<AuthResult> {
  return http.post<AuthResult>("/auth/register", payload, { auth: false });
}

// login：登录（密码 / 验证码），返回登录态（accessToken + user）；公开接口。
export function login(payload: LoginPayload): Promise<AuthResult> {
  return http.post<AuthResult>("/auth/login", payload, { auth: false });
}

// resetPassword：找回 / 重置密码；公开接口。
export function resetPassword(payload: ResetPasswordPayload): Promise<{ reset: true }> {
  return http.post<{ reset: true }>("/auth/reset-password", payload, { auth: false });
}

// getMe：获取当前登录用户（需 Bearer Token）；用于启动自举恢复登录态。
export function getMe(): Promise<User> {
  return http.get<User>("/auth/me");
}

// logout：退出登录（需 Bearer Token）；后端无状态，仅返回提示，真正清理由前端删除 token 完成。
export function logout(): Promise<{ loggedOut: boolean }> {
  return http.post<{ loggedOut: boolean }>("/auth/logout");
}
