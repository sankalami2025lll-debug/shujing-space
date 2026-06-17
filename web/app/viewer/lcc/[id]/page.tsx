"use client";

/**
 * 页面名称：LCC 独立查看器（iframe 隔离页面）
 * 页面用途：在独立 iframe document 中初始化 LCC Web SDK，彻底隔离 WebGL/Renderer/Camera/SDK 状态，
 *           避免主页面 React SPA 中反复挂载/卸载导致的 WebGL 上下文污染和空白问题。
 * 主要功能：
 *   1. 根据模型 ID 请求 GET /api/models/:id，获取模型数据和启动视图。
 *   2. 校验模型格式为 lcc/lcc2 后全屏渲染 LccViewer。
 *   3. 内置工具栏：保存启动视图、重置视角、全屏、观察/漫游切换、帮助。
 *   4. 内置键盘控制：WASD/QE/Shift/R/H/Escape。
 *   5. 保存启动视图直接调用 PUT /api/models/:id/launch-view（iframe 内部自闭环）。
 * 对应路由：/viewer/lcc/:id
 * 说明：本页不渲染主站导航栏、模型详情信息面板；仅保留极简 loading/error 状态。
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { LccViewer } from "@/components/models/lcc-viewer";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { ModelViewerToolbar } from "@/components/models/model-viewer-toolbar";
import { ModelViewerHelp } from "@/components/models/model-viewer-help";
import { useAuth } from "@/components/providers/auth-provider";
import { getModelDetail } from "@/lib/api/models";
import { getModelViewerKind } from "@/lib/model-viewer-kind";
import { http, ApiError } from "@/lib/http";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { ModelDetail, ModelLaunchView } from "@/lib/types";
import type {
  ModelViewerHandle,
  ModelViewerControlMode,
  ModelViewerMovementInput,
} from "@/components/models/viewers/types";
import { LCC_VIEWER_CAPABILITIES } from "@/components/models/viewers/types";

/* ---------- 类型定义 ---------- */

/** 保存启动视图的接口返回结构 */
interface SaveLaunchViewResult {
  launchView: ModelLaunchView;
  updatedAt: string;
  updatedBy: number;
}

/* ---------- 常量 ---------- */

/** 空移动输入（所有方向均为 false） */
const EMPTY_MOVEMENT_INPUT: ModelViewerMovementInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

/** 创建空移动输入的副本 */
function cloneEmptyMovementInput(): ModelViewerMovementInput {
  return { ...EMPTY_MOVEMENT_INPUT };
}

/** 判断当前聚焦元素是否为输入框/文本域/可编辑元素 */
function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

/* ---------- 页面组件 ---------- */

