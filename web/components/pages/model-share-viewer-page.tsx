"use client";

/**
 * 页面名称：模型分享沉浸式观看页 ModelShareViewerPage
 * 页面用途：分享链接 /models/[id]/view 的外层壳；手机竖屏提示横屏、横屏沉浸、真实全屏占满屏幕
 * 主要功能：移动端竖屏阻断、横屏沉浸舞台、外层 Fullscreen API + 锁横屏、iframe query（context=share&readonly=1&mobile=1）
 * 对应路由：web/app/models/[id]/view/page.tsx
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Loader2 } from "lucide-react";
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

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

function getCurrentFullscreenElement(doc: Document = document): Element | null {
  const d = doc as FullscreenDocument;
  return doc.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

async function requestElementFullscreen(element: HTMLElement): Promise<void> {
  const el = element as FullscreenCapableElement;
  if (typeof el.requestFullscreen === "function") {
    await el.requestFullscreen();
    return;
  }
  if (typeof el.webkitRequestFullscreen === "function") {
    await el.webkitRequestFullscreen();
  }
}

async function exitDocumentFullscreen(doc: Document = document): Promise<void> {
  const d = doc as FullscreenDocument;
  if (doc.fullscreenElement) {
    await doc.exitFullscreen();
    return;
  }
  if (d.webkitFullscreenElement) {
    await d.webkitExitFullscreen?.();
  }
}

/** 手机竖屏且未全屏：提示用户横屏，不展示模型舞台 */
function MobilePortraitBlocker() {
  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-3 bg-black px-6 text-center"
      data-share-portrait-blocker="true"
    >
      <p className="text-[16px] font-medium text-white">请横屏观看</p>
      <p className="text-[13px] text-gray-500">将手机横置后可进入模型沉浸浏览；也可在横屏后点击「全屏」</p>
    </div>
  );
}

