/**
 * 模块：模型接口封装 api/models.ts
 * 用途：封装模型列表与详情读接口，供模型库列表页 ModelLibrary 调用；统一基于 http.ts。
 * 对应后端：ModelsModule（server/src/modules/models）
 *   - GET /api/models       列表（type/keyword/sort/page/pageSize），返回分页结构
 *   - GET /api/models/:id    详情（含 viewerUrl/viewerType/allowIframe 等）
 *   - POST /api/models       发布模型（需登录；UploadModal 使用）
 * 说明：列表/详情后端使用 OptionalJwtAuthGuard，游客可访问；登录态会额外附带 isLiked/isFavorited。
 *       auth 默认 true：有 token 自动带 Bearer，无 token 也能访问读接口；写接口未登录 → 401。
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

// ModelSort：后端排序枚举（latest 最新 / views 热门浏览 / favorites 最多收藏 / recommended 推荐）。
//   前端中文排序按钮需映射为此枚举（见 ModelLibrary 的 SORT_MAP）。
export type ModelSort = "latest" | "views" | "favorites" | "recommended";

// GetModelsParams：模型列表查询入参，对齐后端 QueryModelsDto。
export interface GetModelsParams {
  type?: string; // 分类名（如「实景三维」）；不传或「全部模型」表示不过滤
  keyword?: string; // 关键词（后端匹配标题与作者昵称，不含标签）
  sort?: ModelSort; // 排序方式，默认 latest
  page?: number; // 页码，默认 1
  pageSize?: number; // 每页数量，默认 12，最大 100
}

// getModels：查询模型列表，返回后端统一分页结构 { list, total, page, pageSize }。
export function getModels(
  params: GetModelsParams = {},
): Promise<PaginatedResponse<ModelListItem>> {
  // 仅拼接有值的查询参数，避免传空串影响后端过滤
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

// getModelDetail：按 id 查询模型详情；未找到/不可见时后端返回 404，由调用方处理空状态。
export function getModelDetail(id: number): Promise<ModelDetail> {
  return http.get<ModelDetail>(`/models/${id}`);
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
 * 点赞 / 收藏写接口（均需登录，后端 JwtAuthGuard；未登录 → 401，由 http.ts 清 token、调用方提示登录）。
 * 后端事务内维护明细表 + 计数字段，幂等（重复点赞/收藏不重复加，重复取消不为负）；
 * 返回最新 liked/favorited 与计数，前端据此校正本地按钮态与角标。
 * 对应后端：InteractionsController（POST|DELETE /api/models/:id/like|favorite）。
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
