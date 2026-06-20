"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  const viewerViewportRef = useRef<HTMLDivElement | null>(null);
  const viewerHandleRef = useRef<ModelViewerHandle | null>(null);
  const [viewerResetSeed, setViewerResetSeed] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [movementInput, setMovementInput] = useState<ModelViewerMovementInput>(EMPTY_MOVEMENT_INPUT);
  const [moveSpeedMultiplier, setMoveSpeedMultiplier] = useState(1);
  const [saveLaunchViewPending, setSaveLaunchViewPending] = useState(false);
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
    const element = viewerViewportRef.current;
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
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      <div ref={viewerViewportRef} className="relative min-h-[360px] flex-1 overflow-hidden lg:min-h-[520px]">
        {renderViewer()}
        <ModelViewerHelp
          open={isLccViewer && isHelpOpen}
          onClose={() => {
            clearMovementState();
            setIsHelpOpen(false);
          }}
          controlMode={controlMode}
        />
        <div className="pointer-events-none absolute bottom-4 left-4 z-20">
          <div className="pointer-events-auto">
            <ModelViewerToolbar
              capabilities={viewerCapabilities}
              onResetView={handleResetView}
              onFitView={handleFitView}
              onToggleFullscreen={handleFullscreen}
              onTakeScreenshot={handleTakeScreenshot}
              onSaveLaunchView={handleSaveLaunchView}
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
