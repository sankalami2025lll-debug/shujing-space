"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";
import {
  ModelMeasureOverlay,
  type ModelMeasureAxisLine,
  type ModelMeasurePoint,
} from "@/components/models/model-measure-overlay";
import { ModelViewerHelp } from "@/components/models/model-viewer-help";
import { ModelViewerToolbar } from "@/components/models/model-viewer-toolbar";
import { BimViewer } from "@/components/models/viewers/bim-viewer";
import { GlbViewer } from "@/components/models/viewers/glb-viewer";
import { IframeViewer } from "@/components/models/viewers/iframe-viewer";
import { LccViewer } from "@/components/models/lcc-viewer";
import { OsgbViewer } from "@/components/models/viewers/osgb-viewer";
import { PlyViewer } from "@/components/models/viewers/ply-viewer";
import { UnsupportedViewer } from "@/components/models/viewers/unsupported-viewer";
import {
  getViewerCapabilities,
  type ModelViewerControlMode,
  type ModelViewerMeasureAxis,
  type ModelViewerMovementInput,
  type ModelViewerHandle,
  type ModelViewerPickResult,
  type ModelViewerPoint,
  type ModelHeightClipOptions,
} from "@/components/models/viewers/types";
import { ApiError, http } from "@/lib/http";
import {
  clampLccRenderQualityForDevice,
  labelToLccRenderQuality,
  lccRenderQualityToLabel,
  persistLccRenderQuality,
  resolveInitialLccRenderQuality,
  type LccRenderQuality,
  type LccRenderQualityLabel,
} from "@/lib/lcc-render-quality";
import { getModelViewerKind } from "@/lib/model-viewer-kind";
import type { ModelDetail, ModelLaunchView } from "@/lib/types";

interface ModelViewerShellProps {
  model: ModelDetail;
  onLaunchViewSaved?: (view: ModelLaunchView) => void;
}

interface SaveLaunchViewResult {
  launchView: ModelLaunchView;
  updatedAt: string;
  updatedBy: number;
}

const EMPTY_MOVEMENT_INPUT: ModelViewerMovementInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

function cloneEmptyMovementInput(): ModelViewerMovementInput {
  return { ...EMPTY_MOVEMENT_INPUT };
}

function calculateMeasureDistance(a: ModelViewerPoint, b: ModelViewerPoint) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

function calculateTotalMeasureDistance(points: ModelMeasurePoint[]) {
  if (points.length < 2) {
    return null;
  }

  let total = 0;
  for (let startIndex = 0; startIndex + 1 < points.length; startIndex += 2) {
    total += calculateMeasureDistance(
      getMeasureWorldPoint(points[startIndex]),
      getMeasureWorldPoint(points[startIndex + 1]),
    );
  }

  return total;
}

function areMeasureScreensClose(a: ModelMeasurePoint["screenPoint"], b: ModelMeasurePoint["screenPoint"]) {
  return (
    Math.abs(a.x - b.x) < 0.05 &&
    Math.abs(a.y - b.y) < 0.05 &&
    (a.visible ?? true) === (b.visible ?? true)
  );
}

function getMeasureWorldPoint(point: ModelMeasurePoint) {
  return point.projectedPoint ?? point.lockedWorldPoint;
}

const MEASURE_AXIS_DIRECTION_SAMPLE_LENGTHS = [0.2, 0.5, 1, 2, 4, 8, 16, 36, 72];
const MEASURE_AXIS_DIRECTION_TARGET_PX = 160;
const MEASURE_AXIS_DIRECTION_MIN_PX = 6;
const MEASURE_AXIS_SCREEN_PADDING_PX = 120;
const MEASURE_AXIS_SNAP_LINE_PX = 18;
const MEASURE_AXIS_SNAP_POINT_PX = 64;
const MEASURE_PREVIEW_PICK_INTERVAL_MS = 120;
const FALLBACK_MEASURE_PLANE_AXES: ModelViewerMeasureAxis[] = [
  { id: "model-x", direction: { x: -1, y: 0, z: 0, coordinateSpace: "render" } },
  { id: "model-y", direction: { x: 0, y: 0, z: 1, coordinateSpace: "render" } },
  { id: "model-z", direction: { x: 0, y: 1, z: 0, coordinateSpace: "render" } },
];

function normalizeMeasureAxisDirection(direction: ModelViewerPoint): ModelViewerPoint | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(length) || length < 1e-6) {
    return null;
  }

  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
    coordinateSpace: direction.coordinateSpace ?? "render",
  };
}

function offsetMeasureWorldPointByDirection(
  point: ModelViewerPoint,
  direction: ModelViewerPoint,
  delta: number,
): ModelViewerPoint {
  return {
    ...point,
    x: point.x + direction.x * delta,
    y: point.y + direction.y * delta,
    z: point.z + direction.z * delta,
    coordinateSpace: point.coordinateSpace ?? "render",
  };
}

