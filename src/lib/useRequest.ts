/**
 * 模块：通用请求三态 Hook useRequest.ts
 * 用途：为页面/表单统一提供 loading / error / data 三态与手动触发能力，避免每处重复写 try-catch 与状态管理。
 * 设计：默认不自动执行（manual），由 run() 触发；适合表单提交、点击加载、按需查询。
 *       需要挂载即拉取时，调用方在 useEffect 里调用 run() 即可（基础设施步骤不内置 auto，保持简单可控）。
 */
import { useCallback, useRef, useState } from "react";
import { ApiError } from "./http";

// UseRequestState：请求状态快照。
export interface UseRequestState<T> {
  data: T | null; // 最近一次成功返回的数据
  loading: boolean; // 是否正在请求中
  error: ApiError | null; // 最近一次失败的错误（统一为 ApiError）
}

// UseRequestResult：useRequest 返回值，状态 + run/reset 控制方法。
export interface UseRequestResult<T, Args extends unknown[]> extends UseRequestState<T> {
  // run：执行请求函数；成功返回 data，失败返回 null（错误同时写入 error 状态）。
  run: (...args: Args) => Promise<T | null>;
  // reset：清空 data/error 并复位 loading。
  reset: () => void;
}

/**
 * useRequest：包装一个返回 Promise 的异步函数（通常是 api/* 调用），统一管理三态。
 * @param fn 实际发起请求的异步函数
 */
export function useRequest<T, Args extends unknown[] = []>(
  fn: (...args: Args) => Promise<T>,
): UseRequestResult<T, Args> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // fnRef：保存最新的请求函数引用，避免因 fn 每次渲染变化导致 run 频繁重建。
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // requestId：并发/竞态保护——仅最后一次 run 的结果允许写入状态。
  const requestIdRef = useRef(0);

  const run = useCallback(async (...args: Args): Promise<T | null> => {
    const currentId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      if (currentId === requestIdRef.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (e) {
      // 统一收敛为 ApiError；非 ApiError（理论上少见）包一层兜底文案。
      const apiError =
        e instanceof ApiError ? e : new ApiError("未知错误，请稍后重试。", -1, 0);
      if (currentId === requestIdRef.current) {
        setError(apiError);
        setLoading(false);
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current++;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, run, reset };
}
