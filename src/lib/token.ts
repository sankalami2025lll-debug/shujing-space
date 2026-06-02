/**
 * 模块：登录 Token 存取 token.ts
 * 用途：集中管理 JWT access token 的读写与清理，供 http.ts 自动携带、AuthContext 维护登录态使用。
 * 说明：后端为 access-only（无 refresh）；token 仅存浏览器 localStorage，绝不写死任何密钥。
 *       SSR/Next 迁移时此模块需做 typeof window 守卫（当前 Vite 原型为纯客户端，已做兜底）。
 */

// TOKEN_KEY：localStorage 中存放 access token 的键名（带项目前缀，避免与其它站点冲突）
const TOKEN_KEY = "sj_token";

// getToken：读取当前登录 token；无 token 或非浏览器环境返回 null
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    // localStorage 被禁用（隐私模式等）时静默降级为未登录
    return null;
  }
}

// setToken：登录/注册成功后写入 access token
export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 写入失败（存储已满/被禁用）时忽略，登录态仅本次会话有效
  }
}

// clearToken：登出或 token 失效（401）时清除本地 token
export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略清理异常
  }
}
