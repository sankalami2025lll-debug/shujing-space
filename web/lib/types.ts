/**
 * 模块：API 基础类型 types.ts
 * 用途：集中声明前端与后端交互的通用类型与核心业务实体类型，供 http.ts、各 api/* 封装与页面复用。
 * 说明：字段命名对齐后端 NestJS 返回的 VM（见 docs/backend-architecture-plan.md「五、API 接口清单」
 *       与 dev-checkpoint 各模块小节）。Next.js 迁移阶段 0–2 自 Vite 原型 src/lib/types.ts 平移。
 */

// ApiResponse：后端统一响应体 { code, message, data }；code===0 表示成功。
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// PaginatedResponse：后端统一分页结构（GET /api/models、/users/me/* 等列表接口返回）。
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// UserRole：系统权限角色（后端 Prisma enum UserRole）。
export type UserRole = "user" | "admin";
// UserStatus：账号状态（后端 Prisma enum UserStatus）。
export type UserStatus = "active" | "disabled";

// User：登录用户信息（GET /api/auth/me、注册/登录返回的 user，已脱敏不含 passwordHash）。
export interface User {
  id: number;
  phone?: string | null;
  email?: string | null;
  nickname: string;
  company?: string | null;
  roleType?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string;
}

// AuthResult：注册 / 登录成功返回（accessToken + 用户信息）。
export interface AuthResult {
  accessToken: string;
  user: User;
}

// Category：模型分类（GET /api/categories 返回，已裁剪后台字段）。
export interface Category {
  id: number;
  name: string;
  slug: string;
  sort: number;
}

// ViewerType：模型在线查看器来源（后端当前为 Prisma enum；前端额外兼容未来可能下发的 lcc）。
export type ViewerType = "iframe" | "sketchfab" | "native" | "none" | "lcc";
export type ModelVisibility = "public" | "private" | "review";
export type ModelStatus = "draft" | "pending" | "published" | "rejected";
export type ModelProcessingStatus = "uploaded" | "processing" | "ready" | "failed";

export interface ModelListItem {
  id: number;
  title: string;
  type: string;
  tags: string[];
  author: string;
  coverUrl: string;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  viewerType: ViewerType;
  createdAt: string;
  processingStatus: ModelProcessingStatus;
  isLiked?: boolean;
  isFavorited?: boolean;
}

export interface ModelDetail extends ModelListItem {
  userId: number;
  description: string;
  scenes: string[];
  viewerUrl: string | null;
  allowIframe: boolean;
  fileFormat: string | null;
  category: Category | null;
  processingStatus: ModelProcessingStatus;
  /** 仅作者查看自己的非公开模型详情时由后端附带（2F）；公开详情不含 */
  status?: ModelStatus;
  visibility?: ModelVisibility;
  rejectReason?: string | null;
  processingError?: string | null;
  processedAt?: string | null;
}

export type FileKind = "model" | "cover" | "video";

export interface PresignResult {
  uploadUrl: string;
  objectKey: string;
  r2Key: string;
  publicUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}

export interface UploadCallbackResult {
  fileId: number;
  url: string;
  r2Key: string;
  kind: FileKind;
}

export interface CreateModelPayload {
  title: string;
  type: string;
  scenes?: string[];
  description?: string;
  visibility: ModelVisibility;
  modelFileId?: number;
  coverFileId?: number;
  viewerUrl?: string;
  viewerType?: ViewerType;
  allowIframe?: boolean;
}

// SiteConfig：全站配置（GET /api/site-config，Footer 联系方式 / 备案 / 公司名 / 版权文案）。
export interface SiteConfig {
  phone: string;
  email: string;
  address: string;
  icp: string;
  companyName: string;
  footerText: string;
}

export interface LikeResult {
  liked: boolean;
  likesCount: number;
}

export interface FavoriteResult {
  favorited: boolean;
  favoritesCount: number;
}

export interface DeleteModelResult {
  id: number;
  deleted: true;
  deletedAt: string;
}

