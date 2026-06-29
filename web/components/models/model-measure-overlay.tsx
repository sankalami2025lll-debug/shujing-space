"use client";

import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MoveHorizontal, SquareDashed, X } from "lucide-react";
import type { ModelViewerPoint } from "@/components/models/viewers/types";

export type ModelMeasurePoint = {
  world: ModelViewerPoint;
  screen: {
    x: number;
    y: number;
  };
};

interface ModelMeasureOverlayProps {
  active: boolean;
  points: ModelMeasurePoint[];
  distance: number | null;
  onPick: (event: ReactMouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>) => void;
  onClear: () => void;
  onExit: () => void;
}

function formatMeasureValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const decimals = value >= 10 ? 2 : value >= 1 ? 2 : 3;
  return `${value.toFixed(decimals)} m`;
}

function formatPoint(point: ModelViewerPoint) {
  return `${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}`;
}

function calculateOffset(points: ModelMeasurePoint[]) {
  if (points.length < 2) {
    return { dx: null, dy: null, dz: null };
  }

  const [a, b] = points;
  return {
    dx: Math.abs(b.world.x - a.world.x),
    dy: Math.abs(b.world.y - a.world.y),
    dz: Math.abs(b.world.z - a.world.z),
  };
}

export function ModelMeasureOverlay({
  active,
  points,
  distance,
  onPick,
  onClear,
  onExit,
}: ModelMeasureOverlayProps) {
  const lastPointerPickAtRef = useRef(0);

  if (!active) {
    return null;
  }

  const { dx, dy, dz } = calculateOffset(points);
  const instruction =
    points.length === 0
      ? "请选择第一个点"
      : points.length === 1
        ? "请选择第二个点"
        : "测量完成";
  const hasResult = points.length >= 2 && distance !== null;
  const handlePickCapture = (event: ReactMouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.closest("[data-measure-panel='true']")) {
      return;
    }
    onPick(event);
  };

  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    lastPointerPickAtRef.current = Date.now();
    handlePickCapture(event);
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastPointerPickAtRef.current < 350) {
      return;
    }
    handlePickCapture(event);
  };

  return (
      <div
        className="pointer-events-auto absolute inset-0 z-10 cursor-crosshair"
        onPointerDownCapture={handlePointerDownCapture}
        onClickCapture={handleClickCapture}
        aria-label="测量取点区域"
      >
      {points.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          {points.length >= 2 ? (
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              <line
                x1={points[0].screen.x}
                y1={points[0].screen.y}
                x2={points[1].screen.x}
                y2={points[1].screen.y}
                stroke="rgb(34 211 238)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="5 4"
                opacity="0.95"
              />
            </svg>
          ) : null}

          {points.map((point, index) => (
            <div
              key={`${index}-${point.world.x}-${point.world.y}-${point.world.z}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: point.screen.x, top: point.screen.y }}
            >
              <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.75)]" />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-cyan-300/20 bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-cyan-100 backdrop-blur-md">
                点{index + 1}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="pointer-events-auto absolute left-4 top-20 z-40 w-[300px] overflow-hidden rounded-2xl border border-white/15 bg-black/35 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl ring-1 ring-cyan-400/10"
        data-measure-panel="true"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400">
              <MoveHorizontal className="h-3.5 w-3.5" />
            </div>
            <span className="text-[13px] font-medium text-white">距离测量结果</span>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-white/10 hover:text-white"
            aria-label="关闭测量"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/35 p-1">
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 px-2 py-1.5 text-[12px] text-cyan-300"
            >
              <MoveHorizontal className="h-3.5 w-3.5" />
              距离测量
            </button>
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-white/35"
              title="即将开放"
            >
              <SquareDashed className="h-3.5 w-3.5" />
              面积测量
            </button>
          </div>

          <div>
            <div className="flex items-end gap-2">
              <span className="font-mono text-[32px] font-semibold leading-none tracking-tight text-cyan-400">
                {formatMeasureValue(distance)}
              </span>
              <span className="mb-1 text-[12px] text-gray-400">总直线距离</span>
            </div>
            <p className="mt-2 text-[12px] text-white/55">{instruction}</p>
          </div>

          <div className="rounded-xl border border-white/5 bg-black/50 p-2.5">
            <span className="mb-2 block text-[10px] uppercase tracking-wider text-gray-500">
              X-Y-Z 偏移量
            </span>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-600">ΔX</span>
                <span className="font-mono text-[12px] text-gray-300">{formatMeasureValue(dx)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-600">ΔY</span>
                <span className="font-mono text-[12px] text-gray-300">{formatMeasureValue(dy)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-600">ΔZ</span>
                <span className="font-mono text-[12px] text-gray-300">{formatMeasureValue(dz)}</span>
              </div>
            </div>
          </div>

          {points.length > 0 ? (
            <div className="space-y-1 text-[11px] text-white/45">
              {points.map((point, index) => (
                <p key={`${index}-${point.world.x}-${point.world.y}-${point.world.z}`}>
                  点 {index + 1}: {formatPoint(point.world)}
                </p>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={onClear}
              disabled={!hasResult && points.length === 0}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              清除
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1.5 text-[12px] text-cyan-100 transition-colors hover:bg-cyan-500/25"
            >
              退出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
