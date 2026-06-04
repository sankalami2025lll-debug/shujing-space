/**
 * 模块：API 基础类型 types.ts
 * 用途：集中声明前端与后端交互的通用类型与核心业务实体类型，供 http.ts、各 api/* 封装与页面复用。
 * 说明：字段命名对齐后端 NestJS 返回的 VM（见 docs/backend-architecture-plan.md「五、API 接口清单」
 *       与 dev-checkpoint 各模块小节）。本步为基础设施，类型以最小可用为准，后续接入具体页面时按需细化。
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
// 字段对齐后端 AuthService.UserVm：id/nickname/role/status/phone/email/company/roleType/avatarUrl/createdAt。
export interface User {
  id: number;
  phone?: string | null;
  email?: string | null;
  nickname: string;
  company?: string | null;
  // roleType：注册时填写的角色 / 需求类型（对应注册表单「使用目的」），后端 me 返回该字段。
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

// ViewerType：模型在线查看器来源（后端 Prisma enum ViewerType）。
export type ViewerType = "iframe" | "sketchfab" | "native" | "none";
// ModelVisibility：模型可见性（公开 / 仅自己 / 审核后公开）。
export type ModelVisibility = "public" | "private" | "review";
// ModelStatus：模型审核状态。
export type ModelStatus = "draft" | "pending" | "published" | "rejected";

// ModelListItem：模型列表项（GET /api/models 列表轻量结构，不含 description/viewerUrl）。
// 注意：后端不返回前端封面视觉字段 color/pattern，需前端按 type 用 coverStyleByType 推导（见 format.ts）。
export interface ModelListItem {
  id: number;
  title: string;
  type: string;
  tags: string[];
  author: string;
  // coverUrl：封面图 URL（后端 models.cover_url，当前未接 R2 多为空串；前端封面仍用渐变占位）
  coverUrl: string;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  viewerType: ViewerType;
  createdAt: string;
  // 仅登录态返回；游客响应不含这两个字段。
  isLiked?: boolean;
  isFavorited?: boolean;
}

// ModelDetail：模型详情（GET /api/models/:id 完整结构）。
// viewerUrl 由后端 models.model_url 映射而来；allowIframe 用于 iframe 内嵌兜底判断。
export interface ModelDetail extends ModelListItem {
  description: string;
  scenes: string[];
  viewerUrl: string | null;
  allowIframe: boolean;
  fileFormat: string | null;
  category: Category | null;
}

// FileKind：上传文件用途（对齐后端 Prisma FileKind / presign DTO）。
export type FileKind = "model" | "cover" | "video";

// PresignResult：POST /api/uploads/presign 返回，供浏览器直传 R2（PUT uploadUrl）。
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

// UploadCallbackResult：POST /api/uploads/callback 返回，登记 model_files 后的 fileId。
export interface UploadCallbackResult {
  fileId: number;
  url: string;
  r2Key: string;
  kind: FileKind;
}

// CreateModelPayload：POST /api/models 发布入参（对齐后端 CreateModelDto）。
export interface CreateModelPayload {
  title: string; // 模型名称（必填）
  type: string; // 分类名（必填，服务端按 categories.name 反查）
  scenes?: string[]; // 应用场景多选（可选）
  description?: string; // 简介（可选）
  visibility: ModelVisibility; // 发布权限 public/private/review
  modelFileId?: number; // 已上传模型文件 id（uploads/callback 返回）
  coverFileId?: number; // 已上传封面 id（可选）
  viewerUrl?: string; // 外部 Viewer 链接（https，与 modelFileId 二选一）
  viewerType?: ViewerType; // 查看器来源；外链发布建议 iframe
  allowIframe?: boolean; // 是否允许 iframe 内嵌，默认 true
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

// LikeResult：点赞 / 取消点赞接口返回（POST|DELETE /api/models/:id/like）。
// 后端事务内维护明细 + likesCount，幂等；前端用 likesCount 校正本地角标。
export interface LikeResult {
  liked: boolean; // true=已点赞，false=已取消
  likesCount: number; // 最新点赞总数
}

// FavoriteResult：收藏 / 取消收藏接口返回（POST|DELETE /api/models/:id/favorite）。
export interface FavoriteResult {
  favorited: boolean; // true=已收藏，false=已取消
  favoritesCount: number; // 最新收藏总数
}

// MyModel：我的模型 / 我的发布列表项（GET /api/users/me/models|published，本人视角，含审核字段）。
// 对应后端 users.vm.ts 的 MyModelVm；日期经 JSON 序列化为 ISO 字符串。
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
  visibility: ModelVisibility; // public / private / review
  status: ModelStatus; // draft / pending / published / rejected
  rejectReason: string | null; // 被驳回时的原因
  createdAt: string;
  updatedAt: string;
}

// MyFavorite：我的收藏列表项（GET /api/users/me/favorites）。
// 对应后端 MyFavoriteVm；isAvailable=false 表示模型已被下架/转私有，需灰显并禁止进入详情。
export interface MyFavorite {
  id: number; // 模型 id
  title: string;
  type: string;
  tags: string[];
  author: string; // 模型发布者昵称
  coverUrl: string;
  viewerType: ViewerType;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  createdAt: string; // 模型创建时间
  isFavorited: boolean; // 恒 true（本就是收藏列表）
  isAvailable: boolean; // 是否仍 published + public
  favoritedAt: string; // 收藏发生时间
}

// MyApplication：我的训练数据服务申请列表项（GET /api/users/me/applications）。
// 对应后端 MyApplicationVm；仅「具身智能机器人训练场景」一种业务类型。
export interface MyApplication {
  id: number;
  contactName: string;
  contactWay: string;
  company: string;
  robotType: string;
  trainTasks: string[]; // 训练任务多选
  sceneDesc: string;
  status: string; // submitted / contacted / evaluating / quoted / closed
  createdAt: string;
  updatedAt: string;
}

// MeStats：个人中心统计角标（GET /api/users/me/stats）。
export interface MeStats {
  models: number; // 我的模型总数（全部状态）
  published: number; // 已发布
  pending: number; // 审核中
  rejected: number; // 已驳回
  favorites: number; // 我的收藏
  applications: number; // 我的训练申请
}

// ContactOptions：联系我们表单选项（GET /api/contact/options，对齐后端 ContactOptions）。
// 接口失败时前端回退到 ContactPage 写死的默认选项数组。
export interface ContactOptions {
  scenes: string[]; // 业务场景（下拉单选）
  dataTypes: string[]; // 所需数据类型（多选标签）
  stages: string[]; // 项目阶段（单选标签）
  budgets: string[]; // 预算范围（下拉单选）
}

// CreateLeadPayload：提交联系线索入参（POST /api/contact/leads，对齐后端 CreateLeadDto）。
// name/contactWay 必填，email 选填但填写须合法；其余为可选；空值不传由后端存 null。
export interface CreateLeadPayload {
  name: string; // 姓名（必填）
  contactWay: string; // 手机 / 微信（必填）
  company?: string; // 公司名称（可选）
  email?: string; // 联系邮箱（可选，填写须合法）
  scene?: string; // 业务场景（可选）
  dataTypes?: string[]; // 所需数据类型（可选，多选）
  stage?: string; // 项目阶段（可选）
  budget?: string; // 预算范围（可选）
  message?: string; // 项目需求描述（可选）
}

// LeadReceipt：联系线索提交回执（后端固定 status=new）。
export interface LeadReceipt {
  id: number;
  status: string;
  createdAt: string;
}

// CreateTrainingApplicationPayload：提交训练数据服务申请入参（POST /api/training-applications，对齐后端 CreateTrainingApplicationDto）。
// 仅服务「具身智能机器人训练场景」；不含 serviceType/status/userId（userId 由后端按登录态回填）。
export interface CreateTrainingApplicationPayload {
  contactName: string; // 联系人（必填）
  contactWay: string; // 手机 / 微信（必填）
  company: string; // 公司名称（必填）
  robotType: string; // 机器人类型（必填）
  trainTasks?: string[]; // 训练任务（可选，多选）
  sceneDesc: string; // 场景需求描述（必填）
}

// ApplicationReceipt：训练申请提交回执（后端固定 status=submitted）。
export interface ApplicationReceipt {
  id: number;
  status: string;
  createdAt: string;
}
