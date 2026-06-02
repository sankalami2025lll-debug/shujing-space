/**
 * 模块：模型分类接口封装 api/categories.ts
 * 用途：封装 GET /api/categories（公开接口），供模型库列表页分类筛选使用。
 * 对应后端：CategoriesModule（GET /api/categories，仅返回 isActive=true，按 sort 升序）。
 */
import { http } from "../http";
import type { Category } from "../types";

// getCategories：拉取启用中的模型分类列表；公开接口无需登录（auth:false 避免无谓携带 token）。
//   返回的 name（实景三维 / BIM 模型 / 构件级模型 / 具身智能机器人训练场景）即作为分类筛选按钮文案，
//   前端再在最前面补一个「全部模型」（不过滤）。
export function getCategories(): Promise<Category[]> {
  return http.get<Category[]>("/categories", { auth: false });
}
