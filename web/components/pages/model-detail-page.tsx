"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Share2,
  Bookmark,
  ArrowLeft,
  Expand,
  Eye,
  Heart,
  User,
  Loader2,
  Trash2,
  Edit,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { ModelViewerShell } from "@/components/models/model-viewer-shell";
import { TrainingModal } from "@/components/models/training-modal";
import EditModelModal from "@/components/models/edit-model-modal";
import { useAuth } from "@/components/providers/auth-provider";
import {
  getModelDetail,
  favoriteModel,
  unfavoriteModel,
  recordModelView,
} from "@/lib/api/models";
import { deleteMyModel } from "@/lib/api/users";
import { formatViews, formatRelativeTime } from "@/lib/format";
import { typeTagColor } from "@/lib/community-data";
import { isLccModel } from "@/lib/model-viewer-kind";
import { ApiError } from "@/lib/http";
import type { ModelDetail, ModelLaunchView } from "@/lib/types";

function toTagArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

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

function RightPanelSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="h-5 w-24 rounded-full bg-white/8" />
      <div className="mt-3 h-6 w-4/5 rounded bg-white/8" />
      <div className="space-y-2 pt-2">
        <div className="h-4 w-2/5 rounded bg-white/6" />
        <div className="h-4 w-3/5 rounded bg-white/6" />
        <div className="h-4 w-1/3 rounded bg-white/6" />
      </div>
      <div className="h-16 rounded-xl bg-white/5" />
      <div className="space-y-2">
        <div className="h-4 w-1/4 rounded bg-white/6" />
        <div className="flex gap-1.5">
          <div className="h-6 w-14 rounded-full bg-white/6" />
          <div className="h-6 w-16 rounded-full bg-white/6" />
          <div className="h-6 w-12 rounded-full bg-white/6" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-1/4 rounded bg-white/6" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded bg-white/5" />
          <div className="h-3.5 w-4/5 rounded bg-white/5" />
        </div>
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-11 w-full rounded-xl bg-white/6" />
        <div className="h-11 w-full rounded-xl bg-white/6" />
      </div>
    </div>
  );
}