export interface MyModel {
  id: number;
  title: string;
  type: string;
  tags: string[];
  coverUrl: string;
  viewerType: ViewerType;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  visibility: ModelVisibility;
  status: ModelStatus;
  processingStatus: ModelProcessingStatus;
  processingError: string | null;
  processedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyFavorite {
  id: number;
  title: string;
  type: string;
  tags: string[];
  author: string;
  coverUrl: string;
  viewerType: ViewerType;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  createdAt: string;
  isFavorited: boolean;
  isAvailable: boolean;
  favoritedAt: string;
}

export interface MyApplication {
  id: number;
  contactName: string;
  contactWay: string;
  company: string;
  robotType: string;
  trainTasks: string[];
  sceneDesc: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeStats {
  models: number;
  published: number;
  pending: number;
  rejected: number;
  favorites: number;
  applications: number;
}

export interface ContactOptions {
  scenes: string[];
  dataTypes: string[];
  stages: string[];
  budgets: string[];
}

export interface CreateLeadPayload {
  name: string;
  contactWay: string;
  company?: string;
  email?: string;
  scene?: string;
  dataTypes?: string[];
  stage?: string;
  budget?: string;
  message?: string;
}

export interface LeadReceipt {
  id: number;
  status: string;
  createdAt: string;
}

export interface CreateTrainingApplicationPayload {
  contactName: string;
  contactWay: string;
  company: string;
  robotType: string;
  trainTasks?: string[];
  sceneDesc: string;
}

export interface ApplicationReceipt {
  id: number;
  status: string;
  createdAt: string;
}

// ============================== Admin / Models ==============================

export type AdminModelStatusFilter = "all" | "draft" | "pending" | "published" | "rejected";
export type ModelReviewAction = "approve" | "reject";
export type ModelProcessingAction = "mark_ready" | "mark_failed";

export interface AdminModelCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AdminModel {
  id: number;
  title: string;
  type: string;
  tags: string[];
  scenes: string[];
  description: string;
  userId: number;
  author: string;
  category: AdminModelCategory | null;
  coverUrl: string;
  viewerUrl: string | null;
  viewerType: ViewerType;
  allowIframe: boolean;
  fileFormat: string | null;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  visibility: ModelVisibility;
  status: ModelStatus;
  processingStatus: ModelProcessingStatus;
  processingError: string | null;
  processedAt: string | null;
  deletedAt: string | null;
  deletedBy: number | null;
  rejectReason: string | null;
  deleteReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetAdminModelsParams {
  status?: AdminModelStatusFilter;
  type?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateAdminModelStatusPayload {
  action: ModelReviewAction;
  rejectReason?: string;
}

export interface UpdateAdminModelProcessingPayload {
  action: ModelProcessingAction;
  reason?: string;
}

export interface DeleteAdminModelPayload {
  deleteReason?: string;
}

// ============================== Admin / Leads ===============================

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "quoted"
  | "won"
  | "lost";

export interface AdminLead {
  id: number;
  name: string;
  contactWay: string;
  company: string | null;
  email: string | null;
  scene: string | null;
  dataTypes: unknown;
  stage: string | null;
  budget: string | null;
  message: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GetAdminLeadsParams {
  status?: LeadStatus | "all";
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateAdminLeadStatusPayload {
  status: LeadStatus;
}

// ============================ Admin / Training ==============================

export type TrainingStatus =
  | "submitted"
  | "contacted"
  | "evaluating"
  | "quoted"
  | "closed";

export interface AdminTrainingApplication {
  id: number;
  userId: number | null;
  applicant: string | null;
  contactName: string;
  contactWay: string;
  company: string;
  robotType: string;
  trainTasks: unknown;
  sceneDesc: string;
  status: TrainingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GetAdminTrainingParams {
  status?: TrainingStatus | "all";
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateAdminTrainingStatusPayload {
  status: TrainingStatus;
}

// ============================== Admin / Users ===============================

export interface AdminUser {
  id: number;
  nickname: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  roleType: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetAdminUsersParams {
  keyword?: string;
  role?: UserRole | "all";
  status?: UserStatus | "all";
  page?: number;
  pageSize?: number;
}

export interface UpdateAdminUserPayload {
  status?: UserStatus;
  role?: UserRole;
}

// ============================ Admin / Categories ============================

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  sort: number;
  isActive: boolean;
  modelCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminCategoryPayload {
  name: string;
  slug: string;
  sort?: number;
  isActive?: boolean;
}

export interface UpdateAdminCategoryPayload {
  name?: string;
  slug?: string;
  sort?: number;
  isActive?: boolean;
}

export interface DeleteAdminCategoryResult {
  id: number;
  deleted: true;
}

// =========================== Admin / Site Config ============================

export type SiteConfigFieldKey =
  | "phone"
  | "email"
  | "address"
  | "icp"
  | "companyName"
  | "footerText";

export interface UpdateAdminSiteConfigPayload {
  items: Array<{
    key: SiteConfigFieldKey;
    value: string;
  }>;
}
