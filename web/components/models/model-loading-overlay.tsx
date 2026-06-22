"use client";

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

/** 将进度规范到 0–100，供进度条与像素小人共用 */
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

function PixelRunner({ frame }: { frame: string[] }) {
  return (
    <div
      aria-hidden="true"
      className="grid h-7 w-7 grid-cols-8 gap-0.5 [image-rendering:pixelated]"
    >
      {frame.flatMap((row, rowIndex) =>
        row.split("").map((pixel, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={pixel === "1" ? "h-[3px] w-[3px] bg-white" : "h-[3px] w-[3px] bg-transparent"}
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
  /** 进度条与像素小人共用同一进度值（0–100） */
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

    // 纯视觉 fallback：无真实进度时缓慢推进进度条，保证各种场景下 Loading 有动效。
    // 此 fallback 仅用于进度数字显示，永不驱动 overlay 隐藏（隐藏由父组件 visible prop 控制）。
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

    // 仅驱动腿部帧切换；横向位置由 safeProgress 控制，不做独立位移动画
    const timer = window.setInterval(() => {
      setRunnerFrameIndex((value) => (value + 1) % RUNNER_FRAMES.length);
    }, RUNNER_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [status, visible]);

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black px-6 py-10 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="relative flex w-[720px] max-w-[80vw] flex-col items-center justify-center">
        <div className="mb-[-8px] flex w-[420px] max-w-[58vw] items-center justify-center overflow-visible">
          <Image
            src="/brand/model-loading-logo.png"
            alt="数境空间 DIGIREALM SPACE"
            width={1536}
            height={1024}
            sizes="(max-width: 640px) 320px, 420px"
            className="h-auto w-full translate-y-[10px] scale-[1.45] object-contain [image-rendering:pixelated]"
            priority
          />
        </div>

        <div className="relative flex w-full items-start justify-center gap-[10px]">
          <div
            className="relative w-[520px] max-w-[70vw] pb-8"
            style={{ "--loading-progress": `${safeProgress}%` } as React.CSSProperties}
          >
            <div className="relative overflow-hidden rounded-[8px] border-[3px] border-white bg-black p-[3px]">
              <div className="relative h-[18px] overflow-hidden rounded-[4px] bg-black">
                <div
                  className="h-full bg-white transition-[width] duration-300 ease-linear"
                  style={{ width: "var(--loading-progress)" }}
                />
              </div>
            </div>

            {/* 像素小人横向位置与进度条共用 --loading-progress；仅保留腿部帧动画 */}
            <div className="pointer-events-none absolute left-0 top-[32px] z-[1] h-7 w-full overflow-visible">
              <div
                className="absolute top-0 transition-[left] duration-300 ease-linear"
                style={{
                  left: "var(--loading-progress)",
                  transform: "translateX(-50%)",
                }}
              >
                <PixelRunner frame={RUNNER_FRAMES[runnerFrameIndex] ?? RUNNER_FRAMES[0]} />
              </div>
            </div>
          </div>

          <div className="pointer-events-none flex h-[30px] w-[40px] shrink-0 items-center justify-center">
            <PixelPercent value={`${progressPercent}%`} />
          </div>
        </div>

        {showText && (title || description) && (
          <div className="mt-4 flex flex-col items-center gap-1 text-center">
            {title && (
              <p className="text-[18px] font-medium tracking-[0.18em] text-white">
                {title}
              </p>
            )}
            {description && (
              <p className="text-[12px] tracking-[0.22em] text-white/58">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

