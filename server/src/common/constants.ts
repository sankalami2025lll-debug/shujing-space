/**
 * 通用常量：统一响应码定义。
 * 约定：code=0 表示成功，非 0 表示业务/系统错误（沿用 HTTP 状态码作为错误码便于排查）。
 */
export const RESPONSE_CODE = {
  SUCCESS: 0,
} as const;

// 统一成功响应体结构
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
