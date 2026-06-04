"use client";

/**
 * 页面名称：模型详情页 ModelDetail
 * 页面用途：展示单个模型的三维 Viewer、元信息与相关推荐
 * 主要功能：GET /api/models/:id、iframe 内嵌 / 占位 / 新窗口打开、全屏/重置/分享、相关推荐
 * 对应文档：页面功能注释文档/06_模型详情_ModelDetail.md
 * 说明：步骤 7C 已接收藏写接口与 TrainingModal。全站 NavBar 由 SiteChrome 挂载。
 */
import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Grid3X3,
  RotateCcw,
  Maximize2,
  Share2,
  Bookmark,
  ArrowLeft,
  ExternalLink,
  Eye,
  Heart,
  User,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { TrainingModal } from "@/components/models/training-modal";
import { useAuth } from "@/components/providers/auth-provider";
import {
  getModelDetail,
  getModels,
  favoriteModel,
  unfavoriteModel,
  recordModelView,
} from "@/lib/api/models";
import { deleteMyModel } from "@/lib/api/users";
import { coverStyleByType, formatViews, formatRelativeTime } from "@/lib/format";
import { typeTagColor } from "@/lib/community-data";
import { ApiError } from "@/lib/http";
import type { ModelDetail, ModelListItem } from "@/lib/types";

function toTagArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

// mergeSceneLabels：合并 tags 与 scenes 用于场景标签展示（后端两字段均可能返回）
function mergeSceneLabels(tags: unknown, scenes: unknown): string[] {
  const merged = [...toTagArray(tags), ...toTagArray(scenes)];
  return [...new Set(merged)];
}

function processingStatusText(status: ModelDetail["processingStatus"]) {
  switch (status) {
    case "uploaded":
      return "模型文件已上传，正在等待进入后台解析。";
    case "processing":
      return "模型正在后台解析中，完成后即可在线浏览。";
    case "failed":
      return "模型解析失败，请联系管理员或稍后重新发布。";
    case "ready":
    default:
      return "";
  }
}

interface ModelDetailPageProps {
  modelId: string;
}

