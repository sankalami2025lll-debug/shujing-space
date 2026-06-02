/**
 * 模块：模型分类接口封装 api/categories.ts
 * 用途：GET /api/categories，供模型库列表页分类筛选
 * 对应后端：CategoriesModule
 */
import { http } from "../http";
import type { Category } from "../types";

// getCategories：拉取启用中的分类；公开接口 auth:false
export function getCategories(): Promise<Category[]> {
  return http.get<Category[]>("/categories", { auth: false });
}
