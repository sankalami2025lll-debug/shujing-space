/**
 * 模块：模型接口封装 api/models.ts
 * 用途：封装模型列表/详情读接口、发布模型与点赞/收藏写接口；统一基于 http.ts。
 * 对应后端：ModelsModule（GET /api/models、GET /api/models/:id、POST /api/models、InteractionsController）
 */
import { http } from "../http";
import type {
  CreateModelPayload,
  FavoriteResult,
  LikeResult,
  ModelDetail,
  ModelListItem,
  PaginatedResponse,
} from "../types";

export type ModelEditPayload = {
  title?: string;
  description?: string;
  coverUrl?: string;
};

// ModelSort：后端排序枚举（latest / views / favorites / recommended）
export type ModelSort = "latest" | "views" | "favorites" | "recommended";

// GetModelsParams：模型列表查询入参，对齐后端 QueryModelsDto
export interface GetModelsParams {
  type?: string;
  keyword?: string;
  sort?: ModelSort;
  page?: number;
  pageSize?: number;
}

// getModels：查询模型列表，返回 { list, total, page, pageSize }
export function getModels(
  params: GetModelsParams = {},
): Promise<PaginatedResponse<ModelListItem>> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  return http.get<PaginatedResponse<ModelListItem>>(
    `/models${query ? `?${query}` : ""}`,
  );
}

// getModelDetail：按 id 查询模型详情（模型库迁移后复用）
export function getModelDetail(id: number): Promise<ModelDetail> {
  return http.get<ModelDetail>(`/models/${id}`);
}

// ViewResult：浏览量打点返回结构（最新 viewsCount）
export interface ViewResult {
  viewsCount: number;
}

/**
 * recordModelView：记录模型浏览量（POST /api/models/:id/view，2E）。
 * 游客/登录均可调用，无需鉴权；仅对已发布+公开模型 +1，返回最新 viewsCount。
 * 详情页打开时调用一次；本阶段不做防刷/去重。
 */
export function recordModelView(id: number): Promise<ViewResult> {
  return http.post<ViewResult>(`/models/${id}/view`);
}

/**
 * createModel：发布模型（POST /api/models，需登录）。
 * 可仅传 viewerUrl（外链 iframe 发布，无需 R2 文件）；或传 modelFileId/coverFileId（须先走 uploads 直传）。
 * 对应后端：ModelsService.create + CreateModelDto。
 */
export function createModel(payload: CreateModelPayload): Promise<ModelDetail> {
  return http.post<ModelDetail>("/models", payload);
}

/**
 * 点赞 / 收藏写接口（均需登录，后端 JwtAuthGuard；未登录 → 401，由 http.ts 清 token、调用方提示）。
 * 后端事务内维护明细表 + 计数字段，幂等；返回最新 liked/favorited 与计数，前端据此校正本地按钮态与角标。
 */

// likeModel：点赞模型，返回 { liked:true, likesCount }
export function likeModel(id: number): Promise<LikeResult> {
  return http.post<LikeResult>(`/models/${id}/like`);
}

// unlikeModel：取消点赞，返回 { liked:false, likesCount }
export function unlikeModel(id: number): Promise<LikeResult> {
  return http.delete<LikeResult>(`/models/${id}/like`);
}

// favoriteModel：收藏模型，返回 { favorited:true, favoritesCount }
export function favoriteModel(id: number): Promise<FavoriteResult> {
  return http.post<FavoriteResult>(`/models/${id}/favorite`);
}

// unfavoriteModel：取消收藏，返回 { favorited:false, favoritesCount }
export function unfavoriteModel(id: number): Promise<FavoriteResult> {
  return http.delete<FavoriteResult>(`/models/${id}/favorite`);
}

// updateModel：编辑模型基础信息（PATCH /api/models/:id，需登录且仅作者可调用）。
export function updateModel(
  id: number,
  payload: ModelEditPayload,
): Promise<ModelDetail> {
  return http.patch<ModelDetail>(`/models/${id}`, payload);
}