export default function ModelDetailPage({ modelId }: ModelDetailPageProps) {
  const router = useRouter();
  const { user, isAuthed } = useAuth();

  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [related, setRelated] = useState<ModelListItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [viewKey, setViewKey] = useState(0);
  const [shareToast, setShareToast] = useState(false);
  // saved / favs：收藏态与计数，用后端 isFavorited / favoritesCount 初始化并同步
  const [saved, setSaved] = useState(false);
  const [favs, setFavs] = useState(0);
  const [savePending, setSavePending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  // showTraining：训练数据服务申请弹窗显隐
  const [showTraining, setShowTraining] = useState(false);
  // viewedRef：记录已打点的模型 id，避免 React 严格模式 / 重渲染导致重复打点（本次会话内最小去重）
  const viewedRef = useRef<number | null>(null);

  const requireAuth = useCallback(() => {
    toast.error("请先登录后再操作");
    router.push("/auth");
  }, [router]);

  // 拉取模型详情；无效 id 或 404 时展示友好空状态
  useEffect(() => {
    if (!idValid) {
      setDetailLoading(false);
      setDetail(null);
      setDetailError("模型不存在或暂未公开");
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    getModelDetail(numericId)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e) => {
        if (!active) return;
        const msg =
          e instanceof ApiError
            ? e.status === 404
              ? "模型不存在或暂未公开"
              : e.message
            : "模型详情加载失败，请稍后重试。";
        setDetailError(msg);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [idValid, numericId]);

  // 浏览量打点（2E）：详情页打开后对当前模型调用一次 POST /api/models/:id/view，
  //   成功后仅在本地状态同步最新 viewsCount（不新增 UI）；失败静默，不影响详情展示。
  //   GET /api/models/:id 保持只读语义，浏览量由本打点单独累加。
  useEffect(() => {
    if (!idValid) return;
    if (detail && detail.processingStatus !== "ready") return;
    if (viewedRef.current === numericId) return; // 同一模型仅打点一次
    viewedRef.current = numericId;
    recordModelView(numericId)
      .then((res) => {
        setDetail((prev) =>
          prev && prev.id === numericId
            ? { ...prev, viewsCount: res.viewsCount }
            : prev,
        );
      })
      .catch(() => {
        // 打点失败静默：浏览量为辅助统计，不阻断详情浏览
      });
  }, [detail, idValid, numericId]);

  // 相关推荐：后端暂无 /related，从列表接口取若干条并排除当前模型
  useEffect(() => {
    if (!idValid) return;
    let active = true;
    getModels({ page: 1, pageSize: 8, sort: "recommended" })
      .then((res) => {
        if (active && res?.list) {
          setRelated(res.list.filter((m) => m.id !== numericId).slice(0, 4));
        }
      })
      .catch(() => {
        // 推荐区失败静默，不影响主详情
      });
    return () => {
      active = false;
    };
  }, [idValid, numericId]);

  useEffect(() => {
    if (!detail) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    setSaved(detail.isFavorited ?? false);
    setFavs(detail.favoritesCount);
  }, [detail]);

  // 删除确认弹窗：支持 Esc 关闭；删除请求进行中不允许关闭，避免状态混乱。
  useEffect(() => {
    if (!confirmOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletePending) {
        setConfirmOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, deletePending]);

  // handleSave：收藏/取消收藏。未登录引导登录；乐观更新 + 接口校正 + 失败回滚
  const handleSave = useCallback(async () => {
    if (!detail) return;
    if (!isAuthed) {
      requireAuth();
      return;
    }
    if (savePending) return;
    const next = !saved;
    setSavePending(true);
    setSaved(next);
    setFavs((c) => c + (next ? 1 : -1));
    try {
      const res = next
        ? await favoriteModel(detail.id)
        : await unfavoriteModel(detail.id);
      setSaved(res.favorited);
      setFavs(res.favoritesCount);
    } catch (e) {
      setSaved(!next);
      setFavs((c) => c + (next ? -1 : 1));
      toast.error(e instanceof ApiError ? e.message : "操作失败，请稍后重试。");
    } finally {
      setSavePending(false);
    }
  }, [detail, isAuthed, requireAuth, savePending, saved]);

  const handleDelete = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!detail || !user || deletePending) return;
    if (user.id !== detail.userId) return;
    setConfirmOpen(true);
  }, [deletePending, detail, user]);

  const closeConfirm = useCallback(() => {
    if (deletePending) return;
    setConfirmOpen(false);
  }, [deletePending]);

  const handleConfirmDelete = useCallback(async () => {
    if (!detail || !user || deletePending) return;
    if (user.id !== detail.userId) return;
    setDeletePending(true);
    try {
      await deleteMyModel(detail.id);
      setConfirmOpen(false);
      toast.success("模型已删除");
      router.replace("/models/me");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败，请稍后重试。");
    } finally {
      setDeletePending(false);
    }
  }, [deletePending, detail, router, user]);

  if (detailLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-72px)] flex flex-col items-center justify-center gap-3 text-gray-500 bg-[#0a0a0a]">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-[14px]">正在加载模型详情…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-72px)] flex flex-col items-center justify-center gap-3 py-32 text-gray-500 bg-[#0a0a0a]">
        <Grid3X3 className="w-10 h-10 opacity-30" />
        <p className="text-[15px]">{detailError ?? "模型不存在或暂未公开"}</p>
        <Link
          href="/models"
          className="mt-2 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
        >
          返回模型列表
        </Link>
      </div>
    );
  }

  const isRobot = detail.type === "具身智能机器人训练场景";
  const cover = coverStyleByType(detail.type, detail.id);
  const sceneLabels = mergeSceneLabels(detail.tags, detail.scenes);
  const processingBlocked = detail.processingStatus !== "ready";
  const processingHint = processingStatusText(detail.processingStatus);
  // canEmbed：可浏览且有 viewerUrl 且 allowIframe 且 viewerType 非 none 时 iframe 内嵌
  const canEmbed =
    !processingBlocked &&
    !!detail.viewerUrl &&
    detail.allowIframe &&
    detail.viewerType !== "none";
  const description =
    detail.description && detail.description.trim()
      ? detail.description
      : `这是一个高质量的${detail.type}模型，适用于${sceneLabels.join("、") || "多种"}等场景。模型数据精度高，可在线流畅浏览。`;
  const isAuthor = !!user && user.id === detail.userId;

  const handleFullscreen = () => {
    const el = document.getElementById("model-viewer-area");
    if (!document.fullscreenElement) {
      el?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleReset = () => setViewKey((k) => k + 1);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: detail.title, url });
      } catch {
        /* 用户取消分享 */
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  const handleShareSidebar = () => {
    void handleShare();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-64px)]">
        <div
          id="model-viewer-area"
          className="flex-1 relative bg-[#0d0d0d] border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col"
        >
          <div className="flex items-center justify-between px-4 h-12 flex-shrink-0 border-b border-white/[0.06] bg-[#0d0d0d] z-10">
            <Link
              href="/models"
              className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回社区
            </Link>
            <div className="flex items-center gap-2">
              {shareToast && (
                <span className="text-[12px] text-cyan-400 mr-1">链接已复制</span>
              )}
              <button
                type="button"
                onClick={handleFullscreen}
                title="全屏"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Maximize2 className="w-4 h-4 text-gray-400" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="重置视角"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-gray-400" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                title="分享"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Share2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div
            key={viewKey}
            className={`flex-1 relative overflow-hidden bg-gradient-to-br ${cover.color}`}
          >
            {canEmbed ? (
              <iframe
                title={`${detail.title} 三维在线查看器`}
                src={detail.viewerUrl as string}
                loading="lazy"
                allow="autoplay; fullscreen; xr-spatial-tracking"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                className="absolute inset-0 w-full h-full border-0 bg-[#0d0d0d]"
              />
            ) : (
              <>
                <div
                  className="absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />
                <div className="absolute top-4 left-4 w-5 h-5 border-t border-l border-cyan-500/30" />
                <div className="absolute top-4 right-4 w-5 h-5 border-t border-r border-cyan-500/30" />
                <div className="absolute bottom-14 left-4 w-5 h-5 border-b border-l border-cyan-500/30" />
                <div className="absolute bottom-14 right-4 w-5 h-5 border-b border-r border-cyan-500/30" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-24 h-24 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                    <Grid3X3 className="w-10 h-10 text-white/25" />
                  </div>
                  <div className="text-center">
                    <p className="text-white/40 text-[14px]">
                      {processingBlocked ? "模型后台处理状态" : "三维模型在线浏览器"}
                    </p>
                    <p className="text-white/25 text-[12px] mt-1">
                      {processingBlocked ? processingHint : detail.title}
                    </p>
                  </div>
                  {detail.viewerUrl && !canEmbed && !processingBlocked && (
                    <a
                      href={detail.viewerUrl}
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

          <div className="h-12 flex-shrink-0 flex items-center justify-center gap-2 border-t border-white/[0.06] bg-[#0d0d0d]">
            {["旋转", "缩放", "漫游", "测量"].map((ctrl) => (
              <button
                key={ctrl}
                type="button"
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-gray-400 hover:bg-white/10 hover:text-white transition-all"
              >
                {ctrl}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-80 flex-shrink-0 overflow-y-auto">
          <div className="p-5 space-y-4">
            <div>
              <span
                className={`px-2 py-1 rounded-full text-[11px] border ${typeTagColor[detail.type] || "bg-white/10 text-white/60 border-white/10"}`}
              >
                {detail.type}
              </span>
              <h2 className="mt-3 text-[20px] font-semibold leading-tight">
                {detail.title}
              </h2>
            </div>

            <div className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2 text-gray-400">
                <User className="w-3.5 h-3.5" />
                <span>{detail.author}</span>
              </div>
              <div className="flex items-center gap-4 text-gray-400">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  浏览 {formatViews(detail.viewsCount)}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" />
                  收藏 {favs}
                </span>
              </div>
              <div className="text-gray-500">
                {formatRelativeTime(detail.createdAt)}发布
              </div>
            </div>

            {processingBlocked && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3 text-[13px] text-cyan-100">
                <p className="font-medium">
                  {detail.processingStatus === "failed" ? "解析失败" : "后台解析中"}
                </p>
                <p className="mt-1 text-cyan-100/80">{processingHint}</p>
                {detail.processingError && (
                  <p className="mt-2 text-rose-200/90">失败原因：{detail.processingError}</p>
                )}
              </div>
            )}

            {sceneLabels.length > 0 && (
              <div>
                <p className="text-[12px] text-gray-500 mb-2">场景标签</p>
                <div className="flex flex-wrap gap-1.5">
                  {sceneLabels.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-white/5 border border-white/[0.08] text-[12px] text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[12px] text-gray-500 mb-2">模型简介</p>
              <p className="text-[13px] text-gray-400 leading-relaxed">{description}</p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={savePending}
                className={`w-full py-2.5 rounded-xl border text-[14px] transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${saved ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" : "bg-white/5 border-white/10 hover:bg-white/8 text-gray-300"}`}
              >
                <Bookmark className={`w-4 h-4 ${saved ? "fill-yellow-400" : ""}`} />
                {saved ? "已收藏" : "收藏"}
              </button>
              <button
                type="button"
                onClick={handleShareSidebar}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-gray-300 hover:bg-white/8 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                分享
              </button>
              {isRobot && (
                <button
                  type="button"
                  onClick={() => setShowTraining(true)}
                  className="w-full py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 text-[14px] hover:bg-violet-500/25 transition-all"
                >
                  申请训练数据服务
                </button>
              )}
              {isAuthor && (
                <button
                  type="button"
                  onClick={(event) => void handleDelete(event)}
                  disabled={deletePending}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[14px] hover:bg-red-500/15 hover:border-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deletePending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      删除中
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      删除模型
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-12">
          <h3 className="text-[18px] font-semibold mb-6">相关推荐</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((m) => {
              const rc = coverStyleByType(m.type, m.id);
              return (
                <Link
                  key={m.id}
                  href={`/models/${m.id}`}
                  className="group bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all text-left w-full block"
                >
                  <div
                    className={`h-28 bg-gradient-to-br ${rc.color} flex items-center justify-center`}
                  >
                    <Grid3X3 className="w-6 h-6 text-white/20" />
                  </div>
                  <div className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] border ${typeTagColor[m.type] || "bg-white/10 text-white/60 border-white/10"}`}
                    >
                      {m.type}
                    </span>
                    <p className="mt-2 text-[13px] font-medium line-clamp-1">{m.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatViews(m.viewsCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {m.likesCount}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={closeConfirm}
        >
          <div className="absolute inset-0 bg-black/78 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[440px] overflow-hidden rounded-[24px] border border-white/10 bg-[#101010]/95 shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
              <div className="min-w-0">
                <h3 className="text-[20px] font-semibold leading-tight">确认删除模型？</h3>
                <p className="mt-2 text-[13px] leading-6 text-gray-400">
                  删除后该模型将不再展示，相关文件暂不会立即从对象存储删除。此操作当前无法在前台恢复。
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={deletePending}
                aria-label="关闭删除确认弹窗"
                className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-3 px-6 py-5">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={deletePending}
                className="flex-1 rounded-full border border-white/14 bg-white/5 px-5 py-3 text-[14px] text-gray-200 transition-all hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deletePending}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-400/16 bg-red-500/12 px-5 py-3 text-[14px] text-red-200 transition-all hover:bg-red-500/18 hover:border-red-400/24 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletePending && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletePending ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showTraining && <TrainingModal onClose={() => setShowTraining(false)} />}
    </div>
  );
}
