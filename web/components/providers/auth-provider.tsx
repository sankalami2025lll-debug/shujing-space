"use client";

/**
 * 模块：全站登录态上下文 AuthProvider
 * 页面用途：集中维护当前登录用户与登录态，供后续 NavBar、AuthPage、上传/收藏等读取
 * 主要功能：
 *   1. 启动自举：挂载时若 localStorage 存在 token，则 GET /api/auth/me 恢复登录态
 *   2. setAuth：登录/注册成功后写入 accessToken 并设置当前用户
 *   3. logout：调用 /api/auth/logout（容错）+ 清除本地 token + 清空用户
 * 对应文档：docs/dev-checkpoint.md（Next.js 迁移步骤 3）
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getToken, setToken, clearToken } from "@/lib/token";
import { getMe, logout as logoutApi } from "@/lib/api/auth";
import type { User } from "@/lib/types";

// AuthContextValue：上下文对外暴露的状态与方法。
interface AuthContextValue {
  user: User | null; // 当前登录用户，未登录为 null
  isAuthed: boolean; // 是否已登录（user 非空）
  bootstrapping: boolean; // 启动自举中（有 token 时拉取 me 期间），避免 UI 闪烁
  setAuth: (accessToken: string, user: User) => void; // 登录/注册成功后写入登录态
  logout: () => Promise<void>; // 退出登录
  refresh: () => Promise<void>; // 手动重新拉取当前用户
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // user：当前登录用户；bootstrapping：是否处于启动自举阶段（有 token 时初始为 true）
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState<boolean>(() => !!getToken());

  // refresh：用当前 token 拉取登录用户信息；失败（含 401）时清空登录态
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      // token 失效/过期：http.ts 已在 401 时清 token，这里兜底清空用户
      clearToken();
      setUser(null);
    }
  }, []);

  // 启动自举：仅首次挂载时执行，有 token 才尝试恢复登录态
  useEffect(() => {
    let active = true;
    (async () => {
      if (getToken()) {
        await refresh();
      }
      if (active) setBootstrapping(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  // setAuth：保存 accessToken 并设置当前用户（登录/注册成功后调用）
  const setAuth = useCallback((accessToken: string, nextUser: User) => {
    setToken(accessToken);
    setUser(nextUser);
  }, []);

  // logout：调用后端登出（容错，失败也照常本地登出）+ 清 token + 清 user
  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // 后端为无状态登出，网络/失效异常不阻断本地登出
    }
    clearToken();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthed: !!user,
    bootstrapping,
    setAuth,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth：在组件内读取登录态与方法；必须在 AuthProvider 内使用
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth 必须在 <AuthProvider> 内部使用");
  }
  return ctx;
}
