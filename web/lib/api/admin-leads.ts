/**
 * 模块：后台联系线索接口封装 admin-leads.ts
 * 用途：封装 /api/admin/leads 的列表与状态流转接口。
 */
import { http } from "../http";
import type {
  AdminLead,
  GetAdminLeadsParams,
  PaginatedResponse,
  UpdateAdminLeadStatusPayload,
} from "../types";

export function getAdminLeads(
  params: GetAdminLeadsParams = {},
): Promise<PaginatedResponse<AdminLead>> {
  const qs = new URLSearchParams();
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));

  const query = qs.toString();
  return http.get<PaginatedResponse<AdminLead>>(
    `/admin/leads${query ? `?${query}` : ""}`,
  );
}

export function updateAdminLeadStatus(
  id: number,
  payload: UpdateAdminLeadStatusPayload,
): Promise<AdminLead> {
  return http.patch<AdminLead>(`/admin/leads/${id}/status`, payload);
}
