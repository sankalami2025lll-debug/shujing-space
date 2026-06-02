/**
 * 视图模型 / 映射：后台管理（Admin）接口对外字段
 * 用途：把 Prisma 实体裁剪为后台各管理模块的对外视图，统一 BigInt（id/userId 等）→ number。
 * 约定：
 *  - AdminModelVm：后台模型（全状态可见，含 status / visibility / rejectReason / 发布者）。
 *  - AdminUserVm：后台用户（严格脱敏，绝不返回 passwordHash）。
 *  - AdminCategoryVm：后台分类（含 isActive 等后台字段，区别于游客 CategoryVm）。
 *  - AdminLeadVm：后台联系线索（全字段）。
 *  - AdminApplicationVm：后台训练数据服务申请（全字段，含 userId 便于区分游客/用户）。
 */
import {
  Category,
  ContactLead,
  Model,
  ModelStatus,
  ModelVisibility,
  TrainingApplication,
  TrainingStatus,
  User,
  UserRole,
  UserStatus,
  ViewerType,
} from '@prisma/client';

// 模型查询时附带的关联（发布者昵称 + 分类信息）
type ModelWithRelations = Model & {
  user?: Pick<User, 'id' | 'nickname'> | null;
  category?: Pick<Category, 'id' | 'name' | 'slug'> | null;
};

// 申请查询时附带的关联（申请人昵称，可空：游客申请 user 为 null）
type ApplicationWithUser = TrainingApplication & {
  user?: Pick<User, 'id' | 'nickname'> | null;
};

// ============================== 模型审核 VM ==============================

// 后台模型视图（全状态可见，含审核字段；列表与详情共用，列表不另裁剪以简化）
export interface AdminModelVm {
  id: number;
  title: string;
  type: string;
  tags: unknown; // 标签数组（Json）
  scenes: unknown; // 应用场景数组（Json）
  description: string;
  userId: number; // 发布者 id
  author: string; // 发布者昵称
  category: { id: number; name: string; slug: string } | null;
  coverUrl: string;
  viewerUrl: string | null; // ← models.modelUrl
  viewerType: ViewerType;
  allowIframe: boolean;
  fileFormat: string | null;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  visibility: ModelVisibility; // 可见性
  status: ModelStatus; // 审核状态：draft / pending / published / rejected
  rejectReason: string | null; // 驳回原因
  createdAt: Date;
  updatedAt: Date;
}

// 实体 → 后台模型视图
export function toAdminModelVm(m: ModelWithRelations): AdminModelVm {
  return {
    id: Number(m.id),
    title: m.title,
    type: m.type,
    tags: m.tags,
    scenes: m.scenes,
    description: m.description,
    userId: Number(m.userId),
    author: m.user?.nickname ?? '',
    category: m.category
      ? { id: Number(m.category.id), name: m.category.name, slug: m.category.slug }
      : null,
    coverUrl: m.coverUrl,
    viewerUrl: m.modelUrl ?? null,
    viewerType: m.viewerType,
    allowIframe: m.allowIframe,
    fileFormat: m.fileFormat ?? null,
    viewsCount: m.viewsCount,
    likesCount: m.likesCount,
    favoritesCount: m.favoritesCount,
    visibility: m.visibility,
    status: m.status,
    rejectReason: m.rejectReason ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// ============================== 用户管理 VM ==============================

// 后台用户视图（严格脱敏：不含 passwordHash）
export interface AdminUserVm {
  id: number;
  nickname: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  roleType: string | null;
  role: UserRole; // 系统权限：user / admin
  status: UserStatus; // 账号状态：active / disabled
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 实体 → 后台用户视图（显式挑字段，杜绝 passwordHash 泄露）
export function toAdminUserVm(u: User): AdminUserVm {
  return {
    id: Number(u.id),
    nickname: u.nickname,
    phone: u.phone ?? null,
    email: u.email ?? null,
    company: u.company ?? null,
    roleType: u.roleType ?? null,
    role: u.role,
    status: u.status,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

// ============================== 分类管理 VM ==============================

// 后台分类视图（含 isActive 等后台字段；附 modelCount 便于后台判断能否删除）
export interface AdminCategoryVm {
  id: number;
  name: string;
  slug: string;
  sort: number;
  isActive: boolean;
  modelCount?: number; // 关联模型数（列表附带，便于前端提示能否删除）
  createdAt: Date;
  updatedAt: Date;
}

// 实体 → 后台分类视图（modelCount 可选注入）
export function toAdminCategoryVm(c: Category, modelCount?: number): AdminCategoryVm {
  return {
    id: Number(c.id),
    name: c.name,
    slug: c.slug,
    sort: c.sort,
    isActive: c.isActive,
    ...(modelCount != null ? { modelCount } : {}),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// ============================== 联系线索管理 VM ==============================

// 后台联系线索视图（全字段）
export interface AdminLeadVm {
  id: number;
  name: string;
  contactWay: string;
  company: string | null;
  email: string | null;
  scene: string | null;
  dataTypes: unknown; // 数据类型多选（Json）
  stage: string | null;
  budget: string | null;
  message: string;
  status: string; // 线索状态：new / contacted / qualified / quoted / won / lost
  createdAt: Date;
  updatedAt: Date;
}

// 实体 → 后台联系线索视图
export function toAdminLeadVm(l: ContactLead): AdminLeadVm {
  return {
    id: Number(l.id),
    name: l.name,
    contactWay: l.contactWay,
    company: l.company ?? null,
    email: l.email ?? null,
    scene: l.scene ?? null,
    dataTypes: l.dataTypes,
    stage: l.stage ?? null,
    budget: l.budget ?? null,
    message: l.message,
    status: l.status,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

// ============================== 训练申请管理 VM ==============================

// 后台训练数据服务申请视图（全字段，含 userId/申请人，区分游客 null）
export interface AdminApplicationVm {
  id: number;
  userId: number | null; // 申请人 id（游客提交为 null）
  applicant: string | null; // 申请人昵称（游客为 null）
  contactName: string;
  contactWay: string;
  company: string;
  robotType: string;
  trainTasks: unknown; // 训练任务多选（Json）
  sceneDesc: string;
  status: TrainingStatus; // submitted / contacted / evaluating / quoted / closed
  createdAt: Date;
  updatedAt: Date;
}

// 实体 → 后台训练申请视图
export function toAdminApplicationVm(a: ApplicationWithUser): AdminApplicationVm {
  return {
    id: Number(a.id),
    userId: a.userId != null ? Number(a.userId) : null,
    applicant: a.user?.nickname ?? null,
    contactName: a.contactName,
    contactWay: a.contactWay,
    company: a.company,
    robotType: a.robotType,
    trainTasks: a.trainTasks,
    sceneDesc: a.sceneDesc,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
