"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MoveHorizontal, SquareDashed, X } from "lucide-react";
import type { ModelViewerMeasureAxis, ModelViewerPoint } from "@/components/models/viewers/types";

export type ModelMeasureConstraintMode = "free" | "horizontal" | "vertical";
export type ModelMeasureAxisId = ModelViewerMeasureAxis["id"];

export type ModelMeasurePoint = {
  /** SDK raycast 原始命中点，保留用于后续捕捉校验。 */
  rawHitPoint: ModelViewerPoint;
  /** 最终锁定到模型/渲染世界的点，当前自由测量使用它计算距离。 */
  lockedWorldPoint: ModelViewerPoint;
  /** 水平/垂直矫正后的辅助投影点，当前第一步暂为空。 */
  projectedPoint: ModelViewerPoint | null;
  /** 每帧由 lockedWorldPoint/projectedPoint 重投影得到的屏幕点。 */
  screenPoint: {
    x: number;
    y: number;
    visible?: boolean;
  };
  /** 当前点如果来自辅助线吸附，记录命中的辅助轴，用于高亮识别到的参考线。 */
  snapAxisId?: ModelMeasureAxisId | null;
};

export type ModelMeasureAxisLine = {
  id: ModelMeasureAxisId;
  direction: ModelViewerMeasureAxis["direction"];
  start: {
    x: number;
    y: number;
    visible?: boolean;
  };
  end: {
    x: number;
    y: number;
    visible?: boolean;
  };
};

interface ModelMeasureOverlayProps {
  active: boolean;
  picking: boolean;
  points: ModelMeasurePoint[];
  previewPoint: ModelMeasurePoint | null;
  axisLines: ModelMeasureAxisLine[];
  onPreview: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onClear: () => void;
  onFinish: () => void;
  onUndo: () => void;
  onExit: () => void;
}

const MEASURE_LOUPE_SIZE = 172;
const MEASURE_LOUPE_ZOOM = 5;
const MEASURE_LOUPE_SOURCE_SIZE = MEASURE_LOUPE_SIZE / MEASURE_LOUPE_ZOOM;

function resolveViewerCanvas(root: HTMLDivElement | null, loupeCanvas: HTMLCanvasElement | null) {
  if (!root?.parentElement) return null;

  const canvases = Array.from(root.parentElement.querySelectorAll("canvas")).filter(
    (canvas) => canvas !== loupeCanvas && canvas.width > 0 && canvas.height > 0,
  );

  return canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}

function formatMeasureValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const decimals = value >= 10 ? 2 : value >= 1 ? 2 : 3;
  return `${value.toFixed(decimals)} m`;
}

function getMeasureWorldPoint(point: ModelMeasurePoint) {
  return point.projectedPoint ?? point.lockedWorldPoint;
}

function calculateDistance(origin: ModelViewerPoint, target: ModelViewerPoint) {
  return Math.sqrt(
    (target.x - origin.x) ** 2 +
      (target.y - origin.y) ** 2 +
      (target.z - origin.z) ** 2,
  );
}

function isMeasureScreenPointVisible(point: ModelMeasurePoint["screenPoint"] | null | undefined) {
  return Boolean(point && point.visible !== false);
}

function calculateMeasureSegments(points: ModelMeasurePoint[]) {
  if (points.length < 2) {
    return [];
  }

  const segments = [];
  for (let startIndex = 0; startIndex + 1 < points.length; startIndex += 2) {
    const endIndex = startIndex + 1;
    const segmentIndex = startIndex / 2;
    const startPoint = points[startIndex];
    const endPoint = points[endIndex];
    const startWorld = getMeasureWorldPoint(startPoint);
    const endWorld = getMeasureWorldPoint(endPoint);
    const startScreen = startPoint.screenPoint;
    const endScreen = endPoint.screenPoint;
    const visible = isMeasureScreenPointVisible(startScreen) && isMeasureScreenPointVisible(endScreen);

    segments.push({
      id: `${segmentIndex}-${startWorld.x}-${startWorld.y}-${startWorld.z}-${endWorld.x}-${endWorld.y}-${endWorld.z}`,
      index: segmentIndex,
      startPoint,
      endPoint,
      distance: calculateDistance(startWorld, endWorld),
      visible,
      labelScreenPoint: visible
        ? {
            x: (startScreen.x + endScreen.x) / 2,
            y: (startScreen.y + endScreen.y) / 2,
          }
        : null,
    });
  }

  return segments;
}

function shouldIgnoreTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button,a,input,textarea,select,[data-measure-panel='true']"))
  );
}

