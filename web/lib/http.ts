/**
 * 模块：HTTP 请求封装 http.ts
 * 用途：全站统一的后端访问入口，封装 base URL、Bearer Token、统一响应解析与错误抛出。
 * 主要功能：
 *   1. 统一读取 NEXT_PUBLIC_API_BASE_URL（缺省 /api，配合 next.config.ts dev rewrites 代理到后端 4000）。
 *   2. 自动携带 Authorization: Bearer <token>（有 token 时）。
 *   3. 统一解析后端 { code, message, data }：code !== 0 或 HTTP 非 2xx 抛 ApiError，仅返回 data。
 *   4. 401（未登录/登录失效）时清理本地 token，由上层决定是否引导重新登录。
 * 说明：Next.js 迁移阶段 0–2 基础设施，供 smoke 页与后续页面复用。
 */
import { getToken, clearToken } from "./token";
import type { ApiResponse } from "./types";

// API_BASE_URL：后端 API 基址；本地联调强制走 /api，避免 shell 中残留远端地址污染 dev bundle。
function resolveApiBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      return "/api";
    }
  }

  if (process.env.NODE_ENV === "development" && envBase === "https://shujing.space/api") {
    return "/api";
  }

  return envBase || "/api";
}

/**
 * ApiError：统一的接口错误类型。
 * - code：后端业务错误码（HTTP 层错误时为 -1）。
 * - status：HTTP 状态码（网络异常时为 0）。
 * - message：可直接展示给用户的中文/后端错误信息。
 */
export class ApiError extends Error {
  code: number;
  status: number;

  constructor(message: string, code: number, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// RequestOptions：在标准 fetch RequestInit 基础上，扩展便捷的 json 入参与是否携带鉴权。
export interface RequestOptions extends Omit<RequestInit, "body"> {
  // json：请求体对象，自动序列化为 JSON 并设置 Content-Type；与原生 body 二选一。
  json?: unknown;
  // body：原生请求体（如 FormData、Blob 等需要时使用）。
  body?: BodyInit | null;
  // auth：是否携带 Bearer Token，默认 true（公开接口可传 false，但带上也无副作用）。
  auth?: boolean;
}

// buildUrl：拼接基址与路径，避免出现重复或缺失的斜杠。
function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = resolveApiBaseUrl().replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * request：底层请求函数。返回后端 data 字段（已剥离 { code, message } 外壳）。
 * 失败时抛出 ApiError，由调用方统一捕获处理三态。
 */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, body, auth = true, headers, ...rest } = options;

  // 组装请求头：默认 Accept JSON；有 json 入参时设置 Content-Type；有 token 且需鉴权时带 Bearer。
  const finalHeaders = new Headers(headers as HeadersInit | undefined);
  finalHeaders.set("Accept", "application/json");
  if (json !== undefined) finalHeaders.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : (body ?? null),
    });
  } catch {
    // 网络层异常（断网、代理未启动、后端未运行等）。
    throw new ApiError("网络请求失败，请检查网络或稍后重试。", -1, 0);
  }

  // 401：登录态失效，先清本地 token，再抛错由上层引导登录。
  if (res.status === 401) {
    clearToken();
  }

  // 解析响应体（兼容 204 / 空响应体）。
  let payload: ApiResponse<T> | null = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiResponse<T>;
    } catch {
      payload = null;
    }
  }

  // HTTP 非 2xx：优先用后端 message，否则给出通用文案。
  if (!res.ok) {
    const message = payload?.message ?? `请求失败（HTTP ${res.status}）`;
    const code = payload?.code ?? -1;
    throw new ApiError(message, code, res.status);
  }

  // 2xx 但响应体缺失或格式异常。
  if (payload === null) {
    throw new ApiError("响应数据为空或格式异常。", -1, res.status);
  }

  // 业务错误码：HTTP 2xx 但 code !== 0。
  if (payload.code !== 0) {
    throw new ApiError(payload.message || "请求未成功。", payload.code, res.status);
  }

  return payload.data;
}

// http：按 HTTP 方法提供的便捷调用集合。
export const http = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T = unknown>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", json }),
  put: <T = unknown>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", json }),
  patch: <T = unknown>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", json }),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
