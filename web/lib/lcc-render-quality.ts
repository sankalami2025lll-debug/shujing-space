/**
 * LCC/LCC2 渲染质量档位：设置面板「性能 / 平衡 / 质量」与 SDK externalConfig 映射。
 * 仅前端本地偏好，不写后端、不改入口 URL / dataPath。
 */

export type LccRenderQuality = "performance" | "balanced" | "quality";

export type LccRenderQualityLabel = "性能" | "平衡" | "质量";

export const LCC_RENDER_QUALITY_STORAGE_KEY = "shujing:lcc-render-quality";

export const LCC_RENDER_QUALITY_LABELS: Record<LccRenderQuality, LccRenderQualityLabel> = {
  performance: "性能",
  balanced: "平衡",
  quality: "质量",
};

export const LCC_RENDER_QUALITY_FROM_LABEL: Record<LccRenderQualityLabel, LccRenderQuality> = {
  性能: "performance",
  平衡: "balanced",
  质量: "quality",
};

/** 三档 → SDK 公开入参（maxHostCacheSize / maxGpuCacheSize / 并发） */
export const LCC_RENDER_QUALITY_CONFIG: Record<
  LccRenderQuality,
  {
    maxConcurrentDownloads: number;
    workerPerFrameRequests: number;
    maxHostCacheSize: number;
    maxGpuCacheSize: number;
  }
> = {
  performance: {
    maxConcurrentDownloads: 2,
    workerPerFrameRequests: 1,
    maxHostCacheSize: 536_870_912,
    maxGpuCacheSize: 536_870_912,
  },
  balanced: {
    maxConcurrentDownloads: 4,
    workerPerFrameRequests: 2,
    maxHostCacheSize: 1_073_741_824,
    maxGpuCacheSize: 1_073_741_824,
  },
  quality: {
    maxConcurrentDownloads: 6,
    workerPerFrameRequests: 3,
    maxHostCacheSize: 1_610_612_736,
    maxGpuCacheSize: 2_147_483_648,
  },
};

/** 省流量模式强制保守配置（比 performance 更低） */
export const LCC_RENDER_QUALITY_SAVE_DATA = {
  maxConcurrentDownloads: 1,
  workerPerFrameRequests: 1,
} as const;

export function isLccRenderQuality(value: unknown): value is LccRenderQuality {
  return value === "performance" || value === "balanced" || value === "quality";
}

export function labelToLccRenderQuality(label: LccRenderQualityLabel): LccRenderQuality {
  return LCC_RENDER_QUALITY_FROM_LABEL[label];
}

export function lccRenderQualityToLabel(quality: LccRenderQuality): LccRenderQualityLabel {
  return LCC_RENDER_QUALITY_LABELS[quality];
}

/** 手机端最高只能 performance，不允许 balanced/quality 高缓存 */
export function clampLccRenderQualityForDevice(
  quality: LccRenderQuality,
  isMobileViewer: boolean,
): LccRenderQuality {
  if (isMobileViewer) return "performance";
  return quality;
}

/**
 * 解析初始档位：
 * 1. localStorage 用户选择优先
 * 2. 否则 URL ?lccQuality=high → quality（仅桌面）
 * 3. 否则桌面 balanced / 手机 performance
 */
export function resolveInitialLccRenderQuality(isMobileViewer: boolean): LccRenderQuality {
  if (typeof window === "undefined") {
    return isMobileViewer ? "performance" : "balanced";
  }

  try {
    const stored = window.localStorage.getItem(LCC_RENDER_QUALITY_STORAGE_KEY);
    if (isLccRenderQuality(stored)) {
      return clampLccRenderQualityForDevice(stored, isMobileViewer);
    }
  } catch {
    // localStorage 不可用时忽略
  }

  const urlHigh =
    new URLSearchParams(window.location.search).get("lccQuality") === "high";
  if (urlHigh && !isMobileViewer) {
    return "quality";
  }

  return isMobileViewer ? "performance" : "balanced";
}

export function persistLccRenderQuality(quality: LccRenderQuality): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LCC_RENDER_QUALITY_STORAGE_KEY, quality);
  } catch {
    // 忽略配额 / 隐私模式失败
  }
}

export function getLccExternalConfigForRenderQuality(args: {
  renderQuality: LccRenderQuality;
  isMobileViewer: boolean;
  saveDataEnabled: boolean;
}) {
  const { isMobileViewer, saveDataEnabled } = args;
  const renderQuality = clampLccRenderQualityForDevice(
    args.renderQuality,
    isMobileViewer,
  );

  // 手机端：强制 performance 档（2/1/512MB），禁止 quality 高缓存
  if (isMobileViewer) {
    const config = LCC_RENDER_QUALITY_CONFIG.performance;
    return {
      renderQuality: "performance" as const,
      maxConcurrentDownloads: config.maxConcurrentDownloads,
      workerPerFrameRequests: config.workerPerFrameRequests,
      maxHostCacheSize: config.maxHostCacheSize as number | undefined,
      maxGpuCacheSize: config.maxGpuCacheSize as number | undefined,
      reason: "mobile-performance",
    };
  }

  // 浏览器省流量：比 performance 更保守，不抬高缓存预算
  if (saveDataEnabled) {
    return {
      renderQuality,
      maxConcurrentDownloads: LCC_RENDER_QUALITY_SAVE_DATA.maxConcurrentDownloads,
      workerPerFrameRequests: LCC_RENDER_QUALITY_SAVE_DATA.workerPerFrameRequests,
      maxHostCacheSize: undefined as number | undefined,
      maxGpuCacheSize: undefined as number | undefined,
      reason: "save-data-conservative",
    };
  }

  const config = LCC_RENDER_QUALITY_CONFIG[renderQuality];
  return {
    renderQuality,
    maxConcurrentDownloads: config.maxConcurrentDownloads,
    workerPerFrameRequests: config.workerPerFrameRequests,
    maxHostCacheSize: config.maxHostCacheSize as number | undefined,
    maxGpuCacheSize: config.maxGpuCacheSize as number | undefined,
    reason: `desktop-${renderQuality}`,
  };
}