function areMeasureAxisLinesClose(a: ModelMeasureAxisLine[], b: ModelMeasureAxisLine[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((line, index) => {
    const nextLine = b[index];
    return (
      line.id === nextLine.id &&
      Math.abs(line.start.x - nextLine.start.x) < 1.5 &&
      Math.abs(line.start.y - nextLine.start.y) < 1.5 &&
      Math.abs(line.end.x - nextLine.end.x) < 1.5 &&
      Math.abs(line.end.y - nextLine.end.y) < 1.5
    );
  });
}

function createExtendedMeasureAxisLine(
  id: ModelMeasureAxisLine["id"],
  direction: ModelMeasureAxisLine["direction"],
  anchorScreen: ModelMeasurePoint["screenPoint"],
  sampleScreen: ModelMeasurePoint["screenPoint"],
  measureArea: HTMLElement,
): ModelMeasureAxisLine | null {
  const dx = sampleScreen.x - anchorScreen.x;
  const dy = sampleScreen.y - anchorScreen.y;
  const length = Math.hypot(dx, dy);
  if (length < MEASURE_AXIS_DIRECTION_MIN_PX) {
    return null;
  }

  const rect = measureArea.getBoundingClientRect();
  const extendLength = Math.hypot(rect.width, rect.height) + MEASURE_AXIS_SCREEN_PADDING_PX;
  const unitX = dx / length;
  const unitY = dy / length;

  return {
    id,
    direction,
    start: {
      x: anchorScreen.x - unitX * extendLength,
      y: anchorScreen.y - unitY * extendLength,
      visible: anchorScreen.visible && sampleScreen.visible,
    },
    end: {
      x: anchorScreen.x + unitX * extendLength,
      y: anchorScreen.y + unitY * extendLength,
      visible: anchorScreen.visible && sampleScreen.visible,
    },
  };
}

function getScreenDistanceToSegment(
  point: ModelMeasurePoint["screenPoint"],
  start: ModelMeasurePoint["screenPoint"],
  end: ModelMeasurePoint["screenPoint"],
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  const closestX = start.x + dx * t;
  const closestY = start.y + dy * t;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function projectMeasureWorldPointToAxis(
  anchor: ModelViewerPoint,
  target: ModelViewerPoint,
  direction: ModelViewerPoint,
): ModelViewerPoint {
  const normalizedDirection = normalizeMeasureAxisDirection(direction);
  if (!normalizedDirection) {
    return { ...target };
  }

  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;
  const dz = target.z - anchor.z;
  const scalar =
    dx * normalizedDirection.x + dy * normalizedDirection.y + dz * normalizedDirection.z;

  return {
    x: anchor.x + normalizedDirection.x * scalar,
    y: anchor.y + normalizedDirection.y * scalar,
    z: anchor.z + normalizedDirection.z * scalar,
    coordinateSpace: anchor.coordinateSpace ?? target.coordinateSpace ?? "render",
  };
}

function projectMeasureScreenPointToAxis(
  anchor: ModelViewerPoint,
  direction: ModelViewerPoint,
  pointerScreen: ModelMeasurePoint["screenPoint"],
  projectScreen: (worldPoint: ModelViewerPoint) => ModelMeasurePoint["screenPoint"] | null,
): {
  projectedPoint: ModelViewerPoint;
  screenPoint: ModelMeasurePoint["screenPoint"];
  screenDistance: number;
} | null {
  const normalizedDirection = normalizeMeasureAxisDirection(direction);
  const anchorScreen = projectScreen(anchor);
  if (!normalizedDirection || !anchorScreen) {
    return null;
  }

  return MEASURE_AXIS_DIRECTION_SAMPLE_LENGTHS.flatMap((length) => [length, -length])
    .map((delta) => {
      const samplePoint = offsetMeasureWorldPointByDirection(anchor, normalizedDirection, delta);
      const sampleScreen = projectScreen(samplePoint);
      if (!sampleScreen) {
        return null;
      }

      const axisX = sampleScreen.x - anchorScreen.x;
      const axisY = sampleScreen.y - anchorScreen.y;
      const axisLengthSq = axisX * axisX + axisY * axisY;
      if (axisLengthSq < MEASURE_AXIS_DIRECTION_MIN_PX * MEASURE_AXIS_DIRECTION_MIN_PX) {
        return null;
      }

      const pointerX = pointerScreen.x - anchorScreen.x;
      const pointerY = pointerScreen.y - anchorScreen.y;
      const screenRatio = (pointerX * axisX + pointerY * axisY) / axisLengthSq;
      const projectedPoint = offsetMeasureWorldPointByDirection(anchor, normalizedDirection, delta * screenRatio);
      const projectedScreen = projectScreen(projectedPoint);
      if (!projectedScreen) {
        return null;
      }

      return {
        projectedPoint,
        screenPoint: projectedScreen,
        screenDistance: Math.hypot(projectedScreen.x - pointerScreen.x, projectedScreen.y - pointerScreen.y),
      };
    })
    .filter((candidate): candidate is {
      projectedPoint: ModelViewerPoint;
      screenPoint: ModelMeasurePoint["screenPoint"];
      screenDistance: number;
    } => Boolean(candidate))
    .sort((a, b) => a.screenDistance - b.screenDistance)[0] ?? null;
}

function isTypingElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function processingStatusText(status: ModelDetail["processingStatus"]) {
  switch (status) {
    case "uploaded":
      return "模型文件已上传，正在等待进入后台解析。";
    case "processing":
      return "模型正在后台解析中，完成后即可在线浏览。";
    case "failed":
      return "模型解析失败，请联系管理员或稍后重新发布。";
    case "ready":
    default:
      return "";
  }
}

export function ModelViewerShell({ model, onLaunchViewSaved }: ModelViewerShellProps) {
  const shellRootRef = useRef<HTMLDivElement | null>(null);
  const viewerFullscreenTargetRef = useRef<HTMLDivElement | null>(null);
  const viewerInteractionAreaRef = useRef<HTMLDivElement | null>(null);
  const viewerHandleRef = useRef<ModelViewerHandle | null>(null);
  const [viewerResetSeed, setViewerResetSeed] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExternalFullscreen, setIsExternalFullscreen] = useState(false);
  const [movementInput, setMovementInput] = useState<ModelViewerMovementInput>(EMPTY_MOVEMENT_INPUT);
  const [moveSpeedMultiplier, setMoveSpeedMultiplier] = useState(1);
  const [saveLaunchViewPending, setSaveLaunchViewPending] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isMeasurePanelOpen, setIsMeasurePanelOpen] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<ModelMeasurePoint[]>([]);
  const [measurePreviewPoint, setMeasurePreviewPoint] = useState<ModelMeasurePoint | null>(null);
  const [measureAxisLines, setMeasureAxisLines] = useState<ModelMeasureAxisLine[]>([]);
  const [, setMeasureDistance] = useState<number | null>(null);
  const measurePointsRef = useRef<ModelMeasurePoint[]>([]);
  const measurePreviewSeqRef = useRef(0);
  const lastMeasurePreviewAtRef = useRef(0);
  const viewerKind = getModelViewerKind(model);
  const [controlMode, setControlMode] = useState<ModelViewerControlMode>(
    viewerKind === "lcc" ? "walk" : "orbit",
  );
  const processingBlocked = model.processingStatus !== "ready";
  const processingHint = processingStatusText(model.processingStatus);
  const viewerCapabilities = useMemo(() => getViewerCapabilities(viewerKind), [viewerKind]);
  const isLccViewer = viewerKind === "lcc";
  const canShowSaveLaunchView =
    !processingBlocked && model.canSaveLaunchView && viewerCapabilities.saveView;
  /** 渲染质量档位（兼容非详情页复用）；切换只保存，不触发 SDK 热 reload */
  const [renderQuality, setRenderQuality] = useState<LccRenderQuality>(() =>
    resolveInitialLccRenderQuality(false),
  );

  const handleRenderQualityChange = useCallback((label: LccRenderQualityLabel) => {
    const next = clampLccRenderQualityForDevice(
      labelToLccRenderQuality(label),
      false,
    );
    setRenderQuality(next);
    persistLccRenderQuality(next);
    if (typeof console !== "undefined") {
      console.info("[LCC Viewer] render quality saved", {
        modelId: model.id,
        renderQuality: next,
        label: lccRenderQualityToLabel(next),
        isMobileViewer: false,
        appliesOn: "next-open",
        context: "embedded-shell",
      });
    }
    toast.success("渲染质量已保存，重新打开模型后生效。");
  }, [model.id]);

  useEffect(() => {
    measurePointsRef.current = measurePoints;
  }, [measurePoints]);

  const clearMovementState = useCallback(() => {
    const emptyInput = cloneEmptyMovementInput();
    setMovementInput(emptyInput);
    setMoveSpeedMultiplier(1);
    viewerHandleRef.current?.setMovementInput?.(emptyInput);
    viewerHandleRef.current?.setMoveSpeedMultiplier?.(1);
  }, []);

  const handleFullscreen = () => {
    const element = viewerFullscreenTargetRef.current;
    if (!element) return;

    if (document.fullscreenElement === element) {
      document.exitFullscreen().catch(() => {});
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(() => {});
      return;
    }

    element.requestFullscreen().catch(() => {});
  };

  const handleResetView = useCallback(() => {
    if (viewerCapabilities.resetView) {
      if (viewerHandleRef.current?.resetView) {
        viewerHandleRef.current.resetView();
        return;
      }

      if (viewerHandleRef.current?.fitView) {
        viewerHandleRef.current.fitView();
        return;
      }
    }

    if (viewerKind === "lcc") {
      // LCC reset 的第一版仍允许用重挂载兜底，避免外壳按钮失效。
      setViewerResetSeed((value) => value + 1);
      return;
    }
  }, [viewerCapabilities.resetView, viewerKind]);

  const handleFitView = useCallback(() => {
    if (!viewerCapabilities.fitView) {
      return;
    }
    if (viewerHandleRef.current?.fitView) {
      viewerHandleRef.current.fitView();
      return;
    }
    handleResetView();
  }, [handleResetView, viewerCapabilities.fitView]);

  const handleTakeScreenshot = () => {
    void viewerHandleRef.current?.takeScreenshot?.();
  };

  const handleTogglePointsDisplayMode = useCallback(() => {
    if (!isLccViewer || processingBlocked) {
      toast.warning("当前模型不支持点云切换");
      return false;
    }

    const succeeded = viewerHandleRef.current?.togglePointsDisplayMode?.() ?? false;
    if (!succeeded) {
      toast.warning("当前模型暂不支持点云切换");
    }
    return succeeded;
  }, [isLccViewer, processingBlocked]);

  const handleSetEnvironmentEnabled = useCallback(
    (enabled: boolean) => {
      if (!isLccViewer || processingBlocked) {
        toast.warning("当前模型不支持环境");
        return false;
      }

      const viewerHandle = viewerHandleRef.current;
      if (enabled && !viewerHandle?.hasEnvironment?.()) {
        toast.warning("当前模型不支持环境");
        return false;
      }

      const succeeded = viewerHandle?.setEnvironmentEnabled?.(enabled) ?? false;
      if (!succeeded && enabled) {
        toast.warning("环境切换暂不可用");
      }
      return succeeded;
    },
    [isLccViewer, processingBlocked],
  );

  const handleSetHeightClipPlane = useCallback(
    (options: ModelHeightClipOptions) => {
      if (!isLccViewer || processingBlocked) {
        toast.warning("当前模型不支持高度剖切");
        return false;
      }

      const succeeded = viewerHandleRef.current?.setHeightClipPlane?.(options) ?? false;
      if (!succeeded) {
        toast.warning("当前模型不支持高度剖切");
      }
      return succeeded;
    },
    [isLccViewer, processingBlocked],
  );

  const handleClearHeightClipPlane = useCallback(() => {
    if (!isLccViewer || processingBlocked) {
      toast.warning("当前模型不支持高度剖切");
      return false;
    }

    const succeeded = viewerHandleRef.current?.clearHeightClipPlane?.() ?? false;
    if (!succeeded) {
      toast.warning("高度剖切重置暂不可用");
    }
    return succeeded;
  }, [isLccViewer, processingBlocked]);

  const handleClearMeasure = useCallback(() => {
    measurePreviewSeqRef.current += 1;
    measurePointsRef.current = [];
    setIsMeasurePanelOpen(true);
    setMeasurePoints([]);
    setMeasurePreviewPoint(null);
    setMeasureAxisLines([]);
    setMeasureDistance(null);
  }, []);

  const resolveProjectedMeasureScreen = useCallback(
    (world: ModelViewerPoint, measureArea: HTMLElement): ModelMeasurePoint["screenPoint"] | null => {
      const projected = viewerHandleRef.current?.projectPoint?.(world);
      if (!projected) {
        return null;
      }

      const rect = measureArea.getBoundingClientRect();
      return {
        x: projected.clientX - rect.left,
        y: projected.clientY - rect.top,
        visible: projected.visible,
      };
    },
    [],
  );

  const resolveMeasureAxisLines = useCallback(
    (anchorPoint: ModelMeasurePoint | null, measureArea: HTMLElement): ModelMeasureAxisLine[] => {
      if (!anchorPoint) {
        return [];
      }

      const anchorWorldPoint = getMeasureWorldPoint(anchorPoint);
      const anchorScreen = resolveProjectedMeasureScreen(anchorWorldPoint, measureArea);
      if (!anchorScreen) {
        return [];
      }

      const axes = (viewerHandleRef.current?.getMeasurePlaneAxes?.() ?? FALLBACK_MEASURE_PLANE_AXES)
        .map((axis) => {
          const direction = normalizeMeasureAxisDirection(axis.direction);
          return direction ? { ...axis, direction } : null;
        })
        .filter((axis): axis is ModelViewerMeasureAxis => Boolean(axis));

      return axes.map((axis) => {
        const sample = MEASURE_AXIS_DIRECTION_SAMPLE_LENGTHS.flatMap((length) => [
          offsetMeasureWorldPointByDirection(anchorWorldPoint, axis.direction, length),
          offsetMeasureWorldPointByDirection(anchorWorldPoint, axis.direction, -length),
        ])
          .map((worldPoint) => {
            const screen = resolveProjectedMeasureScreen(worldPoint, measureArea);
            if (!screen) {
              return null;
            }

            const screenDistance = Math.hypot(screen.x - anchorScreen.x, screen.y - anchorScreen.y);
            if (screenDistance < MEASURE_AXIS_DIRECTION_MIN_PX) {
              return null;
            }

            return {
              screen,
              score: Math.abs(screenDistance - MEASURE_AXIS_DIRECTION_TARGET_PX),
            };
          })
          .filter((item): item is { screen: ModelMeasurePoint["screenPoint"]; score: number } =>
            Boolean(item),
          )
          .sort((a, b) => a.score - b.score)[0];

        if (!sample) {
          return null;
        }

        return createExtendedMeasureAxisLine(axis.id, axis.direction, anchorScreen, sample.screen, measureArea);
      }).filter((line): line is ModelMeasureAxisLine => Boolean(line));
    },
    [resolveProjectedMeasureScreen],
  );

  const resolveMeasureAxisSnap = useCallback(
    (
      pickResult: ModelViewerPickResult,
      measureArea: HTMLElement,
      fallbackClient: { clientX: number; clientY: number },
      anchorPoint: ModelMeasurePoint | null,
    ): {
      projectedPoint: ModelViewerPoint;
      screenPoint: ModelMeasurePoint["screenPoint"];
      axisId: ModelMeasureAxisLine["id"];
    } | null => {
      if (!anchorPoint) {
        return null;
      }

      const rect = measureArea.getBoundingClientRect();
      const pointerScreen = {
        x: fallbackClient.clientX - rect.left,
        y: fallbackClient.clientY - rect.top,
        visible: true,
      };
      const axisLines = resolveMeasureAxisLines(anchorPoint, measureArea);
      const anchorWorldPoint = getMeasureWorldPoint(anchorPoint);

      const candidates = axisLines
        .flatMap((line) => {
          const lineDistance = getScreenDistanceToSegment(pointerScreen, line.start, line.end);
          if (lineDistance > MEASURE_AXIS_SNAP_LINE_PX) {
            return [];
          }

          const lineCandidates: Array<{
            axisId: ModelMeasureAxisLine["id"];
            projectedPoint: ModelViewerPoint;
            screenPoint: ModelMeasurePoint["screenPoint"];
            score: number;
          }> = [];
          const projectedPoint = projectMeasureWorldPointToAxis(
            anchorWorldPoint,
            pickResult.lockedWorldPoint,
            line.direction,
          );
          const screenPoint = resolveProjectedMeasureScreen(projectedPoint, measureArea);
          if (screenPoint) {
            const pointDistance = Math.hypot(screenPoint.x - pointerScreen.x, screenPoint.y - pointerScreen.y);
            if (pointDistance <= MEASURE_AXIS_SNAP_POINT_PX) {
              lineCandidates.push({
                axisId: line.id,
                projectedPoint,
                screenPoint,
                score: lineDistance * 0.35 + pointDistance,
              });
            }
          }

          const pointerProjected = projectMeasureScreenPointToAxis(
            anchorWorldPoint,
            line.direction,
            pointerScreen,
            (worldPoint) => resolveProjectedMeasureScreen(worldPoint, measureArea),
          );
          if (pointerProjected && pointerProjected.screenDistance <= MEASURE_AXIS_SNAP_POINT_PX) {
            lineCandidates.push({
              axisId: line.id,
              projectedPoint: pointerProjected.projectedPoint,
              screenPoint: pointerProjected.screenPoint,
              score: lineDistance * 0.35 + pointerProjected.screenDistance * 0.75,
            });
          }

          return lineCandidates;
        })
        .sort((a, b) => a.score - b.score);

      return candidates[0]
        ? {
            axisId: candidates[0].axisId,
            projectedPoint: candidates[0].projectedPoint,
            screenPoint: candidates[0].screenPoint,
          }
        : null;
    },
    [resolveMeasureAxisLines, resolveProjectedMeasureScreen],
  );

  const createMeasurePoint = useCallback(
    (
      pickResult: ModelViewerPickResult,
      measureArea: HTMLElement,
      fallbackClient: { clientX: number; clientY: number },
      anchorPoint: ModelMeasurePoint | null = null,
    ): ModelMeasurePoint => {
      const rect = measureArea.getBoundingClientRect();
      const axisSnap = resolveMeasureAxisSnap(pickResult, measureArea, fallbackClient, anchorPoint);
      const projectedPoint = axisSnap?.projectedPoint ?? pickResult.projectedPoint ?? null;
      const screenWorldPoint = projectedPoint ?? pickResult.lockedWorldPoint;
      return {
        rawHitPoint: pickResult.rawHitPoint,
        lockedWorldPoint: pickResult.lockedWorldPoint,
        projectedPoint,
        snapAxisId: axisSnap?.axisId ?? null,
        screenPoint:
          axisSnap?.screenPoint ??
          resolveProjectedMeasureScreen(screenWorldPoint, measureArea) ?? {
            x: fallbackClient.clientX - rect.left,
            y: fallbackClient.clientY - rect.top,
            visible: true,
          },
      };
    },
    [resolveMeasureAxisSnap, resolveProjectedMeasureScreen],
  );

  const reprojectMeasurePoint = useCallback(
    (point: ModelMeasurePoint, measureArea: HTMLElement): ModelMeasurePoint => {
      const screen = resolveProjectedMeasureScreen(getMeasureWorldPoint(point), measureArea);
      if (!screen) {
        return point.screenPoint.visible === false
          ? point
          : { ...point, screenPoint: { ...point.screenPoint, visible: false } };
      }

      if (areMeasureScreensClose(point.screenPoint, screen)) {
        return point;
      }

      return { ...point, screenPoint: screen };
    },
    [resolveProjectedMeasureScreen],
  );

  const syncMeasureProjection = useCallback(() => {
    const measureArea = viewerInteractionAreaRef.current;
    if (!measureArea) {
      return;
    }

    setMeasurePoints((current) => {
      if (current.length === 0) {
        return current;
      }

      let changed = false;
      const next = current.map((point) => {
        const reprojected = reprojectMeasurePoint(point, measureArea);
        if (reprojected !== point) {
          changed = true;
        }
        return reprojected;
      });

      return changed ? next : current;
    });

    setMeasurePreviewPoint((current) => {
      if (!current) {
        return current;
      }

      return reprojectMeasurePoint(current, measureArea);
    });

    const axisAnchorPoint =
      measurePointsRef.current.length % 2 === 1
        ? measurePointsRef.current[measurePointsRef.current.length - 1]
        : null;
    const nextAxisLines = axisAnchorPoint ? resolveMeasureAxisLines(axisAnchorPoint, measureArea) : [];
    setMeasureAxisLines((current) =>
      areMeasureAxisLinesClose(current, nextAxisLines) ? current : nextAxisLines,
    );
  }, [reprojectMeasurePoint, resolveMeasureAxisLines]);

  useEffect(() => {
    if (!isMeasuring && measurePoints.length === 0) {
      return;
    }

    let frameId = 0;
    const tick = () => {
      syncMeasureProjection();
      frameId = window.requestAnimationFrame(tick);
    };

    syncMeasureProjection();
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isMeasuring, measurePoints.length, syncMeasureProjection]);

  const handleToggleMeasure = useCallback(() => {
    if (!isLccViewer || processingBlocked) {
      toast.warning("当前模型不支持测量");
      return;
    }

    setIsMeasuring((current) => {
      const next = !current;
      setIsMeasurePanelOpen(true);
      if (next) {
        clearMovementState();
        setIsHelpOpen(false);
        setMeasurePreviewPoint(null);
        setMeasureAxisLines([]);
      } else {
        measurePreviewSeqRef.current += 1;
        const currentPoints = measurePointsRef.current;
        const nextPoints = currentPoints.length % 2 === 1 ? currentPoints.slice(0, -1) : currentPoints;
        measurePointsRef.current = nextPoints;
        setMeasurePoints(nextPoints);
        setMeasurePreviewPoint(null);
        setMeasureAxisLines([]);
        setMeasureDistance(calculateTotalMeasureDistance(nextPoints));
      }
      return next;
    });
  }, [clearMovementState, isLccViewer, processingBlocked]);

  const handleFinishMeasure = useCallback(() => {
    measurePreviewSeqRef.current += 1;
    const currentPoints = measurePointsRef.current;
    const nextPoints = currentPoints.length % 2 === 1 ? currentPoints.slice(0, -1) : currentPoints;
    measurePointsRef.current = nextPoints;
    setIsMeasuring(false);
    setIsMeasurePanelOpen(true);
    setMeasurePoints(nextPoints);
    setMeasurePreviewPoint(null);
    setMeasureAxisLines([]);
    setMeasureDistance(calculateTotalMeasureDistance(nextPoints));
  }, []);

  const handleUndoMeasure = useCallback(() => {
    measurePreviewSeqRef.current += 1;
    const currentPoints = measurePointsRef.current;
    if (currentPoints.length === 0) {
      setMeasurePreviewPoint(null);
      setMeasureAxisLines([]);
      return;
    }

    const nextPoints = currentPoints.slice(0, -1);
    measurePointsRef.current = nextPoints;
    setIsMeasurePanelOpen(true);
    setMeasurePoints(nextPoints);
    setMeasurePreviewPoint(null);
    setMeasureAxisLines([]);
    setMeasureDistance(calculateTotalMeasureDistance(nextPoints));
  }, []);

  const handleMeasurePickAt = useCallback(
    async (
      clientX: number,
      clientY: number,
      nativeEvent: MouseEvent | PointerEvent,
      measureArea: HTMLElement,
    ) => {
      if (!isMeasuring || !isLccViewer || processingBlocked) {
        return;
      }

      measurePreviewSeqRef.current += 1;
      const point = await viewerHandleRef.current?.pickPoint?.(clientX, clientY, nativeEvent);
      if (!point) {
        toast.warning("未拾取到模型点，请点击模型表面");
        return;
      }

      const anchorPoint = measurePoints.length % 2 === 1 ? measurePoints[measurePoints.length - 1] : null;
      const nextPoint = createMeasurePoint(point, measureArea, { clientX, clientY }, anchorPoint);
      const nextPoints = [...measurePoints, nextPoint];
      measurePointsRef.current = nextPoints;
      setMeasurePoints(nextPoints);
      setMeasurePreviewPoint(null);
      setMeasureAxisLines(
        nextPoints.length % 2 === 1
          ? resolveMeasureAxisLines(nextPoints[nextPoints.length - 1] ?? null, measureArea)
          : [],
      );
      setMeasureDistance(calculateTotalMeasureDistance(nextPoints));
    },
    [
      createMeasurePoint,
      isLccViewer,
      isMeasuring,
      measurePoints,
      processingBlocked,
      resolveMeasureAxisLines,
    ],
  );

  const handleMeasurePick = useCallback(
    async (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      await handleMeasurePickAt(event.clientX, event.clientY, event.nativeEvent, event.currentTarget);
    },
    [handleMeasurePickAt],
  );

  const handleMeasurePreviewAt = useCallback(
    async (
      clientX: number,
      clientY: number,
      nativeEvent: PointerEvent,
      measureArea: HTMLElement,
    ) => {
      if (
        !isMeasuring ||
        !isLccViewer ||
        processingBlocked ||
        isHelpOpen ||
        isExternalFullscreen
      ) {
        setMeasurePreviewPoint(null);
        return;
      }

      const now = Date.now();
      if (now - lastMeasurePreviewAtRef.current < MEASURE_PREVIEW_PICK_INTERVAL_MS) {
        return;
      }

      lastMeasurePreviewAtRef.current = now;
      const seq = measurePreviewSeqRef.current + 1;
      measurePreviewSeqRef.current = seq;
      const point = await viewerHandleRef.current?.pickPoint?.(clientX, clientY, nativeEvent);

      if (seq !== measurePreviewSeqRef.current) {
        return;
      }

      if (!point) {
        setMeasurePreviewPoint(null);
        return;
      }

      const anchorPoint = measurePoints.length % 2 === 1 ? measurePoints[measurePoints.length - 1] : null;
      setMeasurePreviewPoint(createMeasurePoint(point, measureArea, { clientX, clientY }, anchorPoint));
    },
    [
      isExternalFullscreen,
      isHelpOpen,
      isLccViewer,
      isMeasuring,
      measurePoints,
      processingBlocked,
      createMeasurePoint,
    ],
  );

  const handleMeasurePreview = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      void handleMeasurePreviewAt(event.clientX, event.clientY, event.nativeEvent, event.currentTarget);
    },
    [handleMeasurePreviewAt],
  );

  const handleExitMeasure = useCallback(() => {
    measurePreviewSeqRef.current += 1;
    measurePointsRef.current = [];
    setIsMeasuring(false);
    setIsMeasurePanelOpen(false);
    setMeasurePoints([]);
    setMeasurePreviewPoint(null);
    setMeasureAxisLines([]);
    setMeasureDistance(null);
  }, []);

  useEffect(() => {
    const handleMeasureShortcutKeyDown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target) || isHelpOpen || (!isMeasuring && !isMeasurePanelOpen)) {
        return;
      }

      if (event.key === "Enter" && isMeasuring) {
        event.preventDefault();
        event.stopPropagation();
        handleFinishMeasure();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        clearMovementState();
        handleExitMeasure();
      }
    };

    document.addEventListener("keydown", handleMeasureShortcutKeyDown, true);
    return () => document.removeEventListener("keydown", handleMeasureShortcutKeyDown, true);
  }, [
    clearMovementState,
    handleExitMeasure,
    handleFinishMeasure,
    isHelpOpen,
    isMeasurePanelOpen,
    isMeasuring,
  ]);

  const handleSaveLaunchView = useCallback(async () => {
    if (saveLaunchViewPending) {
      return;
    }

    const saveResult = viewerHandleRef.current?.getLaunchViewForSave?.();
    if (!saveResult?.ok) {
      toast.error(saveResult?.message ?? "当前视角暂不支持保存");
      return;
    }

    const currentView = saveResult.view;
    setSaveLaunchViewPending(true);
    try {
      const result = await http.put<SaveLaunchViewResult>(
        `/models/${model.id}/launch-view`,
        currentView,
      );
      const nextView = result.launchView ?? currentView;
      viewerHandleRef.current?.commitSavedLaunchView?.(nextView);
      viewerHandleRef.current?.applyView?.(nextView);
      onLaunchViewSaved?.(nextView);
      toast.success("启动视图已保存");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "保存启动视图失败，请稍后重试。");
    } finally {
      setSaveLaunchViewPending(false);
    }
  }, [model.id, onLaunchViewSaved, saveLaunchViewPending]);

  const handleToggleHelp = () => {
    if (!isLccViewer) return;
    setIsHelpOpen((value) => {
      const nextValue = !value;
      if (nextValue) {
        clearMovementState();
      }
      return nextValue;
    });
  };

  const handleToggleControlMode = useCallback(() => {
    if (!isLccViewer) return;
    clearMovementState();
    setControlMode((current) => (current === "orbit" ? "walk" : "orbit"));
  }, [clearMovementState, isLccViewer]);

  useEffect(() => {
    if (!isLccViewer) {
      setIsHelpOpen(false);
      setMovementInput(cloneEmptyMovementInput());
      setMoveSpeedMultiplier(1);
    }
  }, [isLccViewer]);

  useEffect(() => {
    if (isHelpOpen) {
      clearMovementState();
    }
  }, [clearMovementState, isHelpOpen]);

  useEffect(() => {
    clearMovementState();
    setIsHelpOpen(false);
    setIsMeasuring(false);
    setIsMeasurePanelOpen(false);
    measurePointsRef.current = [];
    setMeasurePoints([]);
    setMeasurePreviewPoint(null);
    setMeasureAxisLines([]);
    setMeasureDistance(null);
    setControlMode(isLccViewer ? "walk" : "orbit");
  }, [clearMovementState, isLccViewer, model.id]);

  useEffect(() => {
    if (!isLccViewer) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const movementKeyMap: Partial<Record<string, keyof ModelViewerMovementInput>> = {
        w: "forward",
        s: "backward",
        a: "left",
        d: "right",
        q: "down",
        e: "up",
      };
      const movementKey = movementKeyMap[key];

      if (!isHelpOpen && isMeasuring && event.key === "Enter") {
        event.preventDefault();
        handleFinishMeasure();
        return;
      }

      if (!isHelpOpen && (isMeasuring || isMeasurePanelOpen) && event.key === "Escape") {
        event.preventDefault();
        clearMovementState();
        handleExitMeasure();
        return;
      }

      if (isHelpOpen && (key === "shift" || movementKey)) {
        return;
      }

      // WASD / QE / Shift 仅在漫游模式下生效
      if (controlMode !== "walk" && (key === "shift" || movementKey)) {
        return;
      }

      // Shift 加速倍率：2x
      if (key === "shift") {
        setMoveSpeedMultiplier(2);
        return;
      }

      if (key === "r") {
        handleResetView();
        return;
      }

      if (key === "h") {
        setIsHelpOpen((value) => {
          const nextValue = !value;
          if (nextValue) {
            clearMovementState();
          }
          return nextValue;
        });
        return;
      }

      if (event.key === "Escape") {
        clearMovementState();
        setIsHelpOpen(false);
        return;
      }

      if (!movementKey) {
        return;
      }

      setMovementInput((current) =>
        current[movementKey] ? current : { ...current, [movementKey]: true },
      );
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "shift") {
        setMoveSpeedMultiplier(1);
        return;
      }

      const movementKeyMap: Partial<Record<string, keyof ModelViewerMovementInput>> = {
        w: "forward",
        s: "backward",
        a: "left",
        d: "right",
        q: "down",
        e: "up",
      };
      const movementKey = movementKeyMap[key];
      if (!movementKey) {
        return;
      }

      setMovementInput((current) =>
        current[movementKey] ? { ...current, [movementKey]: false } : current,
      );
    };

    const handleWindowBlur = () => {
      clearMovementState();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearMovementState();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearMovementState();
    };
  }, [
    clearMovementState,
    controlMode,
    handleExitMeasure,
    handleFinishMeasure,
    handleResetView,
    isHelpOpen,
    isLccViewer,
    isMeasurePanelOpen,
    isMeasuring,
  ]);

  useEffect(() => {
    if (controlMode !== "walk") {
      viewerHandleRef.current?.setMovementInput?.(cloneEmptyMovementInput());
      return;
    }
    viewerHandleRef.current?.setMovementInput?.(movementInput);
  }, [controlMode, movementInput]);

  useEffect(() => {
    if (controlMode !== "walk") {
      viewerHandleRef.current?.setMoveSpeedMultiplier?.(1);
      return;
    }
    viewerHandleRef.current?.setMoveSpeedMultiplier?.(moveSpeedMultiplier);
  }, [controlMode, moveSpeedMultiplier]);

  useEffect(() => {
    viewerHandleRef.current?.setControlMode?.(controlMode);
  }, [controlMode]);

  useEffect(() => {
    const syncExternalFullscreen = () => {
      const fullscreenElement = document.fullscreenElement;
      const shellRoot = shellRootRef.current;
      const viewerTarget = viewerFullscreenTargetRef.current;

      setIsExternalFullscreen(
        Boolean(
          fullscreenElement &&
          shellRoot &&
          fullscreenElement !== viewerTarget &&
          fullscreenElement.contains(shellRoot),
        ),
      );
    };

    syncExternalFullscreen();
    document.addEventListener("fullscreenchange", syncExternalFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncExternalFullscreen);
  }, []);

  const renderViewer = () => {
    switch (viewerKind) {
      case "lcc":
        // 架构说明：当前模型详情页中的 LCC/LCC2 已统一走 /viewer/lcc/[id] iframe 页面。
        // 这里保留 LCC 分支仅用于兼容非详情页复用场景，后续不要把详情页问题的主修复入口放在此处。
        return (
          <LccViewer
            key={`${model.id}-${model.viewerUrl || ""}-${model.fileFormat || "none"}-${viewerResetSeed}`}
            ref={viewerHandleRef}
            modelId={model.id}
            modelUrl={model.viewerUrl}
            viewerUrl={model.viewerUrl}
            fileFormat={model.fileFormat}
            viewerType={model.viewerType}
            viewerContext="embedded"
            launchView={model.launchView}
            defaultCameraJson={model.defaultCameraJson}
            processingBlocked={processingBlocked}
            controlMode={controlMode}
            isHelpOpen={isHelpOpen}
            renderQuality={renderQuality}
          />
        );
      case "glb":
        return <GlbViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "ply":
        return <PlyViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "bim":
        return <BimViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "osgb":
        return <OsgbViewer ref={viewerHandleRef} model={model} processingHint={processingHint} />;
      case "iframe":
        return (
          <IframeViewer
            key={`${model.id}-${model.viewerUrl || ""}-${model.fileFormat || "none"}-${viewerResetSeed}`}
            ref={viewerHandleRef}
            model={model}
            processingHint={processingHint}
          />
        );
      case "zip":
      case "unsupported":
      default:
        return (
          <UnsupportedViewer
            ref={viewerHandleRef}
            model={model}
            processingHint={processingHint}
          />
        );
    }
  };

  return (
      <div ref={shellRootRef} className="flex h-full flex-col bg-[#0d0d0d]">
        <div
          ref={viewerInteractionAreaRef}
          className="relative min-h-[360px] flex-1 overflow-hidden lg:min-h-[520px]"
        >
        <div ref={viewerFullscreenTargetRef} className="h-full w-full bg-[#0d0d0d]">
          {renderViewer()}
        </div>
        <ModelMeasureOverlay
          active={
            isLccViewer &&
            (isMeasurePanelOpen || isMeasuring || measurePoints.length > 0) &&
            !processingBlocked &&
            !isExternalFullscreen &&
            !isHelpOpen
          }
          picking={isLccViewer && isMeasuring && !processingBlocked && !isExternalFullscreen && !isHelpOpen}
          points={measurePoints}
          previewPoint={measurePreviewPoint}
          axisLines={measureAxisLines}
          onPreview={handleMeasurePreview}
          onPick={handleMeasurePick}
          onClear={handleClearMeasure}
          onFinish={handleFinishMeasure}
          onUndo={handleUndoMeasure}
          onExit={handleExitMeasure}
        />
        <ModelViewerHelp
          open={isLccViewer && isHelpOpen && !isExternalFullscreen}
          onClose={() => {
            clearMovementState();
            setIsHelpOpen(false);
          }}
          controlMode={controlMode}
        />
        <div
          className={
            isExternalFullscreen
              ? "hidden"
              : "pointer-events-none absolute bottom-4 left-4 z-20"
          }
        >
          <div className="pointer-events-auto">
            <ModelViewerToolbar
              capabilities={viewerCapabilities}
              onResetView={handleResetView}
              onFitView={handleFitView}
              onToggleFullscreen={handleFullscreen}
              onTakeScreenshot={handleTakeScreenshot}
              onSaveLaunchView={handleSaveLaunchView}
              onTogglePointsDisplayMode={isLccViewer ? handleTogglePointsDisplayMode : undefined}
              canTogglePointsDisplayMode={isLccViewer && !processingBlocked}
              onSetEnvironmentEnabled={isLccViewer ? handleSetEnvironmentEnabled : undefined}
              canUseEnvironment={isLccViewer && !processingBlocked}
              onToggleMeasure={isLccViewer ? handleToggleMeasure : undefined}
              canMeasure={isLccViewer && !processingBlocked}
              isMeasuring={isMeasurePanelOpen || isMeasuring}
              onSetHeightClipPlane={isLccViewer ? handleSetHeightClipPlane : undefined}
              onClearHeightClipPlane={isLccViewer ? handleClearHeightClipPlane : undefined}
              canUseHeightClipPlane={isLccViewer && !processingBlocked}
              onToggleHelp={isLccViewer ? handleToggleHelp : undefined}
              isHelpOpen={isHelpOpen}
              canShowSaveLaunchView={canShowSaveLaunchView}
              saveLaunchViewPending={saveLaunchViewPending}
              controlMode={controlMode}
              onToggleControlMode={isLccViewer ? handleToggleControlMode : undefined}
              canToggleControlMode={isLccViewer && !processingBlocked}
              renderQuality={lccRenderQualityToLabel(renderQuality)}
              onRenderQualityChange={isLccViewer ? handleRenderQualityChange : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
