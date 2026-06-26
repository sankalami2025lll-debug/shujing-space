"use client";

/**
 * 组件名称：ModelLoadingOverlay
 * 组件用途：统一品牌模型 Loading（Logo 静态居中 + 进度条轨道 + 像素游标 + 百分比）
 * 主要功能：各场景共用同一视觉框架；进度条与小型像素游标共用轨道坐标系
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

const PIXEL_GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "%": ["1001", "0001", "0010", "0100", "1001"],
};

const RUNNER_FRAME_MS = 140;

/** 将进度规范到 0–100，供进度条与像素游标共用 */
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

/** 小型像素游标（跟随进度条，非大 Logo） */
function PixelRunner({ frame }: { frame: string[] }) {
  return (
    <div
      aria-hidden="true"
      className="grid h-5 w-5 grid-cols-8 gap-px [image-rendering:pixelated]"
    >
      {frame.flatMap((row, rowIndex) =>
        row.split("").map((pixel, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={pixel === "1" ? "h-[2px] w-[2px] bg-white" : "h-[2px] w-[2px] bg-transparent"}
          />
        )),
      )}
    </div>
  );
}

function PixelPercent({ value }: { value: string }) {
  return (
    <div aria-hidden="true" className="flex items-start gap-1 [image-rendering:pixelated]">
      {value.split("").map((char, charIndex) => {
        const glyph = PIXEL_GLYPHS[char];
        if (!glyph) return null;

        return (
          <div
            key={`${char}-${charIndex}`}
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${glyph[0]?.length ?? 0}, minmax(0, 1fr))` }}
          >
            {glyph.flatMap((row, rowIndex) =>
              row.split("").map((pixel, columnIndex) => (
                <span
                  key={`${charIndex}-${rowIndex}-${columnIndex}`}
                  className={
                    pixel === "1" ? "h-[3px] w-[3px] bg-white" : "h-[3px] w-[3px] bg-transparent"
                  }
                />
              )),
            )}
          </div>
        );
      })}
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
  /** 进度条与像素游标共用同一进度值（0–100） */
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
      className={`absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black px-4 py-8 transition-opacity duration-300 sm:px-6 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* 统一居中框架：Logo 静态 / 进度条轨道 / 游标 / 百分比 */}
      <div className="flex w-full max-w-[min(72vw,320px)] flex-col items-center gap-5 sm:max-w-[360px] lg:max-w-[420px]">
        <div className="flex w-full max-w-[min(56vw,200px)] items-center justify-center sm:max-w-[240px] lg:max-w-[280px]">
          <Image
            src="/brand/model-loading-logo.png"
            alt="数境空间 DIGIREALM SPACE"
            width={1536}
            height={1024}
            sizes="(max-width: 640px) 200px, 280px"
            className="h-auto w-full object-contain [image-rendering:pixelated]"
            priority
          />
        </div>

        <div className="w-full">
          <div
            className="relative h-[18px] w-full overflow-visible"
            style={{ "--loading-progress": `${safeProgress}%` } as React.CSSProperties}
          >
            <div className="absolute inset-0 overflow-hidden rounded-[6px] border-[3px] border-white bg-black p-[2px]">
              <div className="relative h-full overflow-hidden rounded-[3px] bg-black">
                <div
                  className="h-full bg-white transition-[width] duration-300 ease-linear"
                  style={{ width: "var(--loading-progress)" }}
                />
              </div>
            </div>

            <div
              className="pointer-events-none absolute left-[var(--loading-progress)] top-[calc(100%+8px)] z-[1] -translate-x-1/2 transition-[left] duration-300 ease-linear"
              aria-hidden="true"
            >
              <PixelRunner frame={RUNNER_FRAMES[runnerFrameIndex] ?? RUNNER_FRAMES[0]} />
            </div>
          </div>

          <div className="mt-7 flex w-full justify-center">
            <PixelPercent value={`${progressPercent}%`} />
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