export default function LccViewerIframePage() {
  const { user } = useAuth();
  /* ---- URL 参数 ---- */
  const params = useParams();
  const rawId = params?.id;
  const modelId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  /* ---- 模型数据状态 ---- */
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  /* ---- Viewer 状态 ---- */
  // viewerHandleRef：LccViewer 暴露的操作接口
  const viewerHandleRef = useRef<ModelViewerHandle | null>(null);
  // controlMode：观察（orbit）或漫游（walk）模式
  const [controlMode, setControlMode] = useState<ModelViewerControlMode>("walk");
  // movementInput：漫游模式下的移动方向状态
  const [movementInput, setMovementInput] = useState<ModelViewerMovementInput>(EMPTY_MOVEMENT_INPUT);
  // moveSpeedMultiplier：Shift 加速倍率
  const [moveSpeedMultiplier, setMoveSpeedMultiplier] = useState(1);
  // isHelpOpen：帮助面板显隐
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // saveLaunchViewPending：保存启动视图 loading 态
  const [saveLaunchViewPending, setSaveLaunchViewPending] = useState(false);

  /* ---- 自动聚焦 viewer 容器（确保 iframe / 独立页面获得键盘焦点，WASD 可用） ---- */
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (detailLoading || !detail) return;
    const container = viewerContainerRef.current;
    if (!container) return;
    const focusViewer = () => {
      container.focus({ preventScroll: true });
    };
    // 第一次聚焦
    focusViewer();
    // 延迟再聚焦一次（等 LccViewer 完成初始化后）
    const timer = setTimeout(focusViewer, 500);
    return () => clearTimeout(timer);
  }, [detailLoading, detail]);

  /* ---- 派生状态 ---- */
  const processingBlocked = detail ? detail.processingStatus !== "ready" : true;
  // 仅 LCC viewer 具备的能力集
  const viewerCapabilities = useMemo(() => LCC_VIEWER_CAPABILITIES, []);
  // 保存启动视图按钮是否可用（模型已就绪 + 后端允许 + viewer 支持）
  const canShowSaveLaunchView =
    !processingBlocked && detail?.canSaveLaunchView !== false && viewerCapabilities.saveView;

  /* ---- 清除移动状态（窗口失焦/关闭帮助/退出漫游时调用） ---- */
  const clearMovementState = useCallback(() => {
    const emptyInput = cloneEmptyMovementInput();
    setMovementInput(emptyInput);
    setMoveSpeedMultiplier(1);
    viewerHandleRef.current?.setMovementInput?.(emptyInput);
    viewerHandleRef.current?.setMoveSpeedMultiplier?.(1);
  }, []);

  /* ---- 全屏 ---- */
  const handleFullscreen = useCallback(() => {
    const element = viewerContainerRef.current;
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
  }, []);

  /* ---- 重置视角 ---- */
  const handleResetView = useCallback(() => {
    viewerHandleRef.current?.resetView?.();
  }, []);

  /* ---- 适应视图 ---- */
  const handleFitView = useCallback(() => {
    if (viewerHandleRef.current?.fitView) {
      viewerHandleRef.current.fitView();
      return;
    }
    viewerHandleRef.current?.resetView?.();
  }, []);

  /* ---- 保存启动视图 ---- */
  const handleSaveLaunchView = useCallback(async () => {
    if (saveLaunchViewPending || !detail) return;

    // 从 LccViewer 获取当前视角快照
    const saveResult = viewerHandleRef.current?.getLaunchViewForSave?.();
    if (!saveResult?.ok) {
      toast.error(saveResult?.message ?? "当前视角暂不支持保存");
      return;
    }

    const currentView = saveResult.view;
    setSaveLaunchViewPending(true);
    try {
      // PUT /api/models/:id/launch-view 保存启动视图（iframe 内部自闭环）
      const result = await http.put<SaveLaunchViewResult>(
        `/models/${detail.id}/launch-view`,
        currentView,
      );
      const nextView = result.launchView ?? currentView;
      // 保存成功后仅更新内存默认视角，不重新应用（避免画面跳变）
      viewerHandleRef.current?.commitSavedLaunchView?.(nextView);
      toast.success("启动视图已保存");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "保存启动视图失败，请稍后重试。");
    } finally {
      setSaveLaunchViewPending(false);
    }
  }, [detail, saveLaunchViewPending]);

  /* ---- 切换帮助面板 ---- */
  const handleToggleHelp = useCallback(() => {
    setIsHelpOpen((value) => {
      const nextValue = !value;
      if (nextValue) clearMovementState();
      return nextValue;
    });
  }, [clearMovementState]);

  /* ---- 切换控制模式（观察/漫游） ---- */
  const handleToggleControlMode = useCallback(() => {
    clearMovementState();
    setControlMode((current) => (current === "orbit" ? "walk" : "orbit"));
  }, [clearMovementState]);

  /* ---- 拉取模型详情 ---- */
  useEffect(() => {
    if (!idValid) {
      setDetailLoading(false);
      setDetail(null);
      setDetailError("模型 ID 无效");
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);

    getModelDetail(numericId)
      .then((d) => {
        if (!active) return;
        // 校验是否为 LCC 模型（安全兜底：非 LCC 格式显示错误）
        const kind = getModelViewerKind({
          viewerType: d.viewerType,
          fileFormat: d.fileFormat,
          viewerUrl: d.viewerUrl,
        });
        if (kind !== "lcc") {
          setDetailError("该模型不是 LCC/LCC2 格式，无法在此查看器打开。");
          return;
        }
        setDetail(d);
      })
      .catch((e) => {
        if (!active) return;
        const msg =
          e instanceof ApiError
            ? e.status === 404
              ? "模型不存在或暂未公开"
              : e.message
            : "模型详情加载失败，请稍后重试。";
        setDetailError(msg);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [idValid, numericId]);

  /* ---- 同步控制模式到 LccViewer ---- */
  useEffect(() => {
    viewerHandleRef.current?.setControlMode?.(controlMode);
  }, [controlMode]);

  /* ---- 同步移动输入到 LccViewer ---- */
  useEffect(() => {
    if (controlMode !== "walk") {
      viewerHandleRef.current?.setMovementInput?.(cloneEmptyMovementInput());
      return;
    }
    viewerHandleRef.current?.setMovementInput?.(movementInput);
  }, [controlMode, movementInput]);

  /* ---- 同步速度倍率到 LccViewer ---- */
  useEffect(() => {
    if (controlMode !== "walk") {
      viewerHandleRef.current?.setMoveSpeedMultiplier?.(1);
      return;
    }
    viewerHandleRef.current?.setMoveSpeedMultiplier?.(moveSpeedMultiplier);
  }, [controlMode, moveSpeedMultiplier]);

  /* ---- 键盘控制 ---- */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) return;

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

      // 帮助面板打开时不响应移动键和 Shift
      if (isHelpOpen && (key === "shift" || movementKey)) return;

      // WASD / QE / Shift 仅在漫游模式下生效
      if (controlMode !== "walk" && (key === "shift" || movementKey)) return;

      // Shift 加速倍率：2x
      if (key === "shift") {
        setMoveSpeedMultiplier(2);
        return;
      }

      // R 重置视角
      if (key === "r") {
        handleResetView();
        return;
      }

      // H 切换帮助
      if (key === "h") {
        setIsHelpOpen((value) => {
          const nextValue = !value;
          if (nextValue) clearMovementState();
          return nextValue;
        });
        return;
      }

      // Escape 清除移动状态并关闭帮助
      if (event.key === "Escape") {
        clearMovementState();
        setIsHelpOpen(false);
        return;
      }

      if (!movementKey) return;

      // 设置移动方向（仅当该方向还未激活时更新，避免无限 re-render）
      setMovementInput((current) =>
        current[movementKey] ? current : { ...current, [movementKey]: true },
      );
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) return;

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
      if (!movementKey) return;

      setMovementInput((current) =>
        current[movementKey] ? { ...current, [movementKey]: false } : current,
      );
    };

    // 窗口失焦时清除移动状态（防止按键卡住）
    const handleWindowBlur = () => clearMovementState();

    // 页面隐藏时清除移动状态
    const handleVisibilityChange = () => {
      if (document.hidden) clearMovementState();
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
  }, [clearMovementState, controlMode, handleResetView, isHelpOpen]);

  /* ---- 关闭帮助时清除移动状态 ---- */
  useEffect(() => {
    if (isHelpOpen) clearMovementState();
  }, [clearMovementState, isHelpOpen]);

  /* ---- 模型切换时重置状态 ---- */
  useEffect(() => {
    clearMovementState();
    setIsHelpOpen(false);
    setControlMode("walk");
  }, [clearMovementState, detail?.id]);

  /* ---- 渲染：Loading ---- */
  if (detailLoading) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0a]">
        <ModelLoadingOverlay visible showText={false} />
      </div>
    );
  }

  /* ---- 渲染：Error ---- */
  if (detailError || !detail) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-3 text-gray-500 bg-[#0a0a0a]">
        <AlertTriangle className="w-10 h-10 opacity-30" />
        <p className="text-[15px]">{detailError ?? "模型不存在或暂未公开"}</p>
      </div>
    );
  }

  /* ---- 渲染：LCC Viewer ---- */
  return (
    <div
      ref={viewerContainerRef}
      tabIndex={0}
      className="h-screen w-screen relative bg-[#0d0d0d] overflow-hidden outline-none"
    >
      {/* LCC Viewer 全屏渲染 */}
      <LccViewer
        key={`${detail.id}-${detail.viewerUrl || ""}-${detail.fileFormat || "none"}`}
        ref={viewerHandleRef}
        modelUrl={detail.viewerUrl}
        viewerUrl={detail.viewerUrl}
        fileFormat={detail.fileFormat}
        viewerType={detail.viewerType}
        launchView={detail.launchView}
        defaultCameraJson={detail.defaultCameraJson}
        processingBlocked={processingBlocked}
        controlMode={controlMode}
        onViewerReady={() => {
          window.parent?.postMessage(
            { type: "SHUJING_LCC_VIEWER_READY", modelId: detail.id },
            window.location.origin,
          );
        }}
      />

      {/* 帮助面板（LCC 操作说明） */}
      <ModelViewerHelp open={isHelpOpen} />

      {/* 底部左侧工具栏 */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20">
        <div className="pointer-events-auto">
          <ModelViewerToolbar
            capabilities={viewerCapabilities}
            onResetView={handleResetView}
            onFitView={handleFitView}
            onToggleFullscreen={handleFullscreen}
            onSaveLaunchView={handleSaveLaunchView}
            showSaveLaunchView={Boolean(user)}
            onToggleHelp={handleToggleHelp}
            isHelpOpen={isHelpOpen}
            canShowSaveLaunchView={canShowSaveLaunchView}
            saveLaunchViewPending={saveLaunchViewPending}
            controlMode={controlMode}
            onToggleControlMode={handleToggleControlMode}
            canToggleControlMode={!processingBlocked}
          />
        </div>
      </div>
    </div>
  );
}
