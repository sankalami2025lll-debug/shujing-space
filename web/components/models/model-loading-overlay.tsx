"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type ModelLoadingStatus = "loading" | "error" | "info";

interface ModelLoadingOverlayProps {
  status?: ModelLoadingStatus;
  progress?: number;
  title?: string;
  description?: string;
  visible?: boolean;
  onRetry?: () => void;
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

const RUNNER_SIZE = 26;
const RUNNER_PADDING = 8;
const RUNNER_FRAME_MS = 140;

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
  title: _title,
  description: _description,
  visible = true,
  onRetry: _onRetry,
}: ModelLoadingOverlayProps) {
  const [fallbackProgress, setFallbackProgress] = useState(0);
  const [runnerFrameIndex, setRunnerFrameIndex] = useState(0);
  const progressWrapRef = useRef<HTMLDivElement | null>(null);
  const [progressBarWidth, setProgressBarWidth] = useState(520);
  const hasRealProgress = Number.isFinite(progress);
  const normalizedProgress = clampProgress(progress);
  const effectiveProgress = hasRealProgress ? normalizedProgress : fallbackProgress;
  const progressPercent = Math.round(effectiveProgress * 100);
  const fillPercent = progressPercent === 0 ? 0 : Math.max(progressPercent, 6);
  const runnerOffset = useMemo(() => {
    const minX = RUNNER_PADDING;
    const maxX = Math.max(progressBarWidth - RUNNER_SIZE - RUNNER_PADDING, minX);
    const rawX = progressBarWidth * effectiveProgress - RUNNER_SIZE / 2;
    return Math.min(Math.max(rawX, minX), maxX);
  }, [effectiveProgress, progressBarWidth]);

  useEffect(() => {
    if (hasRealProgress) {
      setFallbackProgress(0);
      return;
    }

    if (!visible || status !== "loading") {
      setFallbackProgress(0);
      return;
    }

    // 无真实进度时使用缓慢推进的假进度，保证 iframe 等统一 Loading 也有动效。
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

  useEffect(() => {
    const element = progressWrapRef.current;
    if (!element) return;

    const updateWidth = () => {
      setProgressBarWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

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
            src="/loading/loading-logo-reference.png"
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
            ref={progressWrapRef}
            className="relative w-[520px] max-w-[70vw] pb-8"
          >
            <div className="relative overflow-hidden rounded-[8px] border-[3px] border-white bg-black p-[3px]">
              <div className="relative h-[18px] overflow-hidden rounded-[4px] bg-black">
                <div
                  className="h-full bg-white transition-[width] duration-300"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>

            <div
              className="pointer-events-none absolute left-0 top-[32px] z-[1] transition-[left] duration-300"
              style={{ left: `${runnerOffset}px` }}
            >
              <PixelRunner frame={RUNNER_FRAMES[runnerFrameIndex] ?? RUNNER_FRAMES[0]} />
            </div>
          </div>

          <div className="pointer-events-none flex h-[30px] w-[40px] shrink-0 items-center justify-center">
            <PixelPercent value={`${progressPercent}%`} />
          </div>
        </div>
      </div>
    </div>
  );
}
