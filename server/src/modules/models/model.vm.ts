/**
 * 视图模型 / 映射：模型接口对外字段
 * 用途：统一把 Prisma Model 实体（含 user/category 关联）裁剪为对外视图，
 *       并把 BigInt（id/userId）转为 number，规避序列化歧义。
 * 约定：
 *  - 列表项轻量（不含 description / viewerUrl，减小负载），但保留 viewerType 供角标使用。
 *  - 详情项完整，含 viewerUrl(← models.modelUrl) / viewerType / allowIframe 供前端 iframe Viewer 使用。
 *  - 纯前端视觉字段 color / pattern 不入库、不返回，由前端按 type 自行生成。
 *  - views/time 展示字符串由前端格式化，本层只出数值 viewsCount 与 ISO createdAt。
 *  - isLiked / isFavorited 为「当前登录用户是否已点赞/收藏」状态：仅登录态附带，游客时省略；
 *    由可选 interaction 入参注入，映射函数不直接查询数据库（批量查询在 ModelsService 完成，避免 N+1）。
 *  - status / visibility / rejectReason 仅作者查看自己的模型详情时附带（2F），非作者/游客不返回以免泄露。
 */
import {
  Category,
  Model,
  ModelStatus,
  ModelVisibility,
  User,
  ViewerType,
} from '@prisma/client';

// Prisma 查询时附带的关联（author 取自 user.nickname，category 取分类信息）
type ModelWithRelations = Model & {
  user?: Pick<User, 'nickname'> | null;
  category?: Pick<Category, 'id' | 'name' | 'slug'> | null;
};

// 当前用户对某模型的互动状态（点赞/收藏）；仅登录态传入
export interface ModelInteractionFlags {
  isLiked: boolean;
  isFavorited: boolean;
}

// 列表项视图（轻量）
export interface ModelListItemVm {
  id: number;
  title: string;
  type: string;
  tags: unknown; // 标签数组（Json）
  author: string; // 发布者昵称
  coverUrl: string; // 封面 URL（当前可能为空串，未接 R2）
  viewerType: ViewerType; // 查看器来源（iframe/sketchfab/native/none）
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  createdAt: Date;
  isLiked?: boolean; // 当前登录用户是否已点赞（游客不返回）
  isFavorited?: boolean; // 当前登录用户是否已收藏（游客不返回）
}

// 关联分类视图（详情用）
export interface ModelCategoryVm {
  id: number;
  name: string;
  slug: string;
}

// 详情视图（完整）
export interface ModelDetailVm {
  id: number;
  title: string;
  type: string;
  tags: unknown; // 标签数组（Json）
  scenes: unknown; // 应用场景数组（Json）
  description: string;
  author: string; // 发布者昵称
  category: ModelCategoryVm | null; // 关联分类（可空）
  coverUrl: string;
  viewerUrl: string | null; // ← models.modelUrl，详情页 iframe 内嵌地址
  viewerType: ViewerType; // 查看器来源
  allowIframe: boolean; // 是否允许 iframe 内嵌（兜底用）
  fileFormat: string | null; // glb/gltf/ifc/3dtiles/点云
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  createdAt: Date;
  isLiked?: boolean; // 当前登录用户是否已点赞（游客不返回）
  isFavorited?: boolean; // 当前登录用户是否已收藏（游客不返回）
  status?: ModelStatus; // 仅作者查看自己的模型时返回
  visibility?: ModelVisibility; // 仅作者查看自己的模型时返回
  rejectReason?: string | null; // 仅作者查看自己的模型时返回（驳回原因）
}

// 实体 → 列表项视图；interaction 仅登录态传入（附带 isLiked/isFavorited）
export function toModelListItemVm(
  m: ModelWithRelations,
  interaction?: ModelInteractionFlags,
): ModelListItemVm {
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
    ...(interaction
      ? { isLiked: interaction.isLiked, isFavorited: interaction.isFavorited }
      : {}),
  };
}

// 实体 → 详情视图；interaction 仅登录态传入（附带 isLiked/isFavorited）
// includeAuthorFields：true 时为作者本人视角，附带 status / visibility / rejectReason（2F）
export function toModelDetailVm(
  m: ModelWithRelations,
  interaction?: ModelInteractionFlags,
  includeAuthorFields = false,
): ModelDetailVm {
  return {
    id: Number(m.id),
    title: m.title,
    type: m.type,
    tags: m.tags,
    scenes: m.scenes,
    description: m.description,
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
    createdAt: m.createdAt,
    ...(interaction
      ? { isLiked: interaction.isLiked, isFavorited: interaction.isFavorited }
      : {}),
    ...(includeAuthorFields
      ? {
          status: m.status,
          visibility: m.visibility,
          rejectReason: m.rejectReason ?? null,
        }
      : {}),
  };
}