export function ModelMeasureOverlay({
  active,
  picking,
  points,
  previewPoint,
  axisLines,
  onPreview,
  onPick,
  onClear,
  onFinish,
  onUndo,
  onExit,
}: ModelMeasureOverlayProps) {
  const isSelectingSegmentEnd = points.length % 2 === 1;
  const displayPoints = previewPoint ? [...points, previewPoint] : points;
  const confirmedSegments = calculateMeasureSegments(points);
  const displaySegments = calculateMeasureSegments(displayPoints);
  const shouldRenderAxisLines =
    picking && isSelectingSegmentEnd && isMeasureScreenPointVisible(points[points.length - 1]?.screenPoint);
  const activeAxisId = shouldRenderAxisLines ? previewPoint?.snapAxisId : null;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loupeFrameReady, setLoupeFrameReady] = useState(false);
  const [loupeScreen, setLoupeScreen] = useState<{ x: number; y: number } | null>(null);
  const loupePoint = loupeScreen;

  useEffect(() => {
    if (!active || !picking || !loupePoint) {
      setLoupeFrameReady(false);
      return;
    }

    const loupeCanvas = loupeCanvasRef.current;
    const viewerCanvas = resolveViewerCanvas(rootRef.current, loupeCanvas);
    if (!loupeCanvas || !viewerCanvas) {
      setLoupeFrameReady(false);
      return;
    }

    const context = loupeCanvas.getContext("2d");
    if (!context) {
      setLoupeFrameReady(false);
      return;
    }

    const viewerRect = viewerCanvas.getBoundingClientRect();
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!rootRect || viewerRect.width <= 0 || viewerRect.height <= 0) {
      setLoupeFrameReady(false);
      return;
    }

    const sourceCenterX =
      ((rootRect.left + loupePoint.x - viewerRect.left) / viewerRect.width) * viewerCanvas.width;
    const sourceCenterY =
      ((rootRect.top + loupePoint.y - viewerRect.top) / viewerRect.height) * viewerCanvas.height;
    const sourceSizeX = (MEASURE_LOUPE_SOURCE_SIZE / viewerRect.width) * viewerCanvas.width;
    const sourceSizeY = (MEASURE_LOUPE_SOURCE_SIZE / viewerRect.height) * viewerCanvas.height;
    const sourceX = Math.max(0, Math.min(viewerCanvas.width - sourceSizeX, sourceCenterX - sourceSizeX / 2));
    const sourceY = Math.max(0, Math.min(viewerCanvas.height - sourceSizeY, sourceCenterY - sourceSizeY / 2));

    try {
      context.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        viewerCanvas,
        sourceX,
        sourceY,
        sourceSizeX,
        sourceSizeY,
        0,
        0,
        loupeCanvas.width,
        loupeCanvas.height,
      );
      setLoupeFrameReady(true);
    } catch {
      setLoupeFrameReady(false);
    }
  }, [active, picking, loupePoint]);

  if (!active) {
    return null;
  }

  const handlePreviewCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (shouldIgnoreTarget(event.target)) {
      setLoupeScreen(null);
      return;
    }
    setLoupeScreen({
      x: event.clientX - event.currentTarget.getBoundingClientRect().left,
      y: event.clientY - event.currentTarget.getBoundingClientRect().top,
    });
    onPreview(event);
  };

  const handlePickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (shouldIgnoreTarget(event.target)) {
      return;
    }

    if (event.detail >= 2) {
      event.preventDefault();
      event.stopPropagation();
      onFinish();
      return;
    }

    onPick(event);
  };

  const handleDoubleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (shouldIgnoreTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onFinish();
  };

  const handleContextMenuCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (shouldIgnoreTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onUndo();
  };

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-10 ${picking ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
      onPointerMoveCapture={picking ? handlePreviewCapture : undefined}
      onClickCapture={picking ? handlePickCapture : undefined}
      onDoubleClickCapture={picking ? handleDoubleClickCapture : undefined}
      onContextMenuCapture={picking ? handleContextMenuCapture : undefined}
      onPointerLeave={() => setLoupeScreen(null)}
      aria-label="测量取点区域"
    >
      {picking && loupePoint ? (
        <div
          className={`pointer-events-none absolute z-30 overflow-hidden rounded-full border border-cyan-200/80 bg-black/35 shadow-[0_0_36px_rgba(34,211,238,0.45)] ring-4 ring-cyan-300/15 transition-opacity ${
            loupeFrameReady ? "opacity-100" : "opacity-0"
          }`}
          style={{
            width: MEASURE_LOUPE_SIZE,
            height: MEASURE_LOUPE_SIZE,
            left: loupePoint.x,
            top: loupePoint.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <canvas
            ref={loupeCanvasRef}
            width={MEASURE_LOUPE_SIZE}
            height={MEASURE_LOUPE_SIZE}
            className="h-full w-full"
          />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-200/45" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-cyan-200/45" />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-cyan-400/80 shadow-[0_0_16px_rgba(34,211,238,0.9)]" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            5x
          </div>
        </div>
      ) : null}

      {points.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          {shouldRenderAxisLines && axisLines.length > 0 ? (
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              {axisLines.filter((line) => line.start.visible !== false && line.end.visible !== false).map((line) => {
                const isActive = line.id === activeAxisId;
                return (
                  <line
                    key={line.id}
                    x1={line.start.x}
                    y1={line.start.y}
                    x2={line.end.x}
                    y2={line.end.y}
                    stroke={isActive ? "rgb(244 63 94)" : "rgb(74 222 128)"}
                    strokeWidth={isActive ? "2.25" : "1.5"}
                    strokeLinecap="round"
                    strokeDasharray={isActive ? "8 5" : "4 7"}
                    opacity={isActive ? "0.95" : "0.68"}
                  />
                );
              })}
              <circle
                cx={points[points.length - 1].screenPoint.x}
                cy={points[points.length - 1].screenPoint.y}
                r="5"
                fill="none"
                stroke="rgb(74 222 128)"
                strokeWidth="1"
                opacity="0.8"
              />
            </svg>
          ) : null}

          {displaySegments.length > 0 ? (
            <svg className="absolute inset-0 h-full w-full overflow-visible">
              {displaySegments.map((segment) =>
                segment.visible ? (
                  <line
                    key={segment.id}
                    x1={segment.startPoint.screenPoint.x}
                    y1={segment.startPoint.screenPoint.y}
                    x2={segment.endPoint.screenPoint.x}
                    y2={segment.endPoint.screenPoint.y}
                    stroke="rgb(245 245 245)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeDasharray={segment.index >= confirmedSegments.length ? "3 6" : "5 3"}
                    opacity={segment.index >= confirmedSegments.length ? "0.68" : "0.92"}
                  />
                ) : null,
              )}
            </svg>
          ) : null}

          {displaySegments.map((segment) =>
            segment.visible && segment.labelScreenPoint ? (
              <div
                key={`${segment.id}-label`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/90 px-2.5 py-1 font-mono text-[11px] font-semibold leading-none text-white shadow-[0_10px_22px_rgba(0,0,0,0.42)]"
                style={{
                  left: segment.labelScreenPoint.x,
                  top: segment.labelScreenPoint.y,
                }}
              >
                {formatMeasureValue(segment.distance)}
              </div>
            ) : null,
          )}

          {points.map((point, index) =>
            isMeasureScreenPointVisible(point.screenPoint) ? (
              <div
                key={`${index}-${point.lockedWorldPoint.x}-${point.lockedWorldPoint.y}-${point.lockedWorldPoint.z}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: point.screenPoint.x, top: point.screenPoint.y }}
              >
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.75)]" />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-cyan-300/20 bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-cyan-100 backdrop-blur-md">
                  点{index + 1}
                </div>
              </div>
            ) : null,
          )}

          {previewPoint && isMeasureScreenPointVisible(previewPoint.screenPoint) ? (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: previewPoint.screenPoint.x,
                top: previewPoint.screenPoint.y,
              }}
            >
              <div className="h-4 w-4 rounded-full border border-cyan-200 bg-cyan-300/45 shadow-[0_0_22px_rgba(34,211,238,0.8)] ring-4 ring-cyan-300/20" />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-cyan-300/20 bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-cyan-100 backdrop-blur-md">
                捕捉点
              </div>
            </div>
          ) : null}
        </div>
      ) : previewPoint && isMeasureScreenPointVisible(previewPoint.screenPoint) ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: previewPoint.screenPoint.x, top: previewPoint.screenPoint.y }}
          >
            <div className="h-4 w-4 rounded-full border border-cyan-200 bg-cyan-300/45 shadow-[0_0_22px_rgba(34,211,238,0.8)] ring-4 ring-cyan-300/20" />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-cyan-300/20 bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-cyan-100 backdrop-blur-md">
              捕捉点
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-auto absolute left-4 top-20 z-40 w-[300px] overflow-hidden rounded-2xl border border-white/15 bg-black/35 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl ring-1 ring-cyan-400/10"
        data-measure-panel="true"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerEnter={() => setLoupeScreen(null)}
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

          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-5 text-white/50">
            左键取点，双击或 Enter 完成，右键撤回，Esc 退出测量工具。
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={onClear}
              disabled={points.length === 0 && !previewPoint}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              清除
            </button>
            <button
              type="button"
              onClick={onFinish}
              disabled={!picking}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              完成
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
