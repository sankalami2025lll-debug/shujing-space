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
import { useParams, useSearchParams } from "next/navigation";
import { LccViewer } from "@/components/models/lcc-viewer";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { ModelViewerToolbar } from "@/components/models/model-viewer-toolbar";
import { ModelViewerHelp } from "@/components/models/model-viewer-help";
import { MobileLccGameControls } from "@/components/models/mobile-lcc-game-controls";
import { MobileLccHelpOverlay } from "@/components/models/mobile-lcc-help-overlay";
import { MobileLccViewerChrome } from "@/components/models/mobile-lcc-viewer-chrome";
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

interface ScreenOrientationWithLock {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => Promise<void>;
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

const ORIENTATION_LANDSCAPE = "landscape";

/** 全屏目标上下文：mobile share 优先使用父页面横屏舞台 root */
interface FullscreenTargetContext {
  element: HTMLElement | null;
  doc: Document;
  isParent: boolean;
}

/** 读取父页面分享壳全屏 root（同源 iframe 可访问） */
function getParentShareFullscreenRoot(): HTMLElement | null {
  try {
    if (window.parent === window) return null;
    return window.parent.document.getElementById("model-share-viewer-fullscreen-root");
  } catch {
    return null;
  }
}

/** 解析全屏目标：mobile share 走父页面 root，否则走 iframe 内 viewer 容器 */
function resolveFullscreenTarget(
  isMobileShareViewer: boolean,
  viewerContainer: HTMLElement | null,
): FullscreenTargetContext {
  if (isMobileShareViewer) {
    try {
      const parentRoot = getParentShareFullscreenRoot();
      if (parentRoot) {
        return { element: parentRoot, doc: window.parent.document, isParent: true };
      }
    } catch {
      /* 跨域或不可访问时 fallback iframe 内容器 */
    }
  }

  return { element: viewerContainer, doc: document, isParent: false };
}

/** 检测当前环境是否支持 Fullscreen API（标准或 webkit 前缀） */
function isFullscreenApiSupported(element?: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  const target = (element ?? document.documentElement) as FullscreenElement;
  return (
    typeof target.requestFullscreen === "function" ||
    typeof target.webkitRequestFullscreen === "function"
  );
}

/** 读取指定 document 的当前全屏元素（兼容 webkit 前缀） */
function getDocumentFullscreenElement(doc: Document): Element | null {
  const d = doc as FullscreenDocument;
  return doc.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** 读取 iframe 内 document 的当前全屏元素（兼容 webkit 前缀） */
function getCurrentFullscreenElement(): Element | null {
  return getDocumentFullscreenElement(document);
}

/** 对指定元素发起真实全屏请求 */
async function requestElementFullscreen(element: HTMLElement): Promise<void> {
  const el = element as FullscreenElement;
  if (typeof el.requestFullscreen === "function") {
    await el.requestFullscreen();
    return;
  }
  if (typeof el.webkitRequestFullscreen === "function") {
    await el.webkitRequestFullscreen();
  }
}

/** 退出指定 document 的全屏 */
async function exitDocumentFullscreen(doc: Document): Promise<void> {
  const d = doc as FullscreenDocument;
  if (typeof doc.exitFullscreen === "function") {
    await doc.exitFullscreen();
    return;
  }
  if (typeof d.webkitExitFullscreen === "function") {
    await d.webkitExitFullscreen();
  }
}

/** 尝试横屏锁定；失败静默 */
async function tryLockLandscape(isParent: boolean): Promise<void> {
  try {
    const orientation = (isParent ? window.parent.screen : screen)
      .orientation as unknown as ScreenOrientationWithLock;
    await orientation.lock?.(ORIENTATION_LANDSCAPE);
  } catch {
    /* orientation lock 失败静默，不影响全屏本身 */
  }
}

/** 尝试解除横屏锁定；失败静默 */
async function tryUnlockOrientation(isParent: boolean): Promise<void> {
  try {
    const orientation = (isParent ? window.parent.screen : screen)
      .orientation as unknown as ScreenOrientationWithLock;
    await orientation.unlock?.();
  } catch {
    /* orientation unlock 失败静默 */
  }
}

/* ---------- 页面组件 ---------- */

export default function LccViewerIframePage() {
  /* ---- URL 参数 ---- */
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params?.id;
  const modelId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  const numericId = Number.parseInt(modelId, 10);
  const idValid = Number.isFinite(numericId) && numericId > 0;

  // 分享页 iframe query：context=share / readonly=1 / mobile=1（mobile 预留给第 2 步触控层）
  const isShareContext = searchParams.get("context") === "share";
  const isReadonly = searchParams.get("readonly") === "1";
  const isMobileViewer = searchParams.get("mobile") === "1";
  /** 手机分享 iframe：外层 model-share-viewer-page 已负责 Loading，内层不再展示避免双层闪烁 */
  const isMobileShareViewer = isMobileViewer && isShareContext;

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
  /** mobile=1 首次 ready 后是否已应用默认 walk（避免用户切 orbit 后被 effect 打回） */
  const hasAppliedMobileDefaultModeRef = useRef(false);
  /** 手机工具菜单：viewer 根容器是否处于浏览器真实全屏 */
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  /** 手机工具菜单：当前 iframe 环境是否支持 Fullscreen API */
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  /* ---- 自动聚焦 viewer 容器（确保 iframe / 独立页面获得键盘焦点，WASD 可用） ---- */
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  /** 同步 viewer 全屏状态：mobile share 读父页面 root，否则读 iframe 内容器 */
  const syncFullscreenState = useCallback(() => {
    if (isMobileShareViewer) {
      try {
        const parentRoot = getParentShareFullscreenRoot();
        if (parentRoot) {
          const parentFs = getDocumentFullscreenElement(window.parent.document);
          setIsViewerFullscreen(parentFs === parentRoot);
          return;
        }
      } catch {
        /* 父页面不可访问时 fallback iframe 内判断 */
      }
    }

    const element = viewerContainerRef.current;
    if (!element) {
      setIsViewerFullscreen(false);
      return;
    }
    setIsViewerFullscreen(getCurrentFullscreenElement() === element);
  }, [isMobileShareViewer]);

  useEffect(() => {
    if (isMobileShareViewer) {
      try {
        const parentRoot = getParentShareFullscreenRoot();
        setFullscreenSupported(isFullscreenApiSupported(parentRoot ?? undefined));
      } catch {
        setFullscreenSupported(isFullscreenApiSupported(viewerContainerRef.current));
      }
    } else {
      setFullscreenSupported(isFullscreenApiSupported(viewerContainerRef.current));
    }
    syncFullscreenState();
  }, [isMobileShareViewer, syncFullscreenState]);

  useEffect(() => {
    const handleFsChange = () => syncFullscreenState();

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);

    let parentDoc: Document | null = null;
    if (isMobileShareViewer) {
      try {
        parentDoc = window.parent.document;
        parentDoc.addEventListener("fullscreenchange", handleFsChange);
        parentDoc.addEventListener("webkitfullscreenchange", handleFsChange);
      } catch {
        parentDoc = null;
      }
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      if (parentDoc) {
        parentDoc.removeEventListener("fullscreenchange", handleFsChange);
        parentDoc.removeEventListener("webkitfullscreenchange", handleFsChange);
      }
    };
  }, [syncFullscreenState, isMobileShareViewer]);
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
  // 保存启动视图：分享只读（readonly=1）时不展示；mobile=1 触控层在第 2 步接入
  const canShowSaveLaunchView =
    !isReadonly &&
    !processingBlocked &&
    Boolean(detail?.canSaveLaunchView) &&
    viewerCapabilities.saveView;

  /* ---- 清除移动状态（窗口失焦/关闭帮助/退出漫游时调用） ---- */
  const clearMovementState = useCallback(() => {
    const emptyInput = cloneEmptyMovementInput();
    setMovementInput(emptyInput);
    setMoveSpeedMultiplier(1);
    viewerHandleRef.current?.setMovementInput?.(emptyInput);
    viewerHandleRef.current?.setMoveSpeedMultiplier?.(1);
  }, []);

  /* ---- 全屏（手机工具菜单：mobile share 对父页面横屏舞台 root 发起真实 Fullscreen API） ---- */
  const handleFullscreen = useCallback(async () => {
    const { element, doc, isParent } = resolveFullscreenTarget(
      isMobileShareViewer,
      viewerContainerRef.current,
    );

    if (!element || !isFullscreenApiSupported(element)) {
      toast.error("当前环境不支持全屏");
      return;
    }

    try {
      const activeElement = getDocumentFullscreenElement(doc);
      if (activeElement === element) {
        await exitDocumentFullscreen(doc);
        await tryUnlockOrientation(isParent);
        return;
      }

      await requestElementFullscreen(element);
      await tryLockLandscape(isParent);
    } catch {
      toast.error("当前环境不支持全屏");
    }
  }, [isMobileShareViewer]);

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

    const currentView = viewerHandleRef.current?.getCurrentView?.();
    if (!currentView) {
      toast.error("当前视角暂不支持保存");
      return;
    }

    setSaveLaunchViewPending(true);
    try {
      const result = await http.put<SaveLaunchViewResult>(
        `/models/${detail.id}/launch-view`,
        currentView,
      );
      const nextView = result.launchView ?? currentView;
      viewerHandleRef.current?.commitSavedLaunchView?.(nextView);
      viewerHandleRef.current?.applyView?.(nextView);
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

  /** 打开手机端帮助：清零移动输入，隐藏触控层 */
  const handleOpenMobileHelp = useCallback(() => {
    clearMovementState();
    setIsHelpOpen(true);
  }, [clearMovementState]);

  /** 关闭手机端帮助 */
  const handleCloseMobileHelp = useCallback(() => {
    clearMovementState();
    setIsHelpOpen(false);
  }, [clearMovementState]);

  /** 手机端切换第一人称 / 枢轴 */
  const handleMobileControlModeChange = useCallback(
    (nextMode: ModelViewerControlMode) => {
      if (nextMode === controlMode) return;
      clearMovementState();
      setControlMode(nextMode);
      viewerHandleRef.current?.setControlMode?.(nextMode);
    },
    [clearMovementState, controlMode],
  );

  /** 手机端重置视角（常驻 chrome） */
  const handleMobileResetView = useCallback(() => {
    clearMovementState();
    viewerHandleRef.current?.resetView?.();
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

      // Escape：关闭帮助 / 退出全屏（mobile share 优先退出父页面全屏）
      if (event.key === "Escape") {
        clearMovementState();
        setIsHelpOpen(false);

        const { element, doc, isParent } = resolveFullscreenTarget(
          isMobileShareViewer,
          viewerContainerRef.current,
        );
        const activeFs = getDocumentFullscreenElement(doc);
        if (element && activeFs === element) {
          exitDocumentFullscreen(doc)
            .then(() => tryUnlockOrientation(isParent))
            .catch(() => {});
          return;
        }

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
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
  }, [clearMovementState, controlMode, handleResetView, isHelpOpen, isMobileShareViewer]);

  /* ---- 关闭帮助时清除移动状态 ---- */
  useEffect(() => {
    if (isHelpOpen) clearMovementState();
  }, [clearMovementState, isHelpOpen]);

  /* ---- 模型切换时重置状态 ---- */
  useEffect(() => {
    hasAppliedMobileDefaultModeRef.current = false;
    clearMovementState();
    setIsHelpOpen(false);
    setControlMode("walk");
  }, [clearMovementState, detail?.id]);

  /* ---- 手机分享 iframe：首次 ready 后默认第一人称 walk（不覆盖用户后续手动切换） ---- */
  useEffect(() => {
    if (!isMobileViewer || !detail || processingBlocked) return;
    if (hasAppliedMobileDefaultModeRef.current) return;

    hasAppliedMobileDefaultModeRef.current = true;
    setControlMode("walk");
    viewerHandleRef.current?.setControlMode?.("walk");
    clearMovementState();
  }, [isMobileViewer, detail, processingBlocked, clearMovementState]);

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
        isHelpOpen={isHelpOpen}
        suppressLoadingOverlay={isMobileShareViewer}
      />

      {/* 帮助面板：mobile=1 使用触屏专用帮助；桌面沿用 ModelViewerHelp */}
      {isMobileViewer ? (
        <MobileLccHelpOverlay
          open={isHelpOpen}
          onClose={handleCloseMobileHelp}
          controlMode={controlMode}
        />
      ) : (
        <ModelViewerHelp
          open={isHelpOpen}
          onClose={() => {
            clearMovementState();
            setIsHelpOpen(false);
          }}
          controlMode={controlMode}
        />
      )}

      {/* 手机分享：常驻 chrome（模式切换 / 真实全屏 / 重置 / 帮助） */}
      {isMobileViewer && !processingBlocked && !isHelpOpen && (
        <MobileLccViewerChrome
          controlMode={controlMode}
          onControlModeChange={handleMobileControlModeChange}
          onToggleFullscreen={handleFullscreen}
          isFullscreen={isViewerFullscreen}
          fullscreenSupported={fullscreenSupported}
          onResetView={handleMobileResetView}
          onOpenHelp={handleOpenMobileHelp}
        />
      )}

      {/* 手机 walk 专属触控层：orbit 下不渲染，避免透明层挡住 OrbitControls */}
      {isMobileViewer &&
        controlMode === "walk" &&
        !isHelpOpen &&
        !processingBlocked && (
          <MobileLccGameControls
            viewerHandleRef={viewerHandleRef}
            onMovementInputChange={setMovementInput}
            disabled={isHelpOpen || processingBlocked}
          />
        )}

      {/* 桌面 / 非手机分享：左下角工具栏（与摇杆位置冲突，mobile 时不展示） */}
      {!isMobileViewer && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20">
          <div className="pointer-events-auto">
            <ModelViewerToolbar
              capabilities={viewerCapabilities}
              onResetView={handleResetView}
              onFitView={handleFitView}
              onToggleFullscreen={handleFullscreen}
              onSaveLaunchView={handleSaveLaunchView}
              showSaveLaunchView={canShowSaveLaunchView}
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
      )}
    </div>
  );
}
