"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { getModelDetail } from "@/lib/api/models";
import { isLccModel } from "@/lib/model-viewer-kind";
import { ApiError } from "@/lib/http";
import type { ModelDetail } from "@/lib/types";

const ORIENTATION_LANDSCAPE = "landscape" as const;

interface ScreenOrientationWithLock {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => Promise<void>;
}

export default function ModelShareViewerPage({ modelId }: { modelId: string }) {
  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showFullscreenButton, setShowFullscreenButton] = useState(false);
  const [attemptedAutoFullscreen, setAttemptedAutoFullscreen] = useState(false);

  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  const isLcc = isLccModel({
    viewerType: detail?.viewerType ?? "none",
    fileFormat: detail?.fileFormat ?? "",
    viewerUrl: detail?.viewerUrl ?? "",
  });

  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null);
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
  const lccExpectedPath = detail?.id ? `/viewer/lcc/${detail.id}` : null;
  const lccIframeKey = `${detail?.id ?? "pending"}-${detail?.viewerUrl || ""}`;
  const showLccOuterOverlay = isLcc && !lccIframeModelLoaded && !lccIframeViewerErrored;

  useEffect(() => {
    if (!idValid) {
      setDetailLoading(false);
      setDetailError("模型不存在或暂不可访问");
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
              ? "模型不存在或暂不可访问"
              : e.message
            : "模型加载失败，请稍后重试。";
        setDetailError(msg);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [idValid, numericId]);

  const tryAutoFullscreen = useCallback(async () => {
    const el = fullscreenTargetRef.current;
    if (!el) return;

    try {
      await el.requestFullscreen();
      try {
        const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
        await orientation.lock?.(ORIENTATION_LANDSCAPE);
      } catch {
        // orientation lock 失败静默处理
      }
      setShowFullscreenButton(false);
    } catch {
      setShowFullscreenButton(true);
    } finally {
      setAttemptedAutoFullscreen(true);
    }
  }, []);

  useEffect(() => {
    if (!detail || detail.processingStatus !== "ready") return;
    if (attemptedAutoFullscreen) return;

    // 延迟一下等 DOM 就绪
    const timer = setTimeout(() => {
      void tryAutoFullscreen();
    }, 500);

    return () => clearTimeout(timer);
  }, [detail, tryAutoFullscreen, attemptedAutoFullscreen]);

  useEffect(() => {
    if (!attemptedAutoFullscreen || showFullscreenButton) return;
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        try {
          const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
          orientation.unlock?.();
        } catch { /* 忽略 */ }
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [attemptedAutoFullscreen, showFullscreenButton]);

  const handleManualFullscreen = useCallback(async () => {
    const el = fullscreenTargetRef.current;
    if (!el) return;

    try {
      await el.requestFullscreen();
      try {
        const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
        await orientation.lock?.(ORIENTATION_LANDSCAPE);
      } catch {
        // orientation lock 失败静默处理
      }
      setShowFullscreenButton(false);
    } catch {
      toast.info("当前浏览器不支持自动横屏，请手动旋转手机横屏浏览");
    }
  }, []);

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

  const renderViewer = () => {
    if (!detail) return null;

    if (isLcc) {
      return (
        <div className="relative h-full w-full"
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
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center text-gray-500">
        <p>当前模型格式暂不支持沉浸式预览</p>
      </div>
    );
  };

  if (detailLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (detailError || !detail) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black text-white">
        <p className="text-[15px] text-gray-400">{detailError ?? "模型不存在或暂不可访问"}</p>
        <Link
          href="/models"
          className="px-6 py-2.5 rounded-full bg-white/8 border border-white/10 text-[14px] text-gray-200 hover:bg-white/12 hover:border-white/20 transition-all"
        >
          返回模型列表
        </Link>
      </div>
    );
  }

  return (
    <div
      id="model-share-viewer-fullscreen-root"
      ref={fullscreenTargetRef}
      className="fixed inset-0 z-50 flex flex-col bg-black overflow-hidden
        landscape:max-h-dvh landscape:max-w-dvw"
    >
      {/* 极简顶栏 */}
      <div className="flex items-center justify-between px-3 h-11 flex-shrink-0 bg-black/60 z-30">
        <Link
          href="/models"
          className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回社区
        </Link>
        <button
          type="button"
          onClick={handleManualFullscreen}
          title="全屏"
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
        >
          <Expand className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Viewer 区域 */}
      <div
        ref={viewerContainerRef}
        className="relative flex-1 overflow-hidden
          landscape:h-full"
      >
        {renderViewer()}
      </div>

      {/* 横屏提示 + 全屏入口（自动全屏失败后显示） */}
      {showFullscreenButton && (
        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 pb-10 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
          <button
            type="button"
            onClick={handleManualFullscreen}
            className="pointer-events-auto px-8 py-3 rounded-2xl border border-cyan-400/30 bg-cyan-950/60 text-cyan-200 text-[15px] font-medium backdrop-blur-md
              hover:bg-cyan-900/70 hover:border-cyan-300/50 transition-all active:scale-95"
          >
            进入横屏全屏观看
          </button>
          <p className="text-[12px] text-gray-500 pointer-events-auto">建议横屏观看</p>
        </div>
      )}
    </div>
  );
}
