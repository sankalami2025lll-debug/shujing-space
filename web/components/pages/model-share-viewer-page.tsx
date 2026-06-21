"use client";

/**
 * 页面名称：模型分享沉浸式观看页 ModelShareViewerPage
 * 页面用途：分享链接 /models/[id]/view 的外层壳；桌面与手机横屏展示 LCC iframe，手机竖屏阻断并提示横屏
 * 主要功能：移动端识别、竖屏横屏阻断、iframe query（context=share&readonly=1[&mobile=1]）、全屏/横屏锁定
 * 对应路由：web/app/models/[id]/view/page.tsx
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { getModelDetail } from "@/lib/api/models";
import { isLccModel } from "@/lib/model-viewer-kind";
import { ApiError } from "@/lib/http";
import { buildLccShareIframeSrc, useMobileViewer } from "@/lib/use-mobile-viewer";
import type { ModelDetail } from "@/lib/types";

const ORIENTATION_LANDSCAPE = "landscape" as const;

interface ScreenOrientationWithLock {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => Promise<void>;
}

export default function ModelShareViewerPage({ modelId }: { modelId: string }) {
  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  const { mounted: mobileMounted, isMobileShare, isLandscape } = useMobileViewer();
  const showMobilePortraitBlock = mobileMounted && isMobileShare && !isLandscape;
  const showMobileLandscapeShell = mobileMounted && isMobileShare && isLandscape;

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
  const lccExpectedPath = detail?.id ? `/viewer/lcc/${detail.id}` : null;
  const lccIframeSrc = detail?.id
    ? buildLccShareIframeSrc(detail.id, showMobileLandscapeShell)
    : null;
  const lccIframeKey = `${detail?.id ?? "pending"}-${detail?.viewerUrl || ""}-${lccIframeSrc ?? ""}`;
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
    // 手机竖屏阻断层不挂载 viewer，跳过自动全屏
    if (showMobilePortraitBlock) return;

    const timer = setTimeout(() => {
      void tryAutoFullscreen();
    }, 500);

    return () => clearTimeout(timer);
  }, [detail, tryAutoFullscreen, attemptedAutoFullscreen, showMobilePortraitBlock]);

  useEffect(() => {
    if (!attemptedAutoFullscreen || showFullscreenButton) return;
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        try {
          const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
          orientation.unlock?.();
        } catch {
          /* 忽略 */
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [attemptedAutoFullscreen, showFullscreenButton]);

  /** 手机竖屏：尝试全屏 + 锁定横屏；失败静默，继续显示提示层 */
  const handlePortraitEnterLandscape = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      try {
        const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
        await orientation.lock?.(ORIENTATION_LANDSCAPE);
      } catch {
        // iOS / 微信等环境可能不支持，正常降级
      }
    } catch {
      // 失败不 toast，用户可手动旋转设备
    }
  }, []);

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
      if (showMobileLandscapeShell) {
        toast.info("当前浏览器不支持自动横屏，请手动旋转手机横屏浏览");
      } else {
        toast.info("当前浏览器暂不支持全屏");
      }
    }
  }, [showMobileLandscapeShell]);

  const handleLccIframeLoad = useCallback(() => {
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
      const childFirstFrame = childRoot?.getAttribute("data-lcc-first-frame") === "true";
      if (childViewerStatus === "error") {
        setLccIframeViewerErrored(true);
        if (lccIframeVisibilityPollRef.current !== null) {
          window.clearInterval(lccIframeVisibilityPollRef.current);
          lccIframeVisibilityPollRef.current = null;
        }
        return;
      }
      if (!childRoot || !childFirstFrame) {
        if (Date.now() - pollStartedAt > 30000) {
          setLccIframeModelLoaded(true);
          if (lccIframeVisibilityPollRef.current !== null) {
            window.clearInterval(lccIframeVisibilityPollRef.current);
            lccIframeVisibilityPollRef.current = null;
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
  }, [detail, isLcc, lccIframeSrc]);

  const renderViewer = () => {
    if (!detail) return null;

    if (isLcc && lccIframeSrc) {
      return (
        <div
          className="relative h-full w-full touch-none"
          data-lcc-detail-model-loaded={lccIframeModelLoaded ? "true" : "false"}
          data-lcc-detail-show-overlay={showLccOuterOverlay ? "true" : "false"}
          data-share-mobile-shell={showMobileLandscapeShell ? "true" : "false"}
        >
          <iframe
            ref={lccIframeRef}
            key={lccIframeKey}
            src={lccIframeSrc}
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

  // 手机竖屏：阻断模型 iframe，仅展示横屏引导
  if (showMobilePortraitBlock) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 text-center"
        data-share-portrait-block="true"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <RotateCw className="h-8 w-8 text-cyan-400/90" aria-hidden />
        </div>
        <h1 className="text-[20px] font-medium text-white">请横屏浏览模型</h1>
        <p className="mt-3 max-w-[280px] text-[14px] leading-relaxed text-gray-400">
          为了获得更好的三维浏览体验，请将手机横向放置。
        </p>
        <button
          type="button"
          onClick={() => {
            void handlePortraitEnterLandscape();
          }}
          className="mt-8 rounded-full border border-cyan-400/35 bg-cyan-950/50 px-8 py-3 text-[15px] font-medium text-cyan-200 transition-all hover:border-cyan-300/50 hover:bg-cyan-900/60 active:scale-[0.98]"
        >
          进入横屏浏览
        </button>
      </div>
    );
  }

  return (
    <div
      id="model-share-viewer-fullscreen-root"
      ref={fullscreenTargetRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black max-h-[100dvh] max-w-[100dvw] landscape:max-h-dvh landscape:max-w-dvw"
      data-share-mobile-landscape={showMobileLandscapeShell ? "true" : "false"}
    >
      {/* 顶栏：手机横屏更轻量；桌面保留返回 + 全屏 */}
      <div
        className={`z-30 flex flex-shrink-0 items-center justify-between px-3 ${
          showMobileLandscapeShell ? "h-10 bg-black/50 backdrop-blur-sm" : "h-11 bg-black/60"
        }`}
      >
        <Link
          href="/models"
          className="flex shrink-0 items-center gap-1.5 text-[13px] text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {showMobileLandscapeShell ? "返回" : "返回社区"}
        </Link>

        {showMobileLandscapeShell ? (
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
            <p className="truncate text-[13px] text-gray-200">{detail.title}</p>
            <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-400">
              第一人称
            </span>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <button
          type="button"
          onClick={handleManualFullscreen}
          title="全屏"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
        >
          <Expand className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Viewer 区域 */}
      <div
        ref={viewerContainerRef}
        className={`relative min-h-0 flex-1 overflow-hidden ${
          showMobileLandscapeShell
            ? "h-[calc(100dvh-2.5rem)] w-full touch-none"
            : "landscape:h-full"
        }`}
      >
        {renderViewer()}
      </div>

      {/* 自动全屏失败降级：桌面不展示「建议横屏」文案；手机横屏保留横屏提示 */}
      {showFullscreenButton && !showMobilePortraitBlock && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-10 pt-20">
          <button
            type="button"
            onClick={handleManualFullscreen}
            className="pointer-events-auto rounded-2xl border border-cyan-400/30 bg-cyan-950/60 px-8 py-3 text-[15px] font-medium text-cyan-200 backdrop-blur-md transition-all hover:border-cyan-300/50 hover:bg-cyan-900/70 active:scale-95"
          >
            {showMobileLandscapeShell ? "进入横屏全屏观看" : "进入全屏观看"}
          </button>
          {showMobileLandscapeShell && (
            <p className="pointer-events-auto text-[12px] text-gray-500">建议横屏观看</p>
          )}
        </div>
      )}
    </div>
  );
}
