/**
 * 视图模型 / 映射：个人中心接口对外字段
 * 用途：把 Prisma 实体裁剪为个人中心各 Tab 的对外视图，并统一 BigInt（id 等）转 number。
 * 约定：
 *  - MyModelVm（我的模型/我的发布）：本人视角，附带 status / visibility / rejectReason 等审核字段（公开列表 VM 不含）。
 *  - MyFavoriteVm（我的收藏）：公开风格 + isFavorited（恒 true）+ isAvailable（是否仍 published+public+未删除）+ favoritedAt。
 *  - MyApplicationVm（我的申请）：训练数据服务申请，含状态流转。
 *  - MeStatsVm（统计角标）：各 Tab 数量。
 */
import {
  Favorite,
  Model,
  ModelStatus,
  ModelVisibility,
  TrainingApplication,
  User,
  ViewerType,
} from '@prisma/client';

// 收藏查询时附带的关联（model + model.user.nickname 用于作者展示）
type ModelWithAuthor = Model & { user?: Pick<User, 'nickname'> | null };
type FavoriteWithModel = Favorite & { model: ModelWithAuthor };

// 我的模型 / 我的发布 列表项（本人视角，含审核字段）
export interface MyModelVm {
  id: number;
  title: string;
  type: string;
  tags: unknown; // 标签数组（Json）
  coverUrl: string;
  viewerType: ViewerType;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  visibility: ModelVisibility; // 可见性：public / private / review
  status: ModelStatus; // 审核状态：draft / pending / published / rejected
  rejectReason: string | null; // 驳回原因（被拒时展示）
  createdAt: Date;
  updatedAt: Date;
}

// 我的收藏 列表项（公开风格 + 收藏态 + 可用性）
export interface MyFavoriteVm {
  id: number; // 模型 id
  title: string;
  type: string;
  tags: unknown;
  author: string; // 模型发布者昵称
  coverUrl: string;
  viewerType: ViewerType;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  createdAt: Date; // 模型创建时间
  isFavorited: boolean; // 恒 true（本就是收藏列表）
  isAvailable: boolean; // 是否仍 published + public + 未删除（软删除/下架/转私有则 false）
  favoritedAt: Date; // 收藏发生时间（favorites.createdAt）
}

// 我的训练数据服务申请 列表项
export interface MyApplicationVm {
  id: number;
  contactName: string;
  contactWay: string;
  company: string;
  robotType: string;
  trainTasks: unknown; // 训练任务多选（Json）
  sceneDesc: string;
  status: string; // 申请状态流转：submitted / contacted / evaluating / quoted / closed
  createdAt: Date;
  updatedAt: Date;
}

// 个人中心统计角标
export interface MeStatsVm {
  models: number; // 我的模型总数（全部状态）
  published: number; // 已发布
  pending: number; // 审核中
  rejected: number; // 已驳回
  favorites: number; // 我的收藏
  applications: number; // 我的训练申请
}

// 实体 → 我的模型/发布视图
export function toMyModelVm(m: Model): MyModelVm {
  return {
    id: Number(m.id),
    title: m.title,
    type: m.type,
    tags: m.tags,
    coverUrl: m.coverUrl,
    viewerType: m.viewerType,
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

// 实体（收藏 + 关联模型）→ 我的收藏视图
export function toMyFavoriteVm(f: FavoriteWithModel): MyFavoriteVm {
  const m = f.model;
  return {
    id: Number(m.id),
    title: m.title,
    type: m.type,
    tags: m.tags,
    author: m.user?.nickname ?? '',
    coverUrl: m.coverUrl,
    viewerType: m.viewerType,
    viewsCount: m.viewsCount,
    likesCount: m.likesCount,
    favoritesCount: m.favoritesCount,
    createdAt: m.createdAt,
    isFavorited: true,
    // 是否仍对外可见：已发布 + 公开 + 未删除
    isAvailable:
      m.status === ModelStatus.published &&
      m.visibility === ModelVisibility.public &&
      m.deletedAt == null,
    favoritedAt: f.createdAt,
  };
}

// 实体 → 我的申请视图
export function toMyApplicationVm(a: TrainingApplication): MyApplicationVm {
  return {
    id: Number(a.id),
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
