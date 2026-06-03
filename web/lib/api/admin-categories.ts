/**
 * 模块：后台分类管理接口封装 admin-categories.ts
 * 用途：封装 /api/admin/categories 的列表、增改删接口。
 */
import { http } from "../http";
import type {
  AdminCategory,
  CreateAdminCategoryPayload,
  DeleteAdminCategoryResult,
  UpdateAdminCategoryPayload,
} from "../types";

export function getAdminCategories(): Promise<AdminCategory[]> {
  return http.get<AdminCategory[]>("/admin/categories");
}

export function createAdminCategory(
  payload: CreateAdminCategoryPayload,
): Promise<AdminCategory> {
  return http.post<AdminCategory>("/admin/categories", payload);
}

export function updateAdminCategory(
  id: number,
  payload: UpdateAdminCategoryPayload,
): Promise<AdminCategory> {
  return http.put<AdminCategory>(`/admin/categories/${id}`, payload);
}

export function deleteAdminCategory(
  id: number,
): Promise<DeleteAdminCategoryResult> {
  return http.delete<DeleteAdminCategoryResult>(`/admin/categories/${id}`);
}
