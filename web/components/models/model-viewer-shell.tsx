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
  type ModelViewerMovementInput,
  type ModelViewerHandle,
  type ModelViewerPoint,
  type ModelHeightClipOptions,
} from "@/components/models/viewers/types";
import { ApiError, http } from "@/lib/http";
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
  const [measurePoints, setMeasurePoints] = useState<ModelMeasurePoint[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
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
    setMeasurePoints([]);
    setMeasureDistance(null);
  }, []);

  const handleToggleMeasure = useCallback(() => {
    if (!isLccViewer || processingBlocked) {
      toast.warning("当前模型不支持测量");
      return;
    }

    setIsMeasuring((current) => {
      const next = !current;
      if (next) {
        clearMovementState();
        setIsHelpOpen(false);
        setMeasurePoints([]);
        setMeasureDistance(null);
      }
      return next;
    });
  }, [clearMovementState, isLccViewer, processingBlocked]);

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

      const point = await viewerHandleRef.current?.pickPoint?.(clientX, clientY, nativeEvent);
      if (!point) {
        toast.warning("未拾取到模型点，请点击模型表面");
        return;
      }

      const rect = measureArea.getBoundingClientRect();
      const nextPoint: ModelMeasurePoint = {
        world: point,
        screen: {
          x: clientX - rect.left,
          y: clientY - rect.top,
        },
      };
      const nextPoints = measurePoints.length >= 2 ? [nextPoint] : [...measurePoints, nextPoint];
      setMeasurePoints(nextPoints);
      setMeasureDistance(
        nextPoints.length === 2
          ? calculateMeasureDistance(nextPoints[0].world, nextPoints[1].world)
          : null,
      );
    },
    [isLccViewer, isMeasuring, measurePoints, processingBlocked],
  );

  const handleMeasurePick = useCallback(
    async (event: ReactMouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      await handleMeasurePickAt(event.clientX, event.clientY, event.nativeEvent, event.currentTarget);
    },
    [handleMeasurePickAt],
  );

  useEffect(() => {
    const measureArea = viewerInteractionAreaRef.current;
    if (!measureArea || !isMeasuring || !isLccViewer || processingBlocked || isHelpOpen || isExternalFullscreen) {
      return;
    }

    let lastPointerPickAt = 0;
    const shouldIgnoreTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(target.closest("button,a,input,textarea,select,[data-measure-panel='true']"));
    const pickFromNativeEvent = (event: MouseEvent | PointerEvent) => {
      if (shouldIgnoreTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void handleMeasurePickAt(event.clientX, event.clientY, event, measureArea);
    };
    const handlePointerDown = (event: PointerEvent) => {
      lastPointerPickAt = Date.now();
      pickFromNativeEvent(event);
    };
    const handleClick = (event: MouseEvent) => {
      if (Date.now() - lastPointerPickAt < 350) {
        return;
      }
      pickFromNativeEvent(event);
    };

    measureArea.addEventListener("pointerdown", handlePointerDown, true);
    measureArea.addEventListener("click", handleClick, true);
    return () => {
      measureArea.removeEventListener("pointerdown", handlePointerDown, true);
      measureArea.removeEventListener("click", handleClick, true);
    };
  }, [
    handleMeasurePickAt,
    isExternalFullscreen,
    isHelpOpen,
    isLccViewer,
    isMeasuring,
    processingBlocked,
  ]);

  const handleExitMeasure = useCallback(() => {
    setIsMeasuring(false);
    setMeasurePoints([]);
    setMeasureDistance(null);
  }, []);

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
    setMeasurePoints([]);
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
  }, [clearMovementState, controlMode, handleResetView, isHelpOpen, isLccViewer]);

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
            modelUrl={model.viewerUrl}
            viewerUrl={model.viewerUrl}
            fileFormat={model.fileFormat}
            viewerType={model.viewerType}
            launchView={model.launchView}
            defaultCameraJson={model.defaultCameraJson}
            processingBlocked={processingBlocked}
            controlMode={controlMode}
            isHelpOpen={isHelpOpen}
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
          active={isLccViewer && isMeasuring && !processingBlocked && !isExternalFullscreen && !isHelpOpen}
          points={measurePoints}
          distance={measureDistance}
          onPick={handleMeasurePick}
          onClear={handleClearMeasure}
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
              isMeasuring={isMeasuring}
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
