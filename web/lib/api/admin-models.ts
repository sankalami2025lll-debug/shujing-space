/**
 * 模块：后台模型管理接口封装 admin-models.ts
 * 用途：封装 /api/admin/models 的列表、详情、审核与软删除接口，供 /admin/models 页面复用。
 * 说明：仅前端对接既有 Admin API，不改后端行为。
 */
import { http } from "../http";
import type {
  AdminModel,
  DeleteAdminModelPayload,
  DeleteModelResult,
  GetAdminModelsParams,
  PaginatedResponse,
  UpdateAdminModelStatusPayload,
} from "../types";

export function getAdminModels(
  params: GetAdminModelsParams = {},
): Promise<PaginatedResponse<AdminModel>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));

  const query = qs.toString();
  return http.get<PaginatedResponse<AdminModel>>(
    `/admin/models${query ? `?${query}` : ""}`,
  );
}

export function getAdminModelDetail(id: number): Promise<AdminModel> {
  return http.get<AdminModel>(`/admin/models/${id}`);
}

export function updateAdminModelStatus(
  id: number,
  payload: UpdateAdminModelStatusPayload,
): Promise<AdminModel> {
  return http.patch<AdminModel>(`/admin/models/${id}/status`, payload);
}

export function deleteAdminModel(
  id: number,
  payload?: DeleteAdminModelPayload,
): Promise<DeleteModelResult> {
  return http.delete<DeleteModelResult>(`/admin/models/${id}`, {
    json: payload,
  });
}
