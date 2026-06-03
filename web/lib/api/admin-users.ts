/**
 * 模块：后台用户管理接口封装 admin-users.ts
 * 用途：封装 /api/admin/users 的列表与状态/角色更新接口。
 */
import { http } from "../http";
import type {
  AdminUser,
  GetAdminUsersParams,
  PaginatedResponse,
  UpdateAdminUserPayload,
} from "../types";

export function getAdminUsers(
  params: GetAdminUsersParams = {},
): Promise<PaginatedResponse<AdminUser>> {
  const qs = new URLSearchParams();
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.role && params.role !== "all") qs.set("role", params.role);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));

  const query = qs.toString();
  return http.get<PaginatedResponse<AdminUser>>(
    `/admin/users${query ? `?${query}` : ""}`,
  );
}

export function updateAdminUserStatus(
  id: number,
  payload: UpdateAdminUserPayload,
): Promise<AdminUser> {
  return http.patch<AdminUser>(`/admin/users/${id}/status`, payload);
}
