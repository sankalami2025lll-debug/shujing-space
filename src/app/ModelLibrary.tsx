/**
 * 页面名称：模型库列表页 ModelLibrary
 * 页面用途：承载大量三维空间模型的浏览、搜索、分类筛选、排序，并提供模型详情、模型发布、训练数据申请与个人中心入口
 * 主要功能：分类筛选（后端 GET /api/categories）、关键词搜索、排序、分页加载（后端 GET /api/models）、模型详情（GET /api/models/:id）、发布模型弹窗、训练数据服务申请弹窗、个人中心子页面
 * 对应文档：页面功能注释文档/05_模型库列表页_ModelLibrary.md
 *           （内含详情页 06_ModelDetail、发布弹窗 07_UploadModal、训练申请 08_TrainingModal、个人中心 09_PersonalCenter，数据结构见 13_communityData）
 * 数据来源：列表/详情已接入后端（第 10C）；发布弹窗已接 uploads + POST /api/models（第 10G）；个人中心已接 /api/users/me/*（第 10D）；communityData 仅保留配色与验收基准。
 */
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { Search, Upload, Eye, Heart, Share2, Bookmark, Grid3X3, RotateCcw, Maximize2, ChevronDown, X, Check, User, FileBox, Star, ClipboardList, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import NavBar from "./NavBar";
import logoSrc from "../imports/____logo_1_.png";
// communityData：类型标签配色；列表/详情/个人中心均已改用后端接口，仅保留配色映射与验收基准。
import { typeTagColor } from "./communityData";
import type {
  ModelListItem,
  ModelDetail,
  MyModel,
  MyFavorite,
  MyApplication,
  MeStats,
  ModelVisibility,
} from "../lib/types";
import {
  getModels,
  getModelDetail,
  createModel,
  likeModel,
  unlikeModel,
  favoriteModel,
  unfavoriteModel,
  type ModelSort,
} from "../lib/api/models";
import { uploadFileToR2 } from "../lib/api/uploads";
import { getCategories } from "../lib/api/categories";
import {
  getMyModels,
  getMyPublished,
  getMyFavorites,
  getMyApplications,
  getMyStats,
} from "../lib/api/users";
// 训练数据服务申请提交接口（TrainingModal 使用；OptionalJwtAuthGuard，游客/登录均可）
import { createTrainingApplication } from "../lib/api/training";
// useAuth：读取登录态，用于点赞/收藏/个人中心的登录拦截
import { useAuth } from "./AuthContext";
import { useSiteConfig } from "./SiteConfigContext";
import { ApiError } from "../lib/http";
// 展示层格式化：浏览量数值→「2.1k」、ISO 时间→「2天前」、按 type 推导封面渐变（补回后端不返回的 color/pattern）。
import { formatViews, formatRelativeTime, coverStyleByType } from "../lib/format";

interface ModelLibraryProps {
  onNavigateHome: () => void;
  onNavigateCommunity: () => void;
  onNavigateAbout: () => void;
  onNavigateContact?: () => void;
  onNavigateAuth?: () => void;
  initialModelId?: number;
}

// MODEL_TYPES：模型分类「降级」静态数组；正常情况下分类来自后端 GET /api/categories，
//   接口失败时回退到此数组保证筛选栏不空白。发布弹窗的分类下拉也复用其（去掉首项「全部模型」）。
const MODEL_TYPES = ["全部模型", "实景三维", "BIM 模型", "构件级模型", "具身智能机器人训练场景"];
// SORT_OPTIONS：排序方式中文按钮文案（展示用）
const SORT_OPTIONS = ["最新发布", "热门浏览", "最多收藏", "推荐模型"];
// SORT_MAP：排序中文按钮 → 后端 sort 英文枚举（对应 GET /api/models?sort=）
const SORT_MAP: Record<string, ModelSort> = {
  "最新发布": "latest",
  "热门浏览": "views",
  "最多收藏": "favorites",
  "推荐模型": "recommended",
};
// PAGE_SIZE：模型列表每页数量，对应后端 GET /api/models?pageSize
const PAGE_SIZE = 12;
// SCENE_OPTIONS：发布模型弹窗中的应用场景多选项，对应未来模型表 scenes 字段
const SCENE_OPTIONS = ["数字文旅", "工程改造", "数字运维", "数字存档", "云上营销", "游戏影视", "数字孪生", "具身智能机器人训练"];
// ROBOT_TYPES：训练数据申请弹窗中的机器人类型下拉项，对应未来训练申请表 robot_type 字段
const ROBOT_TYPES = ["巡检机器人", "服务机器人", "清洁机器人", "配送机器人", "工业机器人", "其他"];
// TRAIN_TASKS：训练数据申请弹窗中的训练任务多选项，对应未来训练申请表 tasks 字段
const TRAIN_TASKS = ["导航", "避障", "巡检", "目标识别", "空间交互", "任务理解", "路径规划"];
// VISIBILITY_OPTIONS：发布模型时的发布权限单选项，对应 models.visibility 字段
const VISIBILITY_OPTIONS = ["公开发布", "仅自己可见", "审核后公开"];
// VISIBILITY_MAP：发布权限中文 → 后端 ModelVisibility 枚举（POST /api/models）
const VISIBILITY_MAP: Record<string, ModelVisibility> = {
  "公开发布": "public",
  "仅自己可见": "private",
  "审核后公开": "review",
};

// toTagArray：后端 tags/scenes 为 Json，渲染前做数组守卫，避免脏数据导致 .map 报错。
function toTagArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

// MODEL_STATUS_META：模型审核状态（后端英文枚举）→ 中文标签 + 角标配色（用于「我的发布/我的模型」）。
const MODEL_STATUS_META: Record<string, { label: string; color: string }> = {
  published: { label: "已发布", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  pending: { label: "审核中", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  rejected: { label: "未通过", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  draft: { label: "草稿", color: "text-gray-400 bg-white/5 border-white/10" },
};
// modelStatusMeta：取模型状态展示信息，未知状态兜底为原文 + 中性配色。
function modelStatusMeta(status: string) {
  return MODEL_STATUS_META[status] ?? { label: status, color: "text-gray-400 bg-white/5 border-white/10" };
}

// APPLICATION_STATUS_META：训练申请状态（后端英文枚举）→ 中文标签 + 角标配色（用于「我的申请」）。
const APPLICATION_STATUS_META: Record<string, { label: string; color: string }> = {
  submitted: { label: "已提交", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  contacted: { label: "已对接", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  evaluating: { label: "评估中", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  quoted: { label: "已报价", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  closed: { label: "已关闭", color: "text-gray-400 bg-white/5 border-white/10" },
};
// applicationStatusMeta：取申请状态展示信息，未知状态兜底为原文 + 中性配色。
function applicationStatusMeta(status: string) {
  return APPLICATION_STATUS_META[status] ?? { label: status, color: "text-gray-400 bg-white/5 border-white/10" };
}

// ModelCard：模型列表中的单个模型卡片，数据来自后端 GET /api/models 列表项（ModelListItem）；
//   封面渐变用 coverStyleByType(type,id) 推导（后端不返回 color/pattern），浏览量/时间经 format 工具展示。
//   点击「浏览模型」回调 onView(id)，由主页面拉取详情。
//   点赞/收藏已接后端写接口（POST|DELETE /api/models/:id/like|favorite）；未登录交由 onRequireAuth 引导登录。
function ModelCard({
  model,
  onView,
  isAuthed,
  onRequireAuth,
}: {
  model: ModelListItem;
  onView: (id: number) => void;
  isAuthed: boolean;
  onRequireAuth: () => void;
}) {
  // liked / saved：点赞/收藏按钮状态，用后端登录态返回的 isLiked/isFavorited 初始化（游客无该字段则 false）。
  const [liked, setLiked] = useState(model.isLiked ?? false);
  const [saved, setSaved] = useState(model.isFavorited ?? false);
  // likes：点赞计数本地态，初值取后端 likesCount，点赞/取消后用接口返回值校正。
  const [likes, setLikes] = useState(model.likesCount);
  // likePending / savePending：请求进行中标志，防止连点导致计数错乱。
  const [likePending, setLikePending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  // 列表刷新（如登录后重拉、切换筛选）后，用最新后端字段同步本地按钮态与计数。
  useEffect(() => { setLiked(model.isLiked ?? false); }, [model.isLiked]);
  useEffect(() => { setSaved(model.isFavorited ?? false); }, [model.isFavorited]);
  useEffect(() => { setLikes(model.likesCount); }, [model.likesCount]);

  // handleLike：点赞/取消点赞。未登录引导登录；乐观更新即时反馈，成功用后端值校正，失败回滚并提示。
  const handleLike = async () => {
    if (!isAuthed) { onRequireAuth(); return; }
    if (likePending) return;
    const next = !liked;
    setLikePending(true);
    setLiked(next);
    setLikes(c => c + (next ? 1 : -1));
    try {
      const res = next ? await likeModel(model.id) : await unlikeModel(model.id);
      setLiked(res.liked);
      setLikes(res.likesCount);
    } catch (e) {
      setLiked(!next);
      setLikes(c => c + (next ? -1 : 1));
      toast.error(e instanceof ApiError ? e.message : "操作失败，请稍后重试。");
    } finally {
      setLikePending(false);
    }
  };

  // handleSave：收藏/取消收藏。逻辑同点赞，未登录引导登录、乐观更新 + 失败回滚。
  const handleSave = async () => {
    if (!isAuthed) { onRequireAuth(); return; }
    if (savePending) return;
    const next = !saved;
    setSavePending(true);
    setSaved(next);
    try {
      const res = next ? await favoriteModel(model.id) : await unfavoriteModel(model.id);
      setSaved(res.favorited);
    } catch (e) {
      setSaved(!next);
      toast.error(e instanceof ApiError ? e.message : "操作失败，请稍后重试。");
    } finally {
      setSavePending(false);
    }
  };

  // isRobot：是否为具身智能机器人训练场景，决定是否额外显示「申请训练数据服务」按钮
  const isRobot = model.type === "具身智能机器人训练场景";
  // cover：按模型 type + id 推导的封面渐变（补回后端不返回的 color），id 作为 seed 让同类卡片有稳定差异
  const cover = coverStyleByType(model.type, model.id);
  const tags = toTagArray(model.tags);

  return (
    <div className="group relative bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 flex flex-col">
      <div className={`relative h-44 bg-gradient-to-br ${cover.color} overflow-hidden flex-shrink-0`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
            <Grid3X3 className="w-8 h-8 text-white/20" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={`px-2 py-1 rounded-full text-[11px] border ${typeTagColor[model.type] || "bg-white/10 text-white/60 border-white/10"}`}>
            {model.type}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="text-[15px] font-medium leading-tight line-clamp-2">{model.title}</h3>
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.08] text-[11px] text-gray-400">{tag}</span>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-auto pt-2">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <User className="w-3 h-3 text-gray-400" />
          </div>
          <span className="text-[12px] text-gray-400 flex-1 truncate">{model.author}</span>
          {/* 发布时间：后端返回 ISO createdAt，用 formatRelativeTime 转「2天前」 */}
          <span className="text-[11px] text-gray-500">{formatRelativeTime(model.createdAt)}</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-gray-500">
          {/* 浏览量：后端返回数值 viewsCount，用 formatViews 转「2.1k」 */}
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatViews(model.viewsCount)}</span>
          {/* 点赞数：本地 likes 态，随点赞/取消实时更新 */}
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{likes}</span>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {/* 浏览模型按钮：点击携带模型 id 回调 onView，由主页面拉取详情后进入详情页 */}
          <button
            onClick={() => onView(model.id)}
            className="w-full py-2 rounded-xl bg-white/8 border border-white/10 text-[13px] hover:bg-white/12 hover:border-white/20 transition-all"
          >
            浏览模型
          </button>
          {/* 仅具身智能机器人训练场景卡片显示：申请训练数据服务入口（同样进入详情页，在详情页内打开申请弹窗） */}
          {isRobot && (
            <button
              onClick={() => onView(model.id)}
              className="w-full py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[13px] hover:bg-violet-500/20 transition-all"
            >
              申请训练数据服务
            </button>
          )}
        </div>

        {/* 卡片底部操作区：点赞 / 收藏（已接后端写接口）/ 分享（仍为视觉态） */}
        <div className="flex items-center gap-4 pt-1 border-t border-white/5">
          {/* 点赞：调用 handleLike（未登录引导登录，请求中禁用防连点） */}
          <button onClick={handleLike} disabled={likePending} className={`flex items-center gap-1 text-[12px] transition-colors disabled:opacity-60 ${liked ? "text-red-400" : "text-gray-500 hover:text-gray-300"}`}>
            <Heart className={`w-3.5 h-3.5 ${liked ? "fill-red-400" : ""}`} />
            点赞
          </button>
          {/* 收藏：调用 handleSave（未登录引导登录，请求中禁用防连点） */}
          <button onClick={handleSave} disabled={savePending} className={`flex items-center gap-1 text-[12px] transition-colors disabled:opacity-60 ${saved ? "text-yellow-400" : "text-gray-500 hover:text-gray-300"}`}>
            <Bookmark className={`w-3.5 h-3.5 ${saved ? "fill-yellow-400" : ""}`} />
            收藏
          </button>
          <button className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-300 transition-colors">
            <Share2 className="w-3.5 h-3.5" />
            分享
          </button>
        </div>
      </div>
    </div>
  );
}

// ModelDetailPage：模型详情页，当前作为 ModelLibrary 内部条件渲染页面存在；数据来自后端 GET /api/models/:id（ModelDetail）。
//   related：相关推荐由主页面从已加载列表中排除当前模型后传入（后端暂无 /related 接口）。
function ModelDetailPage({ model, related, onBack, onApplyService, onViewModel, isAuthed, onRequireAuth }: { model: ModelDetail; related: ModelListItem[]; onBack: () => void; onApplyService: () => void; onViewModel: (id: number) => void; isAuthed: boolean; onRequireAuth: () => void }) {
  // saved：当前模型是否已收藏，用后端登录态返回的 isFavorited 初始化（已接 POST|DELETE /api/models/:id/favorite）
  const [saved, setSaved] = useState(model.isFavorited ?? false);
  // favs：收藏计数本地态，初值取后端 favoritesCount，收藏/取消后用接口返回值校正
  const [favs, setFavs] = useState(model.favoritesCount);
  // savePending：收藏请求进行中标志，防连点
  const [savePending, setSavePending] = useState(false);
  // viewKey：重置视角时自增，强制重新渲染查看区（iframe 重新加载或占位刷新）
  const [viewKey, setViewKey] = useState(0);
  // shareToast：复制分享链接成功后的「链接已复制」提示状态
  const [shareToast, setShareToast] = useState(false);

  // 进入详情或切换模型时滚动回页面顶部，并同步收藏态/计数到当前模型
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setSaved(model.isFavorited ?? false);
    setFavs(model.favoritesCount);
  }, [model.id, model.isFavorited, model.favoritesCount]);

  // handleSave：收藏/取消收藏。未登录引导登录；乐观更新 + 接口校正 + 失败回滚
  const handleSave = async () => {
    if (!isAuthed) { onRequireAuth(); return; }
    if (savePending) return;
    const next = !saved;
    setSavePending(true);
    setSaved(next);
    setFavs(c => c + (next ? 1 : -1));
    try {
      const res = next ? await favoriteModel(model.id) : await unfavoriteModel(model.id);
      setSaved(res.favorited);
      setFavs(res.favoritesCount);
    } catch (e) {
      setSaved(!next);
      setFavs(c => c + (next ? -1 : 1));
      toast.error(e instanceof ApiError ? e.message : "操作失败，请稍后重试。");
    } finally {
      setSavePending(false);
    }
  };

  // isRobot：当前模型是否为具身智能机器人训练场景，决定是否显示申请训练数据服务按钮
  const isRobot = model.type === "具身智能机器人训练场景";
  // cover：按 type + id 推导封面渐变（补回后端不返回的 color）
  const cover = coverStyleByType(model.type, model.id);
  const tags = toTagArray(model.tags);
  // canEmbed：是否可用 iframe 内嵌外部三维 Viewer——需有 viewerUrl、后端允许内嵌（allowIframe）、且查看器类型非 none。
  //   viewerUrl 来自后端 models.model_url；不可内嵌但有链接时提供「在新窗口打开」兜底，避免空白。
  const canEmbed = !!model.viewerUrl && model.allowIframe && model.viewerType !== "none";
  // description：优先用后端模型简介，为空时回退到原型模板文案，保持详情页不出现空白
  const description = model.description && model.description.trim()
    ? model.description
    : `这是一个高质量的${model.type}模型，适用于${tags.join("、")}等场景。模型数据精度高，可在线流畅浏览。`;

  // handleFullscreen：调用浏览器 Fullscreen API，让模型查看区域进入/退出全屏
  const handleFullscreen = () => {
    const el = document.getElementById("model-viewer-area");
    if (!document.fullscreenElement) {
      el?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // handleReset：通过自增 viewKey 模拟重置三维视角，触发查看区域重新渲染
  const handleReset = () => setViewKey(k => k + 1);

  // handleShare：优先调用 Web Share API，不支持时复制当前链接到剪贴板并显示提示
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: model.title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-64px)]">
        {/* ── Left: viewer ── */}
        <div id="model-viewer-area" className="flex-1 relative bg-[#0d0d0d] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col">

          {/* 顶部工具条：返回社区、全屏、重置视角、分享 */}
          <div className="flex items-center justify-between px-4 h-12 flex-shrink-0 border-b border-white/[0.06] bg-[#0d0d0d] z-10">
            {/* 返回按钮：调用 onBack 关闭详情、回到模型列表 */}
            <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              返回社区
            </button>
            <div className="flex items-center gap-2">
              {/* Share toast */}
              {shareToast && (
                <span className="text-[12px] text-cyan-400 mr-1">链接已复制</span>
              )}
              <button
                onClick={handleFullscreen}
                title="全屏"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Maximize2 className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={handleReset}
                title="重置视角"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={handleShare}
                title="分享"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Share2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Viewer canvas — fills remaining space, content centered */}
          {/* key={viewKey}：点击「重置视角」时自增 viewKey，强制重建查看区（iframe 重新加载或占位刷新） */}
          <div
            key={viewKey}
            className={`flex-1 relative overflow-hidden bg-gradient-to-br ${cover.color}`}
          >
            {canEmbed ? (
              /* 可内嵌：用 iframe 内嵌在线三维查看器（viewerUrl ← 后端 models.model_url）。
                 - title：无障碍标题；loading="lazy"：进入视口再加载；
                 - allow：放开全屏与 WebXR 能力，配合顶部「全屏」按钮（#model-viewer-area 容器全屏）；
                 - sandbox：限制内嵌页权限，仅放开脚本、同源、弹窗与表单，降低第三方页面安全风险。 */
              <iframe
                title={`${model.title} 三维在线查看器`}
                src={model.viewerUrl as string}
                loading="lazy"
                allow="autoplay; fullscreen; xr-spatial-tracking"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                className="absolute inset-0 w-full h-full border-0 bg-[#0d0d0d]"
              />
            ) : (
              /* 不可内嵌（无 viewerUrl 或 allowIframe=false）：回退到占位 UI；
                 若有链接但不允许内嵌，提供「在新窗口打开」兜底，避免 iframe 空白。 */
              <>
                {/* Grid */}
                <div className="absolute inset-0 opacity-[0.12]" style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }} />
                {/* Corner accents */}
                <div className="absolute top-4 left-4 w-5 h-5 border-t border-l border-cyan-500/30" />
                <div className="absolute top-4 right-4 w-5 h-5 border-t border-r border-cyan-500/30" />
                <div className="absolute bottom-14 left-4 w-5 h-5 border-b border-l border-cyan-500/30" />
                <div className="absolute bottom-14 right-4 w-5 h-5 border-b border-r border-cyan-500/30" />
                {/* Centered placeholder */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-24 h-24 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                    <Grid3X3 className="w-10 h-10 text-white/25" />
                  </div>
                  <div className="text-center">
                    <p className="text-white/40 text-[14px]">三维模型在线浏览器</p>
                    <p className="text-white/25 text-[12px] mt-1">{model.title}</p>
                  </div>
                  {/* 有链接但不允许内嵌：提供新窗口打开兜底 */}
                  {model.viewerUrl && !canEmbed && (
                    <a
                      href={model.viewerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/8 border border-white/10 text-[13px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      在新窗口打开
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom control bar */}
          <div className="h-12 flex-shrink-0 flex items-center justify-center gap-2 border-t border-white/[0.06] bg-[#0d0d0d]">
            {["旋转", "缩放", "漫游", "测量"].map(ctrl => (
              <button key={ctrl} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-gray-400 hover:bg-white/10 hover:text-white transition-all">
                {ctrl}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-80 flex-shrink-0 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div>
              <span className={`px-2 py-1 rounded-full text-[11px] border ${typeTagColor[model.type] || "bg-white/10 text-white/60 border-white/10"}`}>
                {model.type}
              </span>
              <h2 className="mt-3 text-[20px] font-semibold leading-tight">{model.title}</h2>
            </div>

            <div className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2 text-gray-400">
                <User className="w-3.5 h-3.5" />
                <span>{model.author}</span>
              </div>
              <div className="flex items-center gap-4 text-gray-400">
                {/* 浏览量/收藏量：后端数值字段，浏览量用 formatViews 展示 */}
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />浏览 {formatViews(model.viewsCount)}</span>
                {/* 收藏数：本地 favs 态，随收藏/取消实时更新 */}
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />收藏 {favs}</span>
              </div>
              {/* 发布时间：ISO createdAt → 相对时间 */}
              <div className="text-gray-500">{formatRelativeTime(model.createdAt)}发布</div>
            </div>

            <div>
              <p className="text-[12px] text-gray-500 mb-2">场景标签</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/[0.08] text-[12px] text-gray-300">{tag}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] text-gray-500 mb-2">模型简介</p>
              {/* 模型简介：优先后端 description，为空回退模板文案 */}
              <p className="text-[13px] text-gray-400 leading-relaxed">
                {description}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {/* 收藏按钮：调用 handleSave（已接后端，未登录引导登录，请求中禁用防连点） */}
              <button
                onClick={handleSave}
                disabled={savePending}
                className={`w-full py-2.5 rounded-xl border text-[14px] transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${saved ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" : "bg-white/5 border-white/10 hover:bg-white/8 text-gray-300"}`}
              >
                <Bookmark className={`w-4 h-4 ${saved ? "fill-yellow-400" : ""}`} />
                {saved ? "已收藏" : "收藏"}
              </button>
              <button className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-gray-300 hover:bg-white/8 transition-all flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" />
                分享
              </button>
              {/* 仅具身智能机器人训练场景显示：点击调用 onApplyService 打开训练数据服务申请弹窗 */}
              {isRobot && (
                <button
                  onClick={onApplyService}
                  className="w-full py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 text-[14px] hover:bg-violet-500/25 transition-all"
                >
                  申请训练数据服务
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 相关推荐区：由主页面从已加载列表中传入；点击推荐卡片调用 onViewModel(id) 切换当前详情模型 */}
      {related.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-12">
          <h3 className="text-[18px] font-semibold mb-6">相关推荐</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map(m => {
              const rc = coverStyleByType(m.type, m.id);
              return (
                <button key={m.id} onClick={() => onViewModel(m.id)} className="group bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all cursor-pointer text-left w-full">
                  <div className={`h-28 bg-gradient-to-br ${rc.color} flex items-center justify-center`}>
                    <Grid3X3 className="w-6 h-6 text-white/20" />
                  </div>
                  <div className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${typeTagColor[m.type] || "bg-white/10 text-white/60 border-white/10"}`}>{m.type}</span>
                    <p className="mt-2 text-[13px] font-medium line-clamp-1">{m.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatViews(m.viewsCount)}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{m.likesCount}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// UploadModal：模型发布弹窗；已接 presign → PUT R2 → callback → POST /api/models。
//   无 R2 时：选文件会在 presign 503 提示固定文案；仅填 viewerUrl（https）可不走 R2 完成发布。
function UploadModal({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void; // 发布成功后刷新模型列表（父组件 loadModels）
}) {
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // selectedScenes：应用场景多选，对应 models.scenes
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  // visibility：发布权限中文单选，提交时映射为 ModelVisibility
  const [visibility, setVisibility] = useState("公开发布");
  const [title, setTitle] = useState(""); // 模型名称（必填，title）
  const [modelType, setModelType] = useState(MODEL_TYPES[1]); // 分类（必填，type）
  const [description, setDescription] = useState(""); // 简介（可选）
  const [viewerUrl, setViewerUrl] = useState(""); // 在线查看链接（https，与模型文件二选一）
  const [modelFile, setModelFile] = useState<File | null>(null); // 待上传的模型文件
  const [coverFile, setCoverFile] = useState<File | null>(null); // 待上传的封面（可选）
  const [submitted, setSubmitted] = useState(false); // 是否进入成功态
  const [submitting, setSubmitting] = useState(false); // 提交中（含上传 + 发布）

  const toggleScene = (s: string) =>
    setSelectedScenes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  // handleSubmit：校验 → 可选 R2 直传 → POST /api/models；三态由 submitting/submitted + toast 承担。
  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      toast.error("请填写模型名称");
      return;
    }
    if (!modelType) {
      toast.error("请选择模型分类");
      return;
    }

    const url = viewerUrl.trim();
    const hasUrl = url.length > 0;
    const hasModelFile = !!modelFile;

    if (!hasModelFile && !hasUrl) {
      toast.error("请上传模型文件或填写在线查看链接");
      return;
    }
    if (hasUrl && !/^https:\/\/.+/i.test(url)) {
      toast.error("在线查看链接须为 https 地址");
      return;
    }

    setSubmitting(true);
    try {
      let modelFileId: number | undefined;
      let coverFileId: number | undefined;

      // 模型文件：走 presign → PUT R2 → callback；R2 未配置时 presign 503 并中止，不 create。
      if (modelFile) {
        const uploaded = await uploadFileToR2("model", modelFile);
        modelFileId = uploaded.fileId;
      }
      if (coverFile) {
        const uploaded = await uploadFileToR2("cover", coverFile);
        coverFileId = uploaded.fileId;
      }

      if (!modelFileId && !url) {
        toast.error("请上传模型文件或填写在线查看链接");
        return;
      }

      await createModel({
        title: title.trim(),
        type: modelType,
        scenes: selectedScenes.length ? selectedScenes : undefined,
        description: description.trim() || undefined,
        visibility: VISIBILITY_MAP[visibility] ?? "public",
        modelFileId,
        coverFileId,
        // 仅外链发布：显式 iframe，不依赖 R2 模型文件
        ...(!modelFileId && hasUrl
          ? {
              viewerUrl: url,
              viewerType: "iframe" as const,
              allowIframe: true,
            }
          : {}),
      });

      onPublished();
      setSubmitted(true);
      toast.success("发布成功");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "发布失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative bg-[#111] border border-white/10 rounded-2xl p-10 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-green-400" />
          </div>
          <h3 className="text-[18px] font-semibold mb-2">发布成功</h3>
          <p className="text-[14px] text-gray-400">模型已提交，审核通过后将在社区展示。</p>
          <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all">返回社区</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#111] border-b border-white/10 flex items-center justify-between px-5 py-4 z-10">
          <div>
            <h2 className="text-[17px] font-semibold">发布你的三维空间模型</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">上传模型文件，填写模型信息，发布到数境空间模型社区。</p>
          </div>
          <button onClick={onClose} disabled={submitting} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 模型文件：点击触发隐藏 input；选中后展示文件名；直传 R2（presign/callback） */}
          <input
            ref={modelFileInputRef}
            type="file"
            className="hidden"
            accept=".glb,.gltf,.ifc,.las,.laz,.ply,.zip,.json"
            onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => modelFileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter") modelFileInputRef.current?.click(); }}
            className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-white/20 transition-all cursor-pointer"
          >
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-[14px] text-gray-300">
              {modelFile ? modelFile.name : "拖拽模型文件到这里，或点击上传"}
            </p>
            <p className="text-[12px] text-gray-500 mt-1">支持 glb / gltf / ifc / 点云等；也可在下方仅填写在线查看链接</p>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">模型名称</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
              placeholder="请输入模型名称"
            />
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">模型分类</label>
            <div className="relative">
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-gray-300 focus:outline-none appearance-none focus:border-white/20 transition-all"
              >
                {MODEL_TYPES.slice(1).map((t) => (
                  <option key={t} value={t} className="bg-[#111]">{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">应用场景（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {SCENE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScene(s)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${selectedScenes.includes(s) ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">模型简介</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none resize-none focus:border-white/20 transition-all"
              placeholder="请简单介绍模型内容、适用场景或空间特点"
            />
          </div>

          {/* 在线查看链接：不选文件时填 https 链接即可发布（viewerType=iframe） */}
          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">在线查看链接（选填）</label>
            <input
              value={viewerUrl}
              onChange={(e) => setViewerUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
              placeholder="https:// 外部三维查看器地址，与模型文件二选一"
            />
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">封面图片</label>
            <input
              ref={coverFileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => coverFileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[13px] text-gray-300 hover:bg-white/8 hover:border-white/20 transition-all"
            >
              {coverFile ? coverFile.name : "上传封面"}
            </button>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">发布权限</label>
            <div className="flex flex-wrap gap-2">
              {VISIBILITY_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${visibility === v ? "bg-white/10 border-white/25 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-gray-300 hover:bg-white/8 transition-all disabled:opacity-50">取消</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "发布中…" : "发布模型"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// TrainingModal：具身智能机器人训练数据服务申请弹窗，仅针对机器人训练场景开放；已接 POST /api/training-applications
//   （OptionalJwtAuthGuard：登录态自动回填 userId、可在个人中心「我的申请」查看；游客匿名提交）。
function TrainingModal({ onClose }: { onClose: () => void }) {
  // ── 受控字段（对应 CreateTrainingApplicationDto）──
  const [contactName, setContactName] = useState(""); // 联系人（必填，contact_name）
  const [contactWay, setContactWay] = useState(""); // 手机 / 微信（必填，contact_way）
  const [company, setCompany] = useState(""); // 公司名称（必填，表定义非空）
  const [robotType, setRobotType] = useState(ROBOT_TYPES[0]); // 机器人类型（必填，默认首项）
  const [sceneDesc, setSceneDesc] = useState(""); // 场景需求描述（必填，scene_desc）
  // selectedTasks：训练任务多选状态（如导航、避障、巡检等），对应训练申请表 train_tasks 字段
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  // submitted：是否提交成功，由 POST /api/training-applications 成功后置真
  const [submitted, setSubmitted] = useState(false);
  // submitting：提交请求进行中标志，用于按钮 loading 与防连点
  const [submitting, setSubmitting] = useState(false);

  // toggleTask：切换某个训练任务的选中状态（已选则移除、未选则加入）
  const toggleTask = (t: string) => setSelectedTasks(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  // handleSubmit：提交训练数据服务申请。前端先做必填校验，再调用接口，三态处理。
  const handleSubmit = async () => {
    if (submitting) return;
    // 必填校验：联系人、手机/微信、公司名称、场景需求描述（与后端 DTO 一致）
    if (!contactName.trim()) { toast.error("请填写联系人"); return; }
    if (!contactWay.trim()) { toast.error("请填写手机 / 微信"); return; }
    if (!company.trim()) { toast.error("请填写公司名称"); return; }
    if (!sceneDesc.trim()) { toast.error("请填写场景需求描述"); return; }
    setSubmitting(true);
    try {
      await createTrainingApplication({
        contactName: contactName.trim(),
        contactWay: contactWay.trim(),
        company: company.trim(),
        robotType,
        trainTasks: selectedTasks.length ? selectedTasks : undefined,
        sceneDesc: sceneDesc.trim(),
      });
      setSubmitted(true); // 成功切成功态
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  // 提交成功后渲染「申请已提交」提示态
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative bg-[#111] border border-white/10 rounded-2xl p-10 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-violet-400" />
          </div>
          <h3 className="text-[18px] font-semibold mb-2">申请已提交</h3>
          <p className="text-[14px] text-gray-400">申请已提交，我们将尽快与你联系。</p>
          <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all">关闭</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#111] border-b border-white/10 flex items-center justify-between px-5 py-4 z-10">
          <div>
            <h2 className="text-[17px] font-semibold">申请训练数据服务</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">请填写你的训练场景需求，我们将根据机器人类型、任务目标与空间环境进行数据服务对接。</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[13px] text-gray-400 block mb-1.5">联系人</label>
              {/* 联系人：受控必填字段，对应 CreateTrainingApplicationDto.contactName */}
              <input value={contactName} onChange={e => setContactName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all" placeholder="请输入姓名" />
            </div>
            <div>
              <label className="text-[13px] text-gray-400 block mb-1.5">手机 / 微信</label>
              {/* 手机 / 微信：受控必填字段，对应 contactWay */}
              <input value={contactWay} onChange={e => setContactWay(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all" placeholder="请输入手机或微信" />
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">公司名称</label>
            {/* 公司名称：受控必填字段（后端表定义非空），对应 company */}
            <input value={company} onChange={e => setCompany(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all" placeholder="请输入公司名称" />
          </div>

          {/* 机器人类型：受控下拉单选，对应训练申请表 robot_type 字段，默认首项 */}
          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">机器人类型</label>
            <div className="relative">
              <select value={robotType} onChange={e => setRobotType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-gray-300 focus:outline-none appearance-none focus:border-white/20 transition-all">
                {ROBOT_TYPES.map(t => <option key={t} value={t} className="bg-[#111]">{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* 训练任务：多选标签，点击调用 toggleTask 切换，对应未来训练申请表 tasks 字段 */}
          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">训练任务（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {TRAIN_TASKS.map(t => (
                <button key={t} onClick={() => toggleTask(t)} className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${selectedTasks.includes(t) ? "bg-violet-500/15 border-violet-500/30 text-violet-400" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 场景需求描述：受控必填文本域，对应 sceneDesc */}
          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">场景需求描述</label>
            <textarea rows={3} value={sceneDesc} onChange={e => setSceneDesc(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none resize-none focus:border-white/20 transition-all" placeholder="请描述你需要的训练空间类型、任务目标和数据用途" />
          </div>

          {/* 底部操作：取消关闭弹窗；提交申请调用 POST /api/training-applications，提交中显示 loading，成功切成功态、失败 toast */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-gray-300 hover:bg-white/8 transition-all">取消</button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-violet-500 text-white text-[14px] font-medium hover:bg-violet-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "提交中…" : "提交申请"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Async：个人中心各 Tab 列表数据的通用三态容器（加载/错误/数据）。
interface Async<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}
const ASYNC_IDLE = { loading: false, error: null, data: null } as const;

// TabState：个人中心单个 Tab 的三态渲染外壳（loading 骨架 / error+重试 / empty 空态 / 正常内容）。
//   children 仅在有数据时渲染；调用方用 (state.data ?? []) 传入，空数组走 empty 文案。
function TabState<T>({
  state,
  emptyText,
  onRetry,
  children,
}: {
  state: Async<T[]>;
  emptyText: string;
  onRetry: () => void;
  children: (data: T[]) => ReactNode;
}) {
  if (state.loading) {
    // 加载态：骨架卡片占位
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden animate-pulse">
            <div className="h-28 bg-white/5" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-white/5 rounded" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (state.error) {
    // 错误态：提示 + 重新加载
    return (
      <div className="text-center py-16 text-gray-500">
        <ClipboardList className="w-9 h-9 mx-auto mb-3 opacity-30" />
        <p className="text-[14px]">{state.error}</p>
        <button
          onClick={onRetry}
          className="mt-4 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
        >
          重新加载
        </button>
      </div>
    );
  }
  const list = state.data ?? [];
  if (list.length === 0) {
    // 空态：企业级中文文案
    return (
      <div className="text-center py-16 text-gray-500">
        <FileBox className="w-9 h-9 mx-auto mb-3 opacity-30" />
        <p className="text-[14px]">{emptyText}</p>
      </div>
    );
  }
  return <>{children(list)}</>;
}

// PersonalCenter：用户个人中心，当前内嵌在 ModelLibrary 中，正式开发建议拆分为 /user 路由。
//   数据已接后端 /api/users/me/*（我的模型/收藏/发布/申请 + 统计角标），仅在登录态下渲染（主页面已做未登录拦截）。
//   onView：点击模型/收藏卡片时回调模型 id，复用主页面详情拉取逻辑打开详情。
function PersonalCenter({ onBack, onView }: { onBack: () => void; onView: (id: number) => void }) {
  // user：当前登录用户（用于顶部昵称展示）
  const { user } = useAuth();
  // tab：控制当前展示「我的模型 / 我的收藏 / 我的发布 / 我的申请」
  const [tab, setTab] = useState<"models" | "favorites" | "published" | "applications">("models");

  // stats：个人中心统计角标（各 Tab 数量），挂载时拉取一次；失败不阻断页面（角标隐藏）
  const [stats, setStats] = useState<MeStats | null>(null);
  // 四个 Tab 各自的列表三态（按需懒加载，已加载则缓存不重复请求）
  const [models, setModels] = useState<Async<MyModel[]>>(ASYNC_IDLE);
  const [favorites, setFavorites] = useState<Async<MyFavorite[]>>(ASYNC_IDLE);
  const [published, setPublished] = useState<Async<MyModel[]>>(ASYNC_IDLE);
  const [applications, setApplications] = useState<Async<MyApplication[]>>(ASYNC_IDLE);

  // errMsg：统一把 ApiError 转为可展示中文
  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "加载失败，请稍后重试。");

  // 各 Tab 加载函数：拉取本人数据（个人中心数据量小，pageSize=50 一次展示，暂不做加载更多）
  const loadModels = useCallback(async () => {
    setModels(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyModels({ status: "all", pageSize: 50 });
      setModels({ loading: false, error: null, data: res.list });
    } catch (e) {
      setModels({ loading: false, error: errMsg(e), data: null });
    }
  }, []);
  const loadFavorites = useCallback(async () => {
    setFavorites(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyFavorites({ pageSize: 50 });
      setFavorites({ loading: false, error: null, data: res.list });
    } catch (e) {
      setFavorites({ loading: false, error: errMsg(e), data: null });
    }
  }, []);
  const loadPublished = useCallback(async () => {
    setPublished(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyPublished({ pageSize: 50 });
      setPublished({ loading: false, error: null, data: res.list });
    } catch (e) {
      setPublished({ loading: false, error: errMsg(e), data: null });
    }
  }, []);
  const loadApplications = useCallback(async () => {
    setApplications(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await getMyApplications({ pageSize: 50 });
      setApplications({ loading: false, error: null, data: res.list });
    } catch (e) {
      setApplications({ loading: false, error: errMsg(e), data: null });
    }
  }, []);

  // 挂载时拉取统计角标（失败静默，不影响列表）
  useEffect(() => {
    getMyStats().then(setStats).catch(() => {});
  }, []);

  // 切换 Tab 时懒加载对应数据：仅当未加载（data 为 null）且不在加载中、且无错误时触发；错误后由「重新加载」按钮重试
  useEffect(() => {
    if (tab === "models" && models.data === null && !models.loading && !models.error) loadModels();
    if (tab === "favorites" && favorites.data === null && !favorites.loading && !favorites.error) loadFavorites();
    if (tab === "published" && published.data === null && !published.loading && !published.error) loadPublished();
    if (tab === "applications" && applications.data === null && !applications.loading && !applications.error) loadApplications();
  }, [tab, models, favorites, published, applications, loadModels, loadFavorites, loadPublished, loadApplications]);

  // tabs：四个 Tab 定义，角标数量取自 stats（未加载时不显示）
  const tabs = [
    { key: "models" as const, label: "我的模型", icon: <FileBox className="w-4 h-4" />, count: stats?.models },
    { key: "favorites" as const, label: "我的收藏", icon: <Star className="w-4 h-4" />, count: stats?.favorites },
    { key: "published" as const, label: "我的发布", icon: <Grid3X3 className="w-4 h-4" />, count: stats?.published },
    { key: "applications" as const, label: "我的申请", icon: <ClipboardList className="w-4 h-4" />, count: stats?.applications },
  ];

  return (
    <div className="max-w-[960px] mx-auto px-5 md:px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-white transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" />
        返回社区
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
          <User className="w-7 h-7 text-gray-400" />
        </div>
        <div>
          {/* 顶部昵称：取自登录态 user.nickname，未取到回退通用文案 */}
          <p className="text-[18px] font-medium">{user?.nickname ?? "我的个人中心"}</p>
          <p className="text-[13px] text-gray-500">管理你的模型、收藏与申请记录</p>
        </div>
      </div>

      <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] whitespace-nowrap transition-all flex-shrink-0 ${tab === t.key ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"}`}>
            {t.icon}{t.label}
            {/* 角标：统计数量（来自 GET /api/users/me/stats），未加载时不显示 */}
            {typeof t.count === "number" && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/10 text-[11px] text-gray-300">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 我的模型：GET /api/users/me/models（本人全部状态），卡片可点击进详情 + 发布新模型占位入口 */}
      {tab === "models" && (
        <TabState state={models} emptyText="你还没有发布过模型" onRetry={loadModels}>
          {(list) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map(m => {
                const cover = coverStyleByType(m.type, m.id);
                const meta = modelStatusMeta(m.status);
                return (
                  <button key={m.id} onClick={() => onView(m.id)} className="text-left w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all">
                    <div className={`h-28 bg-gradient-to-br ${cover.color} flex items-center justify-center`}>
                      <Grid3X3 className="w-6 h-6 text-white/20" />
                    </div>
                    <div className="p-3">
                      <p className="text-[13px] font-medium line-clamp-1">{m.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-gray-500">{m.type}</span>
                        {/* 审核状态角标：published/pending/rejected/draft */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${meta.color}`}>{meta.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {/* 发布新模型占位卡（上传发布本期不接入，仅保留入口视觉） */}
              <div className="border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center h-40 cursor-pointer hover:border-white/20 transition-all">
                <div className="text-center">
                  <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-500">发布新模型</p>
                </div>
              </div>
            </div>
          )}
        </TabState>
      )}

      {/* 我的收藏：GET /api/users/me/favorites；isAvailable=false（已下架/转私有）灰显且禁止进入详情 */}
      {tab === "favorites" && (
        <TabState state={favorites} emptyText="你还没有收藏任何模型" onRetry={loadFavorites}>
          {(list) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map(m => {
                const cover = coverStyleByType(m.type, m.id);
                // 不可用模型：灰显 + 不可点击，提示已下架
                if (!m.isAvailable) {
                  return (
                    <div key={m.id} className="w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden opacity-50 cursor-not-allowed">
                      <div className={`h-28 bg-gradient-to-br ${cover.color} flex items-center justify-center`}>
                        <Grid3X3 className="w-6 h-6 text-white/20" />
                      </div>
                      <div className="p-3">
                        <p className="text-[13px] font-medium line-clamp-1">{m.title}</p>
                        <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] border text-gray-400 bg-white/5 border-white/10">已下架</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <button key={m.id} onClick={() => onView(m.id)} className="text-left w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all">
                    <div className={`h-28 bg-gradient-to-br ${cover.color} flex items-center justify-center`}>
                      <Grid3X3 className="w-6 h-6 text-white/20" />
                    </div>
                    <div className="p-3">
                      <p className="text-[13px] font-medium line-clamp-1">{m.title}</p>
                      <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] border ${typeTagColor[m.type] || "bg-white/10 text-white/60 border-white/10"}`}>{m.type}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabState>
      )}

      {/* 我的发布：GET /api/users/me/published（仅 published），状态角标按枚举映射中文 */}
      {tab === "published" && (
        <TabState state={published} emptyText="你还没有已发布的模型" onRetry={loadPublished}>
          {(list) => (
            <div className="space-y-3">
              {list.map(m => {
                const meta = modelStatusMeta(m.status);
                return (
                  <button key={m.id} onClick={() => onView(m.id)} className="w-full text-left flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 hover:border-white/20 transition-all">
                    <p className="text-[14px] line-clamp-1">{m.title}</p>
                    <span className={`px-3 py-1 rounded-full text-[12px] border flex-shrink-0 ml-3 ${meta.color}`}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </TabState>
      )}

      {/* 我的申请：GET /api/users/me/applications，仅具身智能机器人训练数据服务申请 */}
      {tab === "applications" && (
        <TabState state={applications} emptyText="你还没有提交训练数据服务申请" onRetry={loadApplications}>
          {(list) => (
            <div className="space-y-3">
              {list.map(a => {
                const meta = applicationStatusMeta(a.status);
                return (
                  <div key={a.id} className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium line-clamp-1">{a.robotType} — 训练数据服务申请</p>
                        <p className="text-[12px] text-gray-500 mt-1 line-clamp-1">{a.sceneDesc}</p>
                        <p className="text-[12px] text-gray-600 mt-1">{formatRelativeTime(a.createdAt)}提交</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[12px] border flex-shrink-0 ${meta.color}`}>{meta.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabState>
      )}
    </div>
  );
}

// ModelLibrary：模型库主页面，负责分类筛选、搜索、排序、分页加载（接后端），以及详情页、发布弹窗、训练申请弹窗、个人中心的入口与切换
export default function ModelLibrary({ onNavigateHome, onNavigateCommunity, onNavigateAbout, onNavigateContact, onNavigateAuth, initialModelId }: ModelLibraryProps) {
  // isAuthed：登录态，用于点赞/收藏/个人中心的登录拦截
  const { isAuthed } = useAuth();
  // 站点配置：Footer 联系方式 / 公司名 / 版权 / 备案号来自后端（默认值兜底）
  const { config } = useSiteConfig();
  // requireAuth：未登录时统一提示并跳转 AuthPage（供点赞/收藏/个人中心调用）
  const requireAuth = useCallback(() => {
    toast.error("请先登录后再操作");
    onNavigateAuth?.();
  }, [onNavigateAuth]);

  // activeType：当前选中的模型分类筛选（分类名，「全部模型」表示不过滤），作为 GET /api/models?type 入参
  const [activeType, setActiveType] = useState("全部模型");
  // activeSort：当前选中的排序方式（中文），经 SORT_MAP 映射为后端 sort 英文枚举
  const [activeSort, setActiveSort] = useState("最新发布");
  // searchInput：搜索输入框的实时值；keyword：真正提交给后端的关键词（点击搜索/回车时提交）
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  // showUpload / showTraining / showPersonal：发布弹窗 / 训练申请弹窗 / 个人中心子页面的显隐
  const [showUpload, setShowUpload] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showPersonal, setShowPersonal] = useState(false);

  // categoryNames：分类筛选按钮文案；默认用静态 MODEL_TYPES，挂载后用后端分类覆盖（首项固定补「全部模型」）
  const [categoryNames, setCategoryNames] = useState<string[]>(MODEL_TYPES);

  // ── 模型列表状态（接后端 GET /api/models）──
  const [list, setList] = useState<ModelListItem[]>([]); // 当前已加载的模型列表（分页累加）
  const [total, setTotal] = useState(0); // 后端返回的符合条件的模型总数（用于「共 N 个」与加载更多判断）
  const [page, setPage] = useState(1); // 当前已加载到的页码
  const [listLoading, setListLoading] = useState(true); // 首屏/切换筛选时的整页加载态
  const [loadingMore, setLoadingMore] = useState(false); // 「加载更多」追加加载态
  const [listError, setListError] = useState<string | null>(null); // 列表加载错误信息

  // ── 模型详情状态（接后端 GET /api/models/:id）──
  const [detailId, setDetailId] = useState<number | null>(initialModelId ?? null); // 当前查看的模型 id，不为空时渲染详情页
  const [detail, setDetail] = useState<ModelDetail | null>(null); // 详情数据
  const [detailLoading, setDetailLoading] = useState(false); // 详情加载态
  const [detailError, setDetailError] = useState<string | null>(null); // 详情加载错误（含 404 模型不存在）

  // searchInputRef：引用搜索输入框，供「搜索」按钮点击后主动失焦（移动端收起键盘）
  const searchInputRef = useRef<HTMLInputElement>(null);
  // listReqIdRef：列表请求竞态保护——快速切换分类/排序/搜索时仅最后一次请求结果可写入状态
  const listReqIdRef = useRef(0);

  // loadModels：拉取模型列表。targetPage 为目标页码；append=true 表示「加载更多」追加，否则替换（首屏/换筛选）。
  const loadModels = useCallback(async (targetPage: number, append: boolean) => {
    const reqId = ++listReqIdRef.current;
    if (append) setLoadingMore(true);
    else { setListLoading(true); setListError(null); }
    try {
      const res = await getModels({
        type: activeType === "全部模型" ? undefined : activeType,
        keyword: keyword || undefined,
        sort: SORT_MAP[activeSort] ?? "latest",
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      if (reqId !== listReqIdRef.current) return; // 已有更新的请求，丢弃本次结果
      setTotal(res.total);
      setPage(res.page);
      setList(prev => (append ? [...prev, ...res.list] : res.list));
    } catch (e) {
      if (reqId !== listReqIdRef.current) return;
      const msg = e instanceof ApiError ? e.message : "模型列表加载失败，请稍后重试。";
      if (!append) { setList([]); setTotal(0); }
      setListError(msg);
      toast.error(msg);
    } finally {
      if (reqId === listReqIdRef.current) { setListLoading(false); setLoadingMore(false); }
    }
  }, [activeType, keyword, activeSort]);

  // 分类、排序、搜索关键词变化时，重新从第 1 页加载（loadModels 依赖这些值，变化即触发）
  useEffect(() => {
    loadModels(1, false);
  }, [loadModels]);

  // 挂载时拉取后端分类，成功则覆盖筛选按钮（首项补「全部模型」）；失败静默回退静态 MODEL_TYPES
  useEffect(() => {
    getCategories()
      .then(cats => {
        if (cats && cats.length > 0) setCategoryNames(["全部模型", ...cats.map(c => c.name)]);
      })
      .catch(() => {
        // 分类接口失败：保留默认 MODEL_TYPES，不打断页面
      });
  }, []);

  // detailId 变化时拉取模型详情（含 404「模型不存在」处理）
  useEffect(() => {
    if (detailId == null) { setDetail(null); setDetailError(null); return; }
    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    getModelDetail(detailId)
      .then(d => { if (active) setDetail(d); })
      .catch(e => {
        if (!active) return;
        setDetailError(e instanceof ApiError ? e.message : "模型详情加载失败，请稍后重试。");
      })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [detailId]);

  // 同步外部传入的 initialModelId（从模型社区入口页携带 id 跳转进来时直接打开对应详情）
  useEffect(() => {
    if (initialModelId != null) setDetailId(initialModelId);
  }, [initialModelId]);

  // handleSearchClick：提交搜索——失焦收起移动端键盘，并把输入框值作为后端查询关键词（触发列表重载）
  const handleSearchClick = () => {
    searchInputRef.current?.blur();
    setKeyword(searchInput.trim());
  };

  // canLoadMore：是否还有下一页（已加载数量 < 总数）
  const canLoadMore = list.length < total;
  // handleLoadMore：加载下一页并追加到列表
  const handleLoadMore = () => {
    if (canLoadMore && !loadingMore && !listLoading) loadModels(page + 1, true);
  };

  // related：相关推荐——从当前已加载列表中排除正在查看的模型，取前 4 个（后端暂无 /related 接口）
  const related = list.filter(m => m.id !== detailId).slice(0, 4);

  // navBar：模型库各视图（列表/详情/个人中心）共用的顶部导航；高亮停留在「模型社区」
  const navBar = (
    <NavBar
      activePage="community"
      onNavigateHome={onNavigateHome}
      onNavigateCommunity={onNavigateCommunity}
      onNavigateAbout={onNavigateAbout}
      onNavigateContact={onNavigateContact}
      onNavigateAuth={onNavigateAuth}
    />
  );

  // 优先级一：进入个人中心时，整页渲染 PersonalCenter
  if (showPersonal) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {navBar}
        <div className="pt-16">
          {/* onView：点击个人中心卡片时，先关闭个人中心再设置 detailId，使渲染命中模型详情页（showPersonal 优先级高于 detailId） */}
          <PersonalCenter
            onBack={() => setShowPersonal(false)}
            onView={(id) => { setShowPersonal(false); setDetailId(id); }}
          />
        </div>
      </div>
    );
  }

  // 优先级二：选中某个模型时，整页渲染模型详情页（含加载态 / 错误或不存在的空状态）
  if (detailId != null) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {navBar}
        <div className="pt-16">
          {detailLoading ? (
            // 详情加载中
            <div className="flex flex-col items-center justify-center gap-3 py-32 text-gray-500">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-[14px]">正在加载模型详情…</p>
            </div>
          ) : detail ? (
            <ModelDetailPage
              model={detail}
              related={related}
              onBack={() => setDetailId(null)}
              onApplyService={() => setShowTraining(true)}
              onViewModel={(id) => setDetailId(id)}
              isAuthed={isAuthed}
              onRequireAuth={requireAuth}
            />
          ) : (
            // 详情加载失败 / 模型不存在或不可见：企业级空状态 + 返回列表
            <div className="flex flex-col items-center justify-center gap-3 py-32 text-gray-500">
              <Grid3X3 className="w-10 h-10 opacity-30" />
              <p className="text-[15px]">{detailError ?? "模型不存在或暂未公开"}</p>
              <button
                onClick={() => setDetailId(null)}
                className="mt-2 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
              >
                返回模型列表
              </button>
            </div>
          )}
        </div>
        {showTraining && <TrainingModal onClose={() => setShowTraining(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {navBar}

      <div className="pt-16">
        {/* 社区头部：标题、个人中心入口、发布模型按钮、搜索框、分类筛选 */}
        <div className="bg-[#0d0d0d] border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-8 md:py-10">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-[26px] md:text-[32px] font-bold">模型社区</h1>
                <p className="text-[14px] md:text-[15px] text-gray-400 mt-1">发现、浏览并发布真实三维空间模型</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 个人中心入口：登录后打开 PersonalCenter；未登录提示并跳转 AuthPage */}
                <button onClick={() => { if (isAuthed) setShowPersonal(true); else requireAuth(); }} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[13px] text-gray-300 hover:bg-white/8 transition-all">
                  <User className="w-3.5 h-3.5" />
                  个人中心
                </button>
                {/* 发布模型：未登录提示并跳转 AuthPage；已登录打开 UploadModal */}
                <button
                  onClick={() => {
                    if (!isAuthed) {
                      requireAuth();
                      return;
                    }
                    setShowUpload(true);
                  }}
                  className="px-5 py-2.5 rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all"
                >
                  发布模型
                </button>
              </div>
            </div>

            {/* 搜索框：输入更新 searchInput，点击「搜索」或回车提交为 keyword 触发后端查询 */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSearchClick(); }}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-24 py-3 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                placeholder="搜索模型名称或作者"
              />
              {/* 搜索按钮：点击提交关键词（后端按标题与作者昵称检索） */}
              <button onClick={handleSearchClick} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-white/10 text-[13px] text-gray-300 hover:bg-white/15 transition-all">
                搜索
              </button>
            </div>

            {/* 分类筛选：分类来自后端 GET /api/categories（失败回退静态）；点击调用 setActiveType 切换，触发后端查询 */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {categoryNames.map(t => (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className={`px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap flex-shrink-0 transition-all border ${activeType === t ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 吸顶排序栏：点击调用 setActiveSort 切换排序方式（经 SORT_MAP 映射后端 sort，触发查询） */}
        <div className="bg-[#0a0a0a] border-b border-white/[0.06] sticky top-16 z-30">
          <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-3">
            <div className="flex items-center gap-2 md:gap-6 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[12px] text-gray-500 hidden md:block">排序：</span>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map(s => (
                    <button key={s} onClick={() => setActiveSort(s)} className={`px-2.5 py-1 rounded-lg text-[12px] whitespace-nowrap transition-all ${activeSort === s ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 模型网格区：展示当前分类标题、模型数量、卡片列表或加载/错误/空状态 */}
        <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-medium">
              {activeType === "全部模型" ? "全部模型" : activeType}
            </h2>
            {/* 数量展示：使用后端返回的 total（符合当前筛选/搜索条件的模型总数） */}
            <span className="text-[13px] text-gray-500">共 {total} 个模型</span>
          </div>

          {listLoading ? (
            // 列表整页加载态：骨架卡片占位
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-44 bg-white/5" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-white/5 rounded" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                    <div className="h-8 bg-white/5 rounded-xl mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : listError ? (
            // 列表加载错误：提示 + 重试
            <div className="text-center py-20 text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-[15px]">{listError}</p>
              <button
                onClick={() => loadModels(1, false)}
                className="mt-4 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
              >
                重新加载
              </button>
            </div>
          ) : list.length === 0 ? (
            // 空状态：无匹配结果
            <div className="text-center py-20 text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-[15px]">未找到相关模型</p>
              <p className="text-[13px] mt-1">请尝试其他关键词或分类</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 模型卡片列表：点击卡片「浏览模型」回调 id，进入详情页（拉取 GET /api/models/:id） */}
              {list.map(m => (
                <ModelCard key={m.id} model={m} onView={(id) => setDetailId(id)} isAuthed={isAuthed} onRequireAuth={requireAuth} />
              ))}
            </div>
          )}

          {/* 加载更多：基于后端分页（page/pageSize/total）；还有下一页时可点击追加，已全部加载时禁用并提示 */}
          {!listLoading && !listError && list.length > 0 && (
            <div className="text-center mt-10">
              <button
                onClick={handleLoadMore}
                disabled={!canLoadMore || loadingMore}
                className={`px-8 py-3 rounded-full border text-[14px] transition-all ${canLoadMore && !loadingMore
                  ? "bg-white/8 border-white/10 text-gray-200 hover:bg-white/12 hover:border-white/20"
                  : "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed"}`}
              >
                {loadingMore ? "加载中…" : canLoadMore ? "加载更多" : "已加载全部模型"}
              </button>
            </div>
          )}
        </div>

        {/* 页脚：公司信息、联系方式（待补真实信息）、导航跳转 */}
        <footer className="border-t border-white/10 bg-black py-10 md:py-14">
          <div className="max-w-[1200px] mx-auto px-5 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <img src={logoSrc} alt="数境空间" className="h-6 w-auto object-contain" style={{ mixBlendMode: "screen" }} />
                  <span className="text-[16px] font-medium">数境空间</span>
                </div>
                <p className="text-[13px] text-gray-500">{config.companyName}</p>
              </div>
              <div>
                <h4 className="text-[14px] font-semibold mb-3">联系方式</h4>
                {/* 联系方式来自站点配置（GET /api/site-config）；接口异常时回退默认占位「请填写」 */}
                <div className="space-y-1.5 text-[13px] text-gray-500">
                  <p>电话：{config.phone}</p>
                  <p>邮箱：{config.email}</p>
                  <p>地址：{config.address}</p>
                </div>
              </div>
              <div>
                <h4 className="text-[14px] font-semibold mb-3">导航</h4>
                <div className="space-y-1.5 text-[13px]">
                  <button onClick={onNavigateHome} className="block text-gray-500 hover:text-white transition-colors">首页</button>
                  <button onClick={onNavigateCommunity} className="block text-gray-500 hover:text-white transition-colors">模型社区</button>
                  <button onClick={onNavigateAbout} className="block text-gray-500 hover:text-white transition-colors">关于我们</button>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-white/10 text-center">
              <p className="text-[12px] text-gray-600">{config.footerText}</p>
              {/* 备案号：站点配置存在 icp 时才渲染，默认空值不显示 */}
              {config.icp && <p className="mt-2 text-[12px] text-gray-600">{config.icp}</p>}
            </div>
          </div>
        </footer>
      </div>

      {/* 发布模型弹窗：showUpload 为真时挂载，关闭时回调 setShowUpload(false) */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onPublished={() => loadModels(1, false)}
        />
      )}
    </div>
  );
}
