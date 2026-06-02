/**
 * 模块：个人中心接口封装 api/users.ts
 * 用途：封装个人中心 /api/users/me/* 五个只读接口，供 ModelLibrary 内嵌的 PersonalCenter 调用；统一基于 http.ts。
 * 对应后端：UsersModule（server/src/modules/users）
 *   - GET /api/users/me/models        我的模型（本人全部状态，status 过滤），分页
 *   - GET /api/users/me/published     我的发布（仅 published），分页
 *   - GET /api/users/me/favorites     我的收藏（含 isFavorited/isAvailable/favoritedAt），分页
 *   - GET /api/users/me/applications  我的训练数据服务申请，分页
 *   - GET /api/users/me/stats         个人中心统计角标
 * 说明：五个接口均需登录（后端 JwtAuthGuard），auth 默认 true 自动带 Bearer；未登录访问 → 401。
 */
import { http } from "../http";
import type {
  MeStats,
  MyApplication,
  MyFavorite,
  MyModel,
  PaginatedResponse,
} from "../types";

// MyModelStatus：我的模型 status 过滤值，对齐后端 QueryMyModelsDto（all 不过滤）。
export type MyModelStatus = "all" | "draft" | "pending" | "published" | "rejected";

// PageParams：通用分页入参（page 默认 1，pageSize 默认 12、最大 100）。
export interface PageParams {
  page?: number;
  pageSize?: number;
}

// buildPageQuery：仅拼接有值的分页参数，避免传空影响后端默认值。
function buildPageQuery(params: PageParams & { status?: string } = {}): string {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  return query ? `?${query}` : "";
}

// getMyModels：我的模型（本人全部状态，可按 status 过滤）。
export function getMyModels(
  params: PageParams & { status?: MyModelStatus } = {},
): Promise<PaginatedResponse<MyModel>> {
  return http.get<PaginatedResponse<MyModel>>(`/users/me/models${buildPageQuery(params)}`);
}

// getMyPublished：我的发布（仅 published）。
export function getMyPublished(
  params: PageParams = {},
): Promise<PaginatedResponse<MyModel>> {
  return http.get<PaginatedResponse<MyModel>>(`/users/me/published${buildPageQuery(params)}`);
}

// getMyFavorites：我的收藏（含 isAvailable 标注模型是否仍可用）。
export function getMyFavorites(
  params: PageParams = {},
): Promise<PaginatedResponse<MyFavorite>> {
  return http.get<PaginatedResponse<MyFavorite>>(`/users/me/favorites${buildPageQuery(params)}`);
}

// getMyApplications：我的训练数据服务申请（无数据返回空数组）。
export function getMyApplications(
  params: PageParams = {},
): Promise<PaginatedResponse<MyApplication>> {
  return http.get<PaginatedResponse<MyApplication>>(
    `/users/me/applications${buildPageQuery(params)}`,
  );
}

// getMyStats：个人中心统计角标（各 Tab 数量）。
export function getMyStats(): Promise<MeStats> {
  return http.get<MeStats>(`/users/me/stats`);
}
