"use client";

/**
 * 用途：分享页 / 移动端 Viewer 壳层判断 coarse 指针 + 小视口 + 横竖屏。
 * 仅在客户端 mount 后返回真实值，避免 SSR hydration 不一致。
 */
import { useEffect, useState } from "react";

export type MobileViewerState = {
  /** 客户端是否已完成首次测量 */
  mounted: boolean;
  /** 粗指针 + 小视口，视为手机分享场景 */
  isMobileShare: boolean;
  /** 当前是否为横屏 */
  isLandscape: boolean;
};

function readMobileViewerState(): Pick<MobileViewerState, "isMobileShare" | "isLandscape"> {
  if (typeof window === "undefined") {
    return { isMobileShare: false, isLandscape: false };
  }

  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const isSmallViewport = window.innerWidth <= 900 || window.innerHeight <= 600;
  const isMobileShare = isCoarsePointer && isSmallViewport;
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;

  return { isMobileShare, isLandscape };
}

export function useMobileViewer(): MobileViewerState {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState(() => readMobileViewerState());

  useEffect(() => {
    setMounted(true);

    const update = () => {
      setState(readMobileViewerState());
    };

    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    const coarseMq = window.matchMedia("(pointer: coarse)");
    const landscapeMq = window.matchMedia("(orientation: landscape)");
    const onMediaChange = () => update();

    coarseMq.addEventListener("change", onMediaChange);
    landscapeMq.addEventListener("change", onMediaChange);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      coarseMq.removeEventListener("change", onMediaChange);
      landscapeMq.removeEventListener("change", onMediaChange);
    };
  }, []);

  if (!mounted) {
    return { mounted: false, isMobileShare: false, isLandscape: false };
  }

  return { mounted: true, ...state };
}

/** 分享页 LCC iframe query：桌面 readonly；手机分享（无论设备方向）额外带 mobile=1 */
export function buildLccShareIframeSrc(modelId: number, mobile: boolean): string {
  const params = new URLSearchParams({
    context: "share",
    readonly: "1",
  });
  if (mobile) {
    params.set("mobile", "1");
  }
  return `/viewer/lcc/${modelId}?${params.toString()}`;
}
