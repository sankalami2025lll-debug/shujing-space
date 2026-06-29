"use client";

import { SplitSquareHorizontal, X } from "lucide-react";
import { useCallback, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

interface ModelSectionPanelProps {
  horizontalPercent: number;
  verticalPercent: number;
  onHorizontalPercentChange: (percent: number) => void;
  onVerticalPercentChange: (percent: number) => void;
  onReset: () => void;
  onClose: () => void;
}

interface SectionSliderProps {
  label: string;
  percent: number;
  ariaLabel: string;
  onPercentChange: (percent: number) => void;
}

const SECTION_CENTER_PERCENT = 50;

function clampPercent(percent: number) {
  if (!Number.isFinite(percent)) return SECTION_CENTER_PERCENT;
  return Math.max(0, Math.min(100, percent));
}

function SectionSlider({ label, percent, ariaLabel, onPercentChange }: SectionSliderProps) {
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const safePercent = clampPercent(percent);
  const clipFillStyle =
    safePercent < SECTION_CENTER_PERCENT
      ? { left: `${safePercent}%`, right: "50%" }
      : { left: "50%", right: `${100 - safePercent}%` };

  const commitPointerPercent = useCallback(
    (clientX: number) => {
      const rect = sliderTrackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) {
        return;
      }

      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onPercentChange(Math.round(ratio * 100));
    },
    [onPercentChange],
  );

  const handleSliderPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    commitPointerPercent(event.clientX);
  };

  const handleSliderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.buttons & 1) !== 1) {
      return;
    }
    commitPointerPercent(event.clientX);
  };

  const handleSliderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPercentChange(Math.max(0, safePercent - 1));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onPercentChange(Math.min(100, safePercent + 1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onPercentChange(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onPercentChange(100);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-gray-400">{label}</span>
        <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-400">
          {Math.round(safePercent)}%
        </span>
      </div>

      <div
        ref={sliderTrackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safePercent)}
        className="relative flex h-8 w-full cursor-ew-resize items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        onPointerDown={handleSliderPointerDown}
        onPointerMove={handleSliderPointerMove}
        onKeyDown={handleSliderKeyDown}
      >
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />
        <div
          className="absolute h-1.5 rounded-full bg-cyan-400 transition-all"
          style={clipFillStyle}
        />
        <div className="absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30" />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/80 bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.45)] transition-[left]"
          style={{ left: `${safePercent}%` }}
        />
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={safePercent}
          onChange={(event) => onPercentChange(Number.parseInt(event.target.value, 10))}
          className="sr-only"
          aria-label={ariaLabel}
        />
      </div>
    </div>
  );
}

export function ModelSectionPanel({
  horizontalPercent,
  verticalPercent,
  onHorizontalPercentChange,
  onVerticalPercentChange,
  onReset,
  onClose,
}: ModelSectionPanelProps) {
  return (
    <div className="absolute bottom-14 left-[260px] z-30 flex min-w-[260px] flex-col rounded-2xl border border-white/10 bg-black/80 p-4 text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400">
            <SplitSquareHorizontal className="h-3.5 w-3.5 rotate-90" />
          </div>
          <p className="min-w-0 text-[13px] font-medium leading-tight text-white">模型剖切</p>
        </div>
        <button
          type="button"
          aria-label="关闭模型剖切面板"
          title="关闭"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <SectionSlider
          label="左右剖切"
          percent={horizontalPercent}
          ariaLabel="左右剖切百分比"
          onPercentChange={onHorizontalPercentChange}
        />
        <SectionSlider
          label="上下剖切"
          percent={verticalPercent}
          ariaLabel="上下剖切百分比"
          onPercentChange={onVerticalPercentChange}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          重置
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] text-cyan-300 transition-colors hover:bg-cyan-500/20"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