export default function ModelDetailPage({ modelId }: ModelDetailPageProps) {
  const router = useRouter();
  const { user, isAuthed } = useAuth();

  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [shareToast, setShareToast] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favs, setFavs] = useState(0);
  const [savePending, setSavePending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const viewedRef = useRef<number | null>(null);

  const modelViewerAreaRef = useRef<HTMLDivElement | null>(null);
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerMountSeed, setViewerMountSeed] = useState(0);
  const [lccIframeModelLoaded, setLccIframeModelLoaded] = useState(false);
  const [lccIframeViewerErrored, setLccIframeViewerErrored] = useState(false);
  const lccIframeRef = useRef<HTMLIFrameElement | null>(null);
  const lccIframeVisibilityPollRef = useRef<number | null>(null);

  /* ---- 监听 LCC iframe 内部 postMessage 的 viewerReady 信号 ---- */
  const handleLccViewerReadyMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== "SHUJING_LCC_VIEWER_READY") return;

    setLccIframeModelLoaded(true);
    if (lccIframeVisibilityPollRef.current !== null) {
      window.clearInterval(lccIframeVisibilityPollRef.current);
      lccIframeVisibilityPollRef.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleLccViewerReadyMessage);
    return () => window.removeEventListener("message", handleLccViewerReadyMessage);
  }, [handleLccViewerReadyMessage]);

  const requireAuth = useCallback(() => {
    toast.error("请先登录后再操作");
    router.push("/auth");
  }, [router]);

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

  useEffect(() => {
    if (!idValid) return;
    if (detail && detail.processingStatus !== "ready") return;
    if (viewedRef.current === numericId) return;
    viewedRef.current = numericId;
    recordModelView(numericId)
      .then((res) => {
        setDetail((prev) =>
          prev && prev.id === numericId
            ? { ...prev, viewsCount: res.viewsCount }
            : prev,
        );
      })
      .catch(() => {});
  }, [detail, idValid, numericId]);

  useEffect(() => {
    setViewerReady(false);

    let disposed = false;
    let attempts = 0;
    const maxAttempts = 30;
    const forceMountViewer = () => {
      setViewerMountSeed((value) => value + 1);
      setViewerReady(true);
    };

    const check = () => {
      if (disposed) return;

      const el = viewerHostRef.current;
      if (!el) {
        if (attempts++ < maxAttempts) {
          requestAnimationFrame(check);
        } else {
          forceMountViewer();
        }
        return;
      }

      const rect = el.getBoundingClientRect();
      const width = rect?.width ?? 0;
      const height = rect?.height ?? 0;

      if (width > 100 && height > 100) {
        requestAnimationFrame(() => {
          if (disposed) return;
          forceMountViewer();
        });
        return;
      }

      if (attempts++ < maxAttempts) {
        requestAnimationFrame(check);
        return;
      }
      forceMountViewer();
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(check);
    });

    return () => {
      disposed = true;
      setViewerReady(false);
    };
  }, [detail?.id, detail?.viewerUrl, detail?.fileFormat]);

  useEffect(() => {
    if (!detail) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    setSaved(detail.isFavorited ?? false);
    setFavs(detail.favoritesCount);
  }, [detail]);

  const isLcc = isLccModel({
    viewerType: detail?.viewerType ?? "none",
    fileFormat: detail?.fileFormat ?? "",
    viewerUrl: detail?.viewerUrl ?? "",
  });
  const showLccOuterOverlay = isLcc && !lccIframeModelLoaded && !lccIframeViewerErrored;
  const lccExpectedPath = detail?.id ? `/viewer/lcc/${detail.id}` : null;
  const lccIframeKey = useMemo(
    () => `${detail?.id ?? "pending"}-${detail?.viewerUrl || ""}`,
    [detail?.id, detail?.viewerUrl],
  );

  const handleViewerFullscreen = useCallback(async () => {
    const viewerArea = modelViewerAreaRef.current;
    if (!viewerArea) return;

    try {
      if (document.fullscreenElement === viewerArea) {
        try {
          const orientation = screen.orientation as ScreenOrientation & { unlock?: () => Promise<void> };
          await orientation.unlock?.();
        } catch { /* 忽略 */ }
        await document.exitFullscreen();
        return;
      }

      await viewerArea.requestFullscreen();

      // 进入全屏后尝试锁定横屏
      try {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
        await orientation.lock?.("landscape");
      } catch {
        toast.info("当前浏览器不支持自动横屏，请手动旋转手机横屏浏览");
      }
    } catch {
      toast.error("当前浏览器暂不支持全屏");
    }
  }, []);

  useEffect(() => {
    if (!detail || !isLcc) return;

    if (lccIframeVisibilityPollRef.current !== null) {
      window.clearInterval(lccIframeVisibilityPollRef.current);
      lccIframeVisibilityPollRef.current = null;
    }
    setLccIframeModelLoaded(false);
    setLccIframeViewerErrored(false);

    return () => {
      if (lccIframeVisibilityPollRef.current !== null) {
        window.clearInterval(lccIframeVisibilityPollRef.current);
        lccIframeVisibilityPollRef.current = null;
      }
    };
  }, [detail, isLcc]);

  const handleLccIframeLoad = useCallback(() => {
    // iframe 加载完成后自动聚焦，使其接收键盘事件（WASD 漫游）
    lccIframeRef.current?.focus({ preventScroll: true });
    setTimeout(() => lccIframeRef.current?.focus({ preventScroll: true }), 600);

    if (lccIframeVisibilityPollRef.current !== null) {
      window.clearInterval(lccIframeVisibilityPollRef.current);
      lccIframeVisibilityPollRef.current = null;
    }
    setLccIframeModelLoaded(false);
    setLccIframeViewerErrored(false);

    const pollStartedAt = Date.now();

    const pollIframeModelLoaded = () => {
      const frame = lccIframeRef.current;
      const iframeDoc = frame?.contentDocument;
      const childLocation = iframeDoc?.location?.pathname ?? null;
      if (!iframeDoc || childLocation !== lccExpectedPath) return;

      const childRoot = iframeDoc.querySelector("[data-lcc-viewer-status]");
      const childViewerStatus = childRoot?.getAttribute("data-lcc-viewer-status");
      const childViewerReady = childRoot?.getAttribute("data-lcc-viewer-ready") === "true";
      if (childViewerStatus === "error") {
        setLccIframeViewerErrored(true);
        if (lccIframeVisibilityPollRef.current !== null) {
          window.clearInterval(lccIframeVisibilityPollRef.current);
          lccIframeVisibilityPollRef.current = null;
        }
        return;
      }
      if (!childRoot || !childViewerReady) {
        if (Date.now() - pollStartedAt > 30000) {
          const childFirstFrame = childRoot?.getAttribute("data-lcc-first-frame") === "true";
          const childLoaded = childRoot?.getAttribute("data-lcc-loaded") === "true";
          if (childFirstFrame && childLoaded) {
            setLccIframeModelLoaded(true);
            if (lccIframeVisibilityPollRef.current !== null) {
              window.clearInterval(lccIframeVisibilityPollRef.current);
              lccIframeVisibilityPollRef.current = null;
            }
          }
        }
        return;
      }

      setLccIframeModelLoaded(true);
      if (lccIframeVisibilityPollRef.current !== null) {
        window.clearInterval(lccIframeVisibilityPollRef.current);
        lccIframeVisibilityPollRef.current = null;
      }
    };

    lccIframeVisibilityPollRef.current = window.setInterval(() => {
      pollIframeModelLoaded();
    }, 250);
  }, [lccExpectedPath]);

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

  const handleLaunchViewSaved = useCallback((launchView: ModelLaunchView) => {
    setDetail((prev) => (prev ? { ...prev, launchView } : prev));
  }, []);

  // --- 稳定布局 — 始终渲染左右两侧 ---
  const detailExists = !!detail;

  const isRobot = detail?.type === "具身智能机器人训练场景";
  const sceneLabels = detail ? mergeSceneLabels(detail.tags, detail.scenes) : [];
  const processingBlocked = detail ? detail.processingStatus !== "ready" : false;
  const processingHint = detail ? processingStatusText(detail.processingStatus) : "";
  const description =
    detail?.description && detail.description.trim()
      ? detail.description
      : detail
        ? `这是一个高质量的${detail.type}模型，适用于${sceneLabels.join("、") || "多种"}等场景。模型数据精度高，可在线流畅浏览。`
        : "";
  const isAuthor = !!user && !!detail && user.id === detail.userId;

  const handleShare = async () => {
    const origin = window.location.origin;
    const url = `${origin}/models/${detail?.id}/view`;
    if (navigator.share) {
      try {
        await navigator.share({ title: detail?.title, url });
      } catch { }
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
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white lg:h-[calc(100dvh-72px)] lg:overflow-hidden">
      <div className="flex flex-col lg:h-full lg:min-h-0 lg:flex-row">
        {/* 左侧 Viewer */}
        <div
          ref={modelViewerAreaRef}
          id="model-viewer-area"
          className="relative flex flex-1 flex-col bg-[#0d0d0d] border-b border-white/10 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r"
        >
          {detailExists ? (
            <>
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
                    onClick={handleViewerFullscreen}
                    title="全屏"
                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
                  >
                    <Expand className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div
                ref={viewerHostRef}
                className="relative h-[58dvh] min-h-[400px] max-h-[70dvh] flex-1 overflow-hidden lg:h-full lg:min-h-0 lg:max-h-none"
              >
                {isLcc ? (
                  <div
                    className="relative h-full w-full"
                    data-lcc-detail-model-loaded={lccIframeModelLoaded ? "true" : "false"}
                    data-lcc-detail-show-overlay={showLccOuterOverlay ? "true" : "false"}
                  >
                    <iframe
                      ref={lccIframeRef}
                      key={lccIframeKey}
                      src={`/viewer/lcc/${detail.id}`}
                      className="h-full w-full border-0"
                      allow="fullscreen"
                      title={detail.title}
                      tabIndex={0}
                      onLoad={handleLccIframeLoad}
                    />
                    <div
                      data-lcc-outer-overlay="true"
                      className={
                        showLccOuterOverlay
                          ? "absolute inset-0 z-20 opacity-100 pointer-events-auto transition-opacity duration-300"
                          : "absolute inset-0 z-20 opacity-0 pointer-events-none transition-opacity duration-300"
                      }
                    >
                      <ModelLoadingOverlay visible showText={false} />
                    </div>
                  </div>
                ) : viewerReady ? (
                  <ModelViewerShell
                    key={`${detail.id}-${viewerMountSeed}`}
                    model={detail}
                    onLaunchViewSaved={handleLaunchViewSaved}
                  />
                ) : (
                  <ModelLoadingOverlay visible showText={false} />
                )}
              </div>
            </>
          ) : (
            <div className="relative flex h-full min-h-[400px] lg:min-h-0 flex-1 items-center justify-center">
              {detailLoading ? (
                <ModelLoadingOverlay visible showText={false} />
              ) : (
                <div className="flex flex-col items-center gap-3 py-32 text-gray-500">
                  <div className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5" />
                  <p className="text-[15px]">{detailError ?? "模型不存在或暂未公开"}</p>
                  <Link
                    href="/models"
                    className="mt-2 px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
                  >
                    返回模型列表
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右侧信息栏 — 始终渲染，不随 viewer 状态变化 */}
        <div
          id="model-info-panel"
          className="w-full flex-shrink-0 lg:h-full lg:min-h-0 lg:w-80 lg:flex-shrink-0 lg:overflow-y-auto"
        >
          {detailLoading || !detail ? (
            <RightPanelSkeleton />
          ) : (
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
                  <>
                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-gray-300 hover:bg-white/8 transition-all flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      编辑模型
                    </button>
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
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
      {detail && showEditModal && (
        <EditModelModal
          open={showEditModal}
          model={detail}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setDetail(updated);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
