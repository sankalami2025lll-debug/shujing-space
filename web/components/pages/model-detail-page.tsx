"use client";

/**
 * 页面名称：模型详情页 ModelDetail
 * 页面用途：展示单个模型的三维 Viewer 与元信息
 * 主要功能：GET /api/models/:id、iframe 内嵌 / 占位 / 新窗口打开、全屏/重置/分享
 * 对应文档：页面功能注释文档/06_模型详情_ModelDetail.md
 * 说明：步骤 7C 已接收藏写接口与 TrainingModal。全站 NavBar 由 SiteChrome 挂载。
 */
import { useState, useEffect, useCallback, useRef, useMemo, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Share2,
  Bookmark,
  ArrowLeft,
  Eye,
  Heart,
  User,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { ModelViewerShell } from "@/components/models/model-viewer-shell";
import { TrainingModal } from "@/components/models/training-modal";
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
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  // viewerReady / viewerMountSeed / viewerHostRef：延迟挂载 ModelViewerShell
  // 客户端路由进入详情页时，viewer 容器需要等布局稳定后才能正确初始化
  // 否则首次 renderer.setSize 读到 clientWidth/clientHeight 为 0，导致模型不可见
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerMountSeed, setViewerMountSeed] = useState(0);
  // lccIframeModelLoaded：仅表示 iframe 内 LCC 模型真正 loaded，不表示 iframe 文档已加载
  const [lccIframeModelLoaded, setLccIframeModelLoaded] = useState(false);
  // lccIframeViewerErrored：仅用于外层透出 iframe 内真实 error 态，避免品牌 Loading 永久遮住错误信息
  const [lccIframeViewerErrored, setLccIframeViewerErrored] = useState(false);
  const lccIframeRef = useRef<HTMLIFrameElement | null>(null);
  const lccIframeVisibilityPollRef = useRef<number | null>(null);

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

  /**
   * viewerReady 延迟挂载：等待 viewer 外层容器布局稳定后再渲染 ModelViewerShell。
   * 客户端路由进入时，DOM 尚未完成布局，直接挂载 WebGL renderer 会读到错误的容器尺寸。
   * detail.id / viewerUrl / modelUrl / fileFormat 任一变化时重新走延迟挂载流程。
   */
  useEffect(() => {
    // 模型数据变化时先重置 viewerReady，确保旧实例完全卸载后再挂载新实例
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
        // 容器还未挂载，继续等待
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
        // 尺寸有效：延迟一帧确保浏览器完成合成，然后挂载
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
      // 超过最大尝试次数后强制进入挂载分支，避免非 LCC 模型永远停在外层 Loading。
      forceMountViewer();
    };

    // 跳过 2 帧等布局初始化
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

  // isLccModel：统一识别 LCC/LCC2；命中后当前详情页一律进入 iframe 路由 /viewer/lcc/[id]
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

  // LCC iframe 外层 loading：只根据模型切换重置，不参与 iframe key，避免重复 reload。
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
    if (lccIframeVisibilityPollRef.current !== null) {
      window.clearInterval(lccIframeVisibilityPollRef.current);
      lccIframeVisibilityPollRef.current = null;
    }
    // 每次 iframe 文档 load 都先重置为未完成，只允许后续 data-lcc-loaded 轮询将其置为 true。
    setLccIframeModelLoaded(false);
    setLccIframeViewerErrored(false);

    const pollIframeModelLoaded = () => {
      const frame = lccIframeRef.current;
      const iframeDoc = frame?.contentDocument;
      const childLocation = iframeDoc?.location?.pathname ?? null;
      if (!iframeDoc || childLocation !== lccExpectedPath) return;

      const childRoot = iframeDoc.querySelector("[data-lcc-viewer-status]");
      const childViewerStatus = childRoot?.getAttribute("data-lcc-viewer-status");
      const childLoaded = childRoot?.getAttribute("data-lcc-loaded") === "true";
      const childReasonStable =
        childRoot?.getAttribute("data-lcc-complete-reason") === "onLoadedStable";
      if (childViewerStatus === "error") {
        setLccIframeViewerErrored(true);
        if (lccIframeVisibilityPollRef.current !== null) {
          window.clearInterval(lccIframeVisibilityPollRef.current);
          lccIframeVisibilityPollRef.current = null;
        }
        return;
      }
      if (!childRoot || !childLoaded || !childReasonStable) return;

      setLccIframeModelLoaded(true);
      if (lccIframeVisibilityPollRef.current !== null) {
        window.clearInterval(lccIframeVisibilityPollRef.current);
        lccIframeVisibilityPollRef.current = null;
      }
    };

    // iframe onLoad 只负责开始轮询子文档状态；是否关闭外层 Loading 只看 data-lcc-loaded。
    lccIframeVisibilityPollRef.current = window.setInterval(() => {
      pollIframeModelLoaded();
    }, 250);
  }, [lccExpectedPath]);

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

  const handleLaunchViewSaved = useCallback((launchView: ModelLaunchView) => {
    setDetail((prev) => (prev ? { ...prev, launchView } : prev));
  }, []);

  if (detailLoading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-72px)] bg-[#0a0a0a]">
        <ModelLoadingOverlay visible showText={false} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-72px)] flex flex-col items-center justify-center gap-3 py-32 text-gray-500 bg-[#0a0a0a]">
        <div className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5" />
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
  const sceneLabels = mergeSceneLabels(detail.tags, detail.scenes);
  const processingBlocked = detail.processingStatus !== "ready";
  const processingHint = processingStatusText(detail.processingStatus);
  const description =
    detail.description && detail.description.trim()
      ? detail.description
      : `这是一个高质量的${detail.type}模型，适用于${sceneLabels.join("、") || "多种"}等场景。模型数据精度高，可在线流畅浏览。`;
  const isAuthor = !!user && user.id === detail.userId;
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
    <div className="min-h-[calc(100dvh-4rem)] md:min-h-[calc(100dvh-72px)] bg-[#0a0a0a] text-white lg:h-[calc(100dvh-72px)] lg:overflow-hidden">
      <div className="flex flex-col lg:h-full lg:min-h-0 lg:flex-row">
        <div
          id="model-viewer-area"
          className="relative flex flex-1 flex-col bg-[#0d0d0d] border-b border-white/10 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r"
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
                onClick={handleShare}
                title="分享"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Share2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div
            ref={viewerHostRef}
            className="relative min-h-[60vh] flex-1 overflow-hidden lg:h-full lg:min-h-0"
          >
            {isLcc ? (
              <div
                className="relative h-full w-full"
                data-lcc-detail-model-loaded={lccIframeModelLoaded ? "true" : "false"}
                data-lcc-detail-show-overlay={showLccOuterOverlay ? "true" : "false"}
              >
                {/* LCC/LCC2 模型：iframe 始终挂载；外层只保留唯一一层品牌 Loading。 */}
                <iframe
                  ref={lccIframeRef}
                  key={lccIframeKey}
                  src={`/viewer/lcc/${detail.id}`}
                  className="h-full w-full border-0"
                  allow="fullscreen"
                  title={detail.title}
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
            ) : (
              viewerReady ? (
                // 非 LCC 模型（glb/ply/bim/osgb/iframe 等）：保留原有 ModelViewerShell 逻辑
                <ModelViewerShell
                  key={`${detail.id}-${detail.viewerUrl || ""}-${detail.fileFormat || "none"}-${viewerMountSeed}`}
                  model={detail}
                  onLaunchViewSaved={handleLaunchViewSaved}
                />
              ) : (
                <ModelLoadingOverlay visible showText={false} />
              )
            )}
          </div>
        </div>

        <div className="w-full lg:h-full lg:min-h-0 lg:w-80 lg:flex-shrink-0 lg:overflow-y-auto">
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
