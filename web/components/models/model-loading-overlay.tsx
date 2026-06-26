"use client";

/**
 * 组件名称：ModelLoadingOverlay
 * 组件用途：统一品牌模型 Loading（Logo + 进度条 + 百分比 + 进度同步像素小人）
 * 主要功能：各场景共用同一视觉框架；仅负责视觉展示，不控制 Loading 显隐时机
 */

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";

type ModelLoadingStatus = "loading" | "error" | "info";

interface ModelLoadingOverlayProps {
  status?: ModelLoadingStatus;
  progress?: number;
  title?: string;
  description?: string;
  showText?: boolean;
  visible?: boolean;
}

const RUNNER_FRAMES = [
  [
    "00110000",
    "01111000",
    "00110000",
    "01111000",
    "11110000",
    "00111000",
    "01101100",
    "11000110",
  ],
  [
    "00110000",
    "01111000",
    "00110000",
    "00111000",
    "01111000",
    "00110000",
    "01111000",
    "11001100",
  ],
  [
    "00110000",
    "01111000",
    "00110000",
    "01111000",
    "00111100",
    "00111000",
    "01101100",
    "01100011",
  ],
  [
    "00110000",
    "01111000",
    "00110000",
    "00111100",
    "01111000",
    "00110000",
    "01111000",
    "00110011",
  ],
];

const RUNNER_FRAME_MS = 140;

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

function clampRunnerProgress(progressPercent: number): number {
  return Math.max(2, Math.min(98, progressPercent));
}

/** 像素小人：横向位置跟随 progress，腿部只做帧切换。 */
function PixelRunner({ frame }: { frame: string[] }) {
  return (
    <div
      aria-hidden="true"
      className="grid h-6 w-6 grid-cols-8 gap-px [image-rendering:pixelated]"
    >
      {frame.flatMap((row, rowIndex) =>
        row.split("").map((pixel, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={
              pixel === "1" ? "h-[2px] w-[2px] bg-white" : "h-[2px] w-[2px] bg-transparent"
            }
          />
        )),
      )}
    </div>
  );
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
  const [runnerFrameIndex, setRunnerFrameIndex] = useState(0);
  const hasRealProgress = Number.isFinite(progress);
  /** 进度条与百分比共用同一进度值（0–100） */
  const safeProgress = toSafeProgressPercent(progress, fallbackProgress, hasRealProgress);
  const progressPercent = safeProgress;
  const runnerProgress = clampRunnerProgress(progressPercent);

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

  useEffect(() => {
    if (!visible || status !== "loading") {
      setRunnerFrameIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setRunnerFrameIndex((value) => (value + 1) % RUNNER_FRAMES.length);
    }, RUNNER_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [status, visible]);

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black px-5 py-8 transition-opacity duration-300 sm:px-8 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* 统一居中框架：Logo、进度条、百分比、小人组成紧凑品牌 Loading。 */}
      <div className="flex w-full max-w-[min(96vw,640px)] flex-col items-center">
        <div className="mb-2.5 flex w-full max-w-[min(78vw,320px)] items-center justify-center overflow-visible sm:max-w-[480px] lg:max-w-[560px]">
          <Image
            src="/brand/model-loading-logo.png"
            alt="数境空间 DIGIREALM SPACE"
            width={1536}
            height={1024}
            sizes="(max-width: 640px) 320px, (max-width: 1024px) 480px, 560px"
            className="h-auto w-full object-contain [image-rendering:pixelated]"
            priority
          />
        </div>

        <div className="flex w-full flex-col items-center" aria-label={`模型加载进度 ${progressPercent}%`}>
          <div className="grid w-[min(90vw,560px)] max-w-full grid-cols-[minmax(0,1fr)_3.5ch] items-start gap-2.5 sm:w-[540px] sm:gap-3 lg:w-[560px]">
            <div
              className="relative h-[18px] w-full overflow-visible"
              style={
                {
                  "--loading-progress": `${safeProgress}%`,
                  "--runner-progress": `${runnerProgress}%`,
                } as CSSProperties
              }
            >
              <div className="absolute inset-0 overflow-hidden rounded-[6px] border-2 border-white bg-black p-[2px] shadow-[0_0_18px_rgba(255,255,255,0.08)]">
                <div className="h-full overflow-hidden rounded-[3px] bg-black">
                  <div
                    className="h-full bg-white transition-[width] duration-300 ease-linear"
                    style={{ width: "var(--loading-progress)" }}
                  />
                </div>
              </div>

              <div
                className="pointer-events-none absolute left-[var(--runner-progress)] top-full z-[1] mt-2 -translate-x-1/2 transition-[left] duration-300 ease-linear"
                aria-hidden="true"
              >
                <PixelRunner frame={RUNNER_FRAMES[runnerFrameIndex] ?? RUNNER_FRAMES[0]} />
              </div>
            </div>

            <span className="flex h-[18px] min-w-[3.5ch] items-center justify-end font-mono text-[13px] font-semibold leading-none tracking-normal text-white/88 tabular-nums sm:text-[14px]">
              {progressPercent}%
            </span>
          </div>
        </div>

        {showText && (title || description) && (
          <div className="mt-4 flex flex-col items-center gap-1 text-center">
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