export default function ModelShareViewerPage({ modelId }: { modelId: string }) {
  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  const {
    mounted: mobileMounted,
    isMobileShare,
    isLandscapeDebounced,
  } = useMobileViewer();

  /** 手机分享场景 */
  const showMobileShareShell = mobileMounted && isMobileShare;
  /** 防抖后竖屏（全屏中不因旋转瞬间闪回阻断层） */
  const isPortraitDebounced = showMobileShareShell && !isLandscapeDebounced;
  /** 浏览器真实全屏：外层 #model-share-viewer-fullscreen-root */
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);

  const shouldShowPortraitBlocker =
    showMobileShareShell && isPortraitDebounced && !isViewerFullscreen;
  const shouldShowMobileViewer =
    showMobileShareShell && (!isPortraitDebounced || isViewerFullscreen);

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

  /** 同步外层沉浸根节点的真实全屏状态 */
  const syncFullscreenState = useCallback(() => {
    const root = fullscreenTargetRef.current;
    if (!root) {
      setIsViewerFullscreen(false);
      return;
    }
    const active = getCurrentFullscreenElement();
    setIsViewerFullscreen(active === root);
  }, []);

  useEffect(() => {
    syncFullscreenState();
  }, [syncFullscreenState]);

  useEffect(() => {
    const onFsChange = () => syncFullscreenState();
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    window.addEventListener("orientationchange", onFsChange);
    window.addEventListener("resize", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      window.removeEventListener("orientationchange", onFsChange);
      window.removeEventListener("resize", onFsChange);
    };
  }, [syncFullscreenState]);

  const enterMobileFullscreen = useCallback(async () => {
    const target = fullscreenTargetRef.current;
    if (!target) return false;

    try {
      await requestElementFullscreen(target);
      try {
        const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
        await orientation.lock?.(ORIENTATION_LANDSCAPE);
      } catch {
        /* iOS/Safari 可能不支持 orientation lock，保持全屏横屏沉浸布局 */
      }
      syncFullscreenState();
      return true;
    } catch {
      toast.error("当前浏览器不支持自动全屏，请手动横屏观看");
      return false;
    }
  }, [syncFullscreenState]);

  const exitMobileFullscreen = useCallback(async () => {
    try {
      await exitDocumentFullscreen();
    } finally {
      try {
        const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
        await orientation.unlock?.();
      } catch {
        /* 忽略 */
      }
      syncFullscreenState();
    }
  }, [syncFullscreenState]);

  const toggleMobileFullscreen = useCallback(async () => {
    const root = fullscreenTargetRef.current;
    const active = getCurrentFullscreenElement();
    if (root && active === root) {
      await exitMobileFullscreen();
    } else {
      await enterMobileFullscreen();
    }
  }, [enterMobileFullscreen, exitMobileFullscreen]);

  /** iframe 内工具按钮通过 postMessage 请求外层真实全屏（保留作兜底；主路径为 iframe 直接调 parent root） */
  useEffect(() => {
    if (!showMobileShareShell) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== lccIframeRef.current?.contentWindow) return;
      if (event.data?.type !== "sj-mobile-share-fullscreen-toggle") return;
      void toggleMobileFullscreen();
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [showMobileShareShell, toggleMobileFullscreen]);

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
      if (!showMobileShareShell) {
        setShowFullscreenButton(true);
      }
    } finally {
      setAttemptedAutoFullscreen(true);
    }
  }, [showMobileShareShell]);

  /** 桌面分享页保留 mount 后自动全屏；手机端改由用户点击工具菜单全屏 */
  useEffect(() => {
    if (!detail || detail.processingStatus !== "ready") return;
    if (!mobileMounted) return;
    if (attemptedAutoFullscreen) return;
    if (showMobileShareShell) return;

    const timer = setTimeout(() => {
      void tryAutoFullscreen();
    }, 500);

    return () => clearTimeout(timer);
  }, [detail, mobileMounted, tryAutoFullscreen, attemptedAutoFullscreen, showMobileShareShell]);

  useEffect(() => {
    if (!attemptedAutoFullscreen || showFullscreenButton) return;
    const handleFsChange = () => {
      if (!getCurrentFullscreenElement()) {
        try {
          const orientation = screen.orientation as unknown as ScreenOrientationWithLock;
          orientation.unlock?.();
        } catch {
          /* 忽略 */
        }
      }
      syncFullscreenState();
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, [attemptedAutoFullscreen, showFullscreenButton, syncFullscreenState]);

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
      syncFullscreenState();
    } catch {
      setShowFullscreenButton(true);
    }
  }, [syncFullscreenState]);

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
            className="absolute inset-0 block h-full w-full border-0 bg-black"
            allow="fullscreen"
            allowFullScreen
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

  const mobileShareShellContent = (
    <div
      ref={viewerContainerRef}
      className="relative h-full w-full overflow-hidden touch-none bg-black"
      data-share-mobile-viewer-stage="true"
    >
      {renderViewer()}
    </div>
  );

  const desktopShareShellContent = (
    <>
      <div className="z-30 flex h-11 flex-shrink-0 items-center justify-between bg-black/60 px-3">
        <Link
          href="/models"
          className="flex shrink-0 items-center gap-1.5 text-[13px] text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回社区
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleManualFullscreen}
          title="全屏"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
        >
          <Expand className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <div ref={viewerContainerRef} className="relative min-h-0 flex-1 overflow-hidden landscape:h-full">
        {renderViewer()}
      </div>

      {showFullscreenButton && (
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

  const desktopShareShellRootClass =
    "relative flex h-full w-full max-h-[100dvh] max-w-[100dvw] flex-col overflow-hidden bg-black landscape:max-h-dvh landscape:max-w-dvw";

  const mobileShareRootClass = isViewerFullscreen
    ? "fixed inset-0 z-[9999] h-dvh w-screen overflow-hidden bg-black"
    : "fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-black";

  if (showMobileShareShell) {
    return (
      <>
        {shouldShowPortraitBlocker ? <MobilePortraitBlocker /> : null}
        {shouldShowMobileViewer ? (
          <div
            id="model-share-viewer-fullscreen-root"
            ref={fullscreenTargetRef}
            className={mobileShareRootClass}
            data-share-mobile-shell="true"
            data-share-mobile-fullscreen={isViewerFullscreen ? "true" : "false"}
          >
            {mobileShareShellContent}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div
      id="model-share-viewer-fullscreen-root"
      ref={fullscreenTargetRef}
      className={`fixed inset-0 z-50 ${desktopShareShellRootClass}`}
      data-share-mobile-shell="false"
    >
      {desktopShareShellContent}
    </div>
  );
}
