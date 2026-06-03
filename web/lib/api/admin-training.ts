/**
 * 模块：后台训练申请接口封装 admin-training.ts
 * 用途：封装 /api/admin/training-applications 的列表与状态流转接口。
 */
import { http } from "../http";
import type {
  AdminTrainingApplication,
  GetAdminTrainingParams,
  PaginatedResponse,
  UpdateAdminTrainingStatusPayload,
} from "../types";

export function getAdminTrainingApplications(
  params: GetAdminTrainingParams = {},
): Promise<PaginatedResponse<AdminTrainingApplication>> {
  const qs = new URLSearchParams();
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));

  const query = qs.toString();
  return http.get<PaginatedResponse<AdminTrainingApplication>>(
    `/admin/training-applications${query ? `?${query}` : ""}`,
  );
}

export function updateAdminTrainingStatus(
  id: number,
  payload: UpdateAdminTrainingStatusPayload,
): Promise<AdminTrainingApplication> {
  return http.patch<AdminTrainingApplication>(
    `/admin/training-applications/${id}/status`,
    payload,
  );
}
