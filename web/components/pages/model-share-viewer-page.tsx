"use client";

/**
 * 页面名称：模型分享沉浸式观看页 ModelShareViewerPage
 * 页面用途：分享链接 /models/[id]/view 的外层壳；手机直接进入横屏 viewer（必要时页面级旋转舞台），桌面保持原分享壳
 * 主要功能：移动端识别、页面级强制横屏布局、iframe query（context=share&readonly=1[&mobile=1]）、桌面全屏
 * 对应路由：web/app/models/[id]/view/page.tsx
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Loader2 } from "lucide-react";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { getModelDetail } from "@/lib/api/models";
import { isLccModel } from "@/lib/model-viewer-kind";
import { ApiError } from "@/lib/http";
import { buildLccShareIframeSrc, useMobileViewer } from "@/lib/use-mobile-viewer";
import type { ModelDetail } from "@/lib/types";

const ORIENTATION_LANDSCAPE = "landscape" as const;

/** 手机竖屏且无法系统横屏时：用 CSS 旋转实现页面级横屏舞台，不提示用户旋转 */
function MobileForcedLandscapeStage({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden bg-black"
        style={{
          width: "100dvh",
          height: "100dvw",
          transform: "translate(-50%, -50%) rotate(90deg)",
          transformOrigin: "center center",
        }}
        data-share-forced-landscape-stage="true"
      >
        {children}
      </div>
    </div>
  );
}

interface ScreenOrientationWithLock {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => Promise<void>;
}

export default function ModelShareViewerPage({ modelId }: { modelId: string }) {
  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  const { mounted: mobileMounted, isMobileShare, isLandscape } = useMobileViewer();
  /** 手机分享场景：无论设备方向，直接进入横屏 viewer 形态（不再显示竖屏阻断页） */
  const showMobileShareShell = mobileMounted && isMobileShare;
  /** 手机竖屏时浏览器无法系统横屏：用页面级旋转舞台铺满横屏画面 */
  const useForcedLandscapeStage = showMobileShareShell && !isLandscape;

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
    ? buildLccShareIframeSrc(detail.id, showMobileShareShell)
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
      // 手机端不展示全屏降级按钮；桌面才提示手动全屏
      if (!showMobileShareShell) {
        setShowFullscreenButton(true);
      }
    } finally {
      setAttemptedAutoFullscreen(true);
    }
  }, [showMobileShareShell]);

  useEffect(() => {
    if (!detail || detail.processingStatus !== "ready") return;
    if (!mobileMounted) return;
    if (attemptedAutoFullscreen) return;

    const timer = setTimeout(() => {
      void tryAutoFullscreen();
    }, 500);

    return () => clearTimeout(timer);
  }, [detail, mobileMounted, tryAutoFullscreen, attemptedAutoFullscreen]);

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
      setShowFullscreenButton(true);
    }
  }, []);

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
          data-share-mobile-shell={showMobileShareShell ? "true" : "false"}
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

  // 分享壳内容：手机为沉浸式横屏 viewer；桌面保留原顶栏与全屏
  const shareShellContent = (
    <>
      <div
        className={`z-30 flex flex-shrink-0 items-center justify-between px-3 ${
          showMobileShareShell ? "h-10 bg-black/50 backdrop-blur-sm" : "h-11 bg-black/60"
        }`}
      >
        <Link
          href="/models"
          className="flex shrink-0 items-center gap-1.5 text-[13px] text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {showMobileShareShell ? "返回" : "返回社区"}
        </Link>

        {showMobileShareShell ? (
          <p className="min-w-0 flex-1 truncate px-2 text-center text-[13px] text-gray-200">
            {detail.title}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {!showMobileShareShell && (
          <button
            type="button"
            onClick={handleManualFullscreen}
            title="全屏"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
          >
            <Expand className="h-4 w-4 text-gray-400" />
          </button>
        )}

        {showMobileShareShell && <div className="w-12 shrink-0" aria-hidden />}
      </div>

      <div
        ref={viewerContainerRef}
        className={`relative min-h-0 flex-1 overflow-hidden ${
          showMobileShareShell ? "h-[calc(100%-2.5rem)] w-full touch-none" : "landscape:h-full"
        }`}
      >
        {renderViewer()}
      </div>

      {showFullscreenButton && !showMobileShareShell && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-10 pt-20">
          <button
            type="button"
            onClick={handleManualFullscreen}
            className="pointer-events-auto rounded-2xl border border-cyan-400/30 bg-cyan-950/60 px-8 py-3 text-[15px] font-medium text-cyan-200 backdrop-blur-md transition-all hover:border-cyan-300/50 hover:bg-cyan-900/70 active:scale-95"
          >
            进入全屏观看
          </button>
        </div>
      )}
    </>
  );

  const shareShellRootClass =
    "relative flex flex-col overflow-hidden bg-black max-h-[100dvh] max-w-[100dvw] landscape:max-h-dvh landscape:max-w-dvw h-full w-full";

  if (useForcedLandscapeStage) {
    return (
      <MobileForcedLandscapeStage>
        <div
          id="model-share-viewer-fullscreen-root"
          ref={fullscreenTargetRef}
          className={shareShellRootClass}
          data-share-mobile-forced-landscape="true"
        >
          {shareShellContent}
        </div>
      </MobileForcedLandscapeStage>
    );
  }

  return (
    <div
      id="model-share-viewer-fullscreen-root"
      ref={fullscreenTargetRef}
      className={`fixed inset-0 z-50 ${shareShellRootClass}`}
      data-share-mobile-shell={showMobileShareShell ? "true" : "false"}
    >
      {shareShellContent}
    </div>
  );
}
