"use client";

/**
 * 组件名称：ModelLoadingOverlay
 * 组件用途：统一品牌模型 Loading（大 Logo 静态居中 + 稳定进度条 + 百分比）
 * 主要功能：各场景共用同一视觉框架；仅负责视觉展示，不控制 Loading 显隐时机
 */

import Image from "next/image";
import { useEffect, useState } from "react";

type ModelLoadingStatus = "loading" | "error" | "info";

interface ModelLoadingOverlayProps {
  status?: ModelLoadingStatus;
  progress?: number;
  title?: string;
  description?: string;
  showText?: boolean;
  visible?: boolean;
}

/** 将进度规范到 0–100，供进度条与百分比共用 */
function toSafeProgressPercent(progress?: number, fallbackProgress = 0, hasRealProgress = false): number {
  const normalized = hasRealProgress ? clampProgress(progress) : fallbackProgress;
  const percent = Math.round(normalized * 100);
  return Math.max(0, Math.min(100, percent));
}

function clampProgress(progress?: number) {
  if (!Number.isFinite(progress)) return 0;
  if ((progress ?? 0) < 0) return 0;
  if ((progress ?? 0) > 1) return 1;
  return progress ?? 0;
}

export function ModelLoadingOverlay({
  status = "loading",
  progress,
  title,
  description,
  showText = true,
  visible = true,
}: ModelLoadingOverlayProps) {
  const [fallbackProgress, setFallbackProgress] = useState(0);
  const hasRealProgress = Number.isFinite(progress);
  /** 进度条与百分比共用同一进度值（0–100） */
  const safeProgress = toSafeProgressPercent(progress, fallbackProgress, hasRealProgress);
  const progressPercent = safeProgress;

  useEffect(() => {
    if (hasRealProgress) {
      setFallbackProgress(0);
      return;
    }

    if (!visible || status !== "loading") {
      setFallbackProgress(0);
      return;
    }

    const timer = window.setInterval(() => {
      setFallbackProgress((value) => {
        const nextValue = value + (value < 0.6 ? 0.08 : value < 0.84 ? 0.04 : 0.015);
        return Math.min(nextValue, 0.92);
      });
    }, 240);

    return () => window.clearInterval(timer);
  }, [hasRealProgress, status, visible]);

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black px-5 py-8 transition-opacity duration-300 sm:px-8 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* 统一居中框架：大 Logo 静态居中，进度条和百分比保持独立稳定。 */}
      <div className="flex w-full max-w-[min(80vw,360px)] flex-col items-center sm:max-w-[480px] lg:max-w-[520px]">
        <div className="mb-7 flex w-full max-w-[min(76vw,340px)] items-center justify-center overflow-visible sm:mb-8 sm:max-w-[430px] lg:max-w-[480px]">
          <Image
            src="/brand/model-loading-logo.png"
            alt="数境空间 DIGIREALM SPACE"
            width={1536}
            height={1024}
            sizes="(max-width: 640px) 340px, (max-width: 1024px) 430px, 480px"
            className="h-auto w-full object-contain [image-rendering:pixelated]"
            priority
          />
        </div>

        <div className="w-full" aria-label={`模型加载进度 ${progressPercent}%`}>
          <div
            className="h-[28px] w-full overflow-hidden rounded-[8px] border-[3px] border-white bg-black p-[3px] shadow-[0_0_24px_rgba(255,255,255,0.08)]"
            style={{ "--loading-progress": `${safeProgress}%` } as React.CSSProperties}
          >
            <div className="h-full overflow-hidden rounded-[4px] bg-black">
              <div
                className="h-full bg-white transition-[width] duration-300 ease-linear"
                style={{ width: "var(--loading-progress)" }}
              />
            </div>
          </div>

          <div className="mt-4 flex w-full justify-center">
            <span className="font-mono text-[13px] font-semibold leading-none tracking-normal text-white/85 tabular-nums sm:text-[14px]">
              {progressPercent}%
            </span>
          </div>
        </div>

        {showText && (title || description) && (
          <div className="flex flex-col items-center gap-1 text-center">
            {title && (
              <p className="text-[18px] font-medium tracking-[0.18em] text-white">{title}</p>
            )}
            {description && (
              <p className="text-[12px] tracking-[0.22em] text-white/58">{description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
