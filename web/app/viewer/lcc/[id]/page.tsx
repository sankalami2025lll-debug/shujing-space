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

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LccViewer } from "@/components/models/lcc-viewer";
import {
  ModelMeasureOverlay,
  type ModelMeasureAxisLine,
  type ModelMeasurePoint,
} from "@/components/models/model-measure-overlay";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import { ModelViewerToolbar } from "@/components/models/model-viewer-toolbar";
import { ModelViewerHelp } from "@/components/models/model-viewer-help";
import { ModelScreenshotDialog } from "@/components/models/model-screenshot-dialog";
import { MobileLccGameControls } from "@/components/models/mobile-lcc-game-controls";
import { MobileLccHelpOverlay } from "@/components/models/mobile-lcc-help-overlay";
import { MobileLccViewerChrome } from "@/components/models/mobile-lcc-viewer-chrome";
import { getModelDetail } from "@/lib/api/models";
import { listModelAnnotations } from "@/lib/api/annotations";
import { getModelViewerKind } from "@/lib/model-viewer-kind";
import { http, ApiError } from "@/lib/http";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { ModelDetail, ModelLaunchView, ModelAnnotation } from "@/lib/types";
import type {
  ModelViewerHandle,
  ModelViewerControlMode,
  ModelViewerMeasureAxis,
  ModelViewerMovementInput,
  ModelViewerPickResult,
  ModelViewerPoint,
  ModelHeightClipOptions,
} from "@/components/models/viewers/types";
import { LCC_VIEWER_CAPABILITIES } from "@/components/models/viewers/types";
import {
  ModelAnnotationLayer,
} from "@/components/models/annotations/model-annotation-layer";
import {
  ModelAnnotationEditor,
  type AnnotationDraft,
} from "@/components/models/annotations/model-annotation-editor";
import {
  readCleanModePref,
  writeCleanModePref,
  annotationCameraSnapshotToLaunchView,
} from "@/components/models/annotations/model-annotation-types";

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

/** 全屏请求后等待 viewport 稳定再判定是否真正沉浸式 */
const EFFECTIVE_FULLSCREEN_DELAY_MS = 300;

/** 沉浸式全屏不可用时的统一提示（微信 / iOS WebView 等） */
const IMMERSIVE_FULLSCREEN_TOAST = "当前浏览器不支持沉浸式全屏，请用系统浏览器打开";

/** viewport 相对 screen 的沉浸式阈值（横屏舞台允许宽高互换） */
const EFFECTIVE_FS_MAX_RATIO = 0.92;
const EFFECTIVE_FS_MIN_RATIO = 0.82;
const LCC_VIEWER_STATUS_MESSAGE_TYPE = "SHUJING_LCC_VIEWER_STATUS";

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

/** 读取全屏判定用的 window（mobile share 用父页面 viewport） */
function getFullscreenViewportWindow(isParent: boolean): Window {
  return isParent ? window.parent : window;
}

/**
 * 检测是否真正沉浸式全屏：viewport 需接近 screen 尺寸。
 * 微信 / WebView 可能出现 fullscreenElement 存在但顶部栏仍占位。
 */
function checkEffectiveFullscreen(isParent: boolean): boolean {
  const win = getFullscreenViewportWindow(isParent);
  const viewportWidth = win.innerWidth;
  const viewportHeight = win.innerHeight;
  const screenWidth = win.screen.width;
  const screenHeight = win.screen.height;

  const maxViewport = Math.max(viewportWidth, viewportHeight);
  const minViewport = Math.min(viewportWidth, viewportHeight);
  const maxScreen = Math.max(screenWidth, screenHeight);
  const minScreen = Math.min(screenWidth, screenHeight);

  return (
    maxViewport >= maxScreen * EFFECTIVE_FS_MAX_RATIO &&
    minViewport >= minScreen * EFFECTIVE_FS_MIN_RATIO
  );
}

/** 指定目标是否处于 DOM 全屏（仅 fullscreenElement 判断） */
function isDomFullscreenActive(ctx: FullscreenTargetContext): boolean {
  if (!ctx.element) return false;
  return getDocumentFullscreenElement(ctx.doc) === ctx.element;
}

/**
 * 是否处于“有效”全屏：DOM 全屏 + mobile share 父页面须通过 viewport 二次确认。
 */
function isEffectiveViewerFullscreen(ctx: FullscreenTargetContext): boolean {
  if (!isDomFullscreenActive(ctx)) return false;
  if (ctx.isParent) {
    return checkEffectiveFullscreen(true);
  }
  return true;
}

/** 退出父页面与 iframe 内可能残留的全屏状态 */
async function exitAllFullscreenDocs(ctx: FullscreenTargetContext): Promise<void> {
  try {
    if (getDocumentFullscreenElement(ctx.doc)) {
      await exitDocumentFullscreen(ctx.doc);
    }
  } catch {
    /* 忽略 */
  }
  if (ctx.isParent) {
    try {
      if (getDocumentFullscreenElement(document)) {
        await exitDocumentFullscreen(document);
      }
    } catch {
      /* 忽略 */
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  const isDetailContext = searchParams.get("context") === "detail";
  const isReadonly = searchParams.get("readonly") === "1";
  const isMobileViewer = searchParams.get("mobile") === "1";
  /** 官网详情页手机竖屏内嵌预览（embed=1，非分享页 mobile=1） */
  const isEmbeddedPreview = searchParams.get("embed") === "1";
  const isMobilePreview = searchParams.get("mobilePreview") === "1";
  const isEmbeddedMobilePreview = isEmbeddedPreview && isMobilePreview;
  /** 手机分享 iframe：外层 model-share-viewer-page 已负责 Loading，内层不再展示避免双层闪烁 */
  const isMobileShareViewer = isMobileViewer && isShareContext;
  /** 手机端标注导览模式：mobile=1 时只做标注点击飞行跳转，不展开内容看板（屏幕小避免遮挡模型）。
   *  桌面端恒为 false，行为不变（飞行后展开内容框）。 */
  const isMobileAnnotationMode = isMobileViewer;
  /** embed iframe 内 html/body 高度链可能为 0，需直接使用 iframe viewport 兜底。 */
  const viewerShellClass = isEmbeddedPreview
    ? "h-[100dvh] min-h-[100vh] w-[100dvw]"
    : "h-screen w-screen";

  /* ---- 模型数据状态 ---- */
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  /* ---- Viewer 状态 ---- */
  // viewerHandleRef：LccViewer 暴露的操作接口
  const viewerHandleRef = useRef<ModelViewerHandle | null>(null);
  // controlMode：观察（orbit）或漫游（walk）模式；详情页竖屏 embed 默认 orbit
  const [controlMode, setControlMode] = useState<ModelViewerControlMode>(() =>
    isEmbeddedMobilePreview ? "orbit" : "walk",
  );
  // movementInput：漫游模式下的移动方向状态
  const [movementInput, setMovementInput] = useState<ModelViewerMovementInput>(EMPTY_MOVEMENT_INPUT);
  // moveSpeedMultiplier：Shift 加速倍率
  const [moveSpeedMultiplier, setMoveSpeedMultiplier] = useState(1);
  // isHelpOpen：帮助面板显隐
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // saveLaunchViewPending：保存启动视图 loading 态
  const [saveLaunchViewPending, setSaveLaunchViewPending] = useState(false);
  // 拍照对话框：显隐 / 保存中态 / 默认文件名（仅本地保存，不上传 OSS、不写库）
  const [screenshotDialogOpen, setScreenshotDialogOpen] = useState(false);
  const [screenshotPending, setScreenshotPending] = useState(false);
  const [screenshotDefaultName, setScreenshotDefaultName] = useState("");
  // 测量模式：仅桌面工具栏触发，手机分享页不渲染入口
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isMeasurePanelOpen, setIsMeasurePanelOpen] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<ModelMeasurePoint[]>([]);
  const [measurePreviewPoint, setMeasurePreviewPoint] = useState<ModelMeasurePoint | null>(null);
  const [measureAxisLines, setMeasureAxisLines] = useState<ModelMeasureAxisLine[]>([]);
  const [, setMeasureDistance] = useState<number | null>(null);
  const measurePointsRef = useRef<ModelMeasurePoint[]>([]);
  const measurePreviewSeqRef = useRef(0);
  const lastMeasurePreviewAtRef = useRef(0);
  /** mobile=1 首次 ready 后是否已应用默认 walk（避免用户切 orbit 后被 effect 打回） */
  const hasAppliedMobileDefaultModeRef = useRef(false);
  /** 详情 embed 竖屏预览：首次 ready 后默认 orbit */
  const hasAppliedEmbeddedOrbitRef = useRef(false);
  /** 手机工具菜单：是否处于真正沉浸式全屏（非仅 fullscreenElement） */
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  /** 手机工具菜单：当前 iframe 环境是否支持 Fullscreen API */
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  /** 全屏有效性延迟复核定时器（避免 fullscreenchange 过早误判） */
  const fullscreenVerifyTimerRef = useRef<number | null>(null);

  /* ---- 模型空间热点标注 V1 状态 ---- */
  // annotations：当前模型标注列表（owner 可见 active+hidden，其他人只见 active）
  const [annotations, setAnnotations] = useState<ModelAnnotation[]>([]);
  // annotationsLoading：标注列表拉取中
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  // activeAnnotationId：当前展开内容框的标注 id（点击标题跳视角后展开；收起后置 null）
  const [activeAnnotationId, setActiveAnnotationId] = useState<number | null>(null);
  // flyingAnnotationId：正在飞行到该标注视角的 id；飞行期间保持标题态、不展开内容框，避免卡片随飞行飘动
  const [flyingAnnotationId, setFlyingAnnotationId] = useState<number | null>(null);
  // cleanMode：纯净模式，隐藏所有标注 overlay（仅查看者 UI 偏好，写 localStorage）
  const [cleanMode, setCleanMode] = useState<boolean>(() => readCleanModePref());
  // manageMode：owner 标注管理模式（临时关闭纯净模式以显示标注层）
  const [manageMode, setManageMode] = useState(false);
  // 进入管理前保存的纯净模式状态，退出管理时恢复
  const prevCleanModeRef = useRef<boolean>(cleanMode);
  // picking：选点模式（点击模型表面拾取 anchor）
  const [picking, setPicking] = useState(false);
  // editorDraft：新建态草稿（含拾取到的 anchorPosition + cameraSnapshot）
  const [editorDraft, setEditorDraft] = useState<AnnotationDraft | null>(null);
  // editingAnnotation：编辑态目标标注
  const [editingAnnotation, setEditingAnnotation] = useState<ModelAnnotation | null>(null);

  useEffect(() => {
    measurePointsRef.current = measurePoints;
  }, [measurePoints]);

  /* ---- 自动聚焦 viewer 容器（确保 iframe / 独立页面获得键盘焦点，WASD 可用） ---- */
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  /** 清理无效全屏：退出 DOM 全屏并复位按钮状态 */
  const cleanupIneffectiveFullscreen = useCallback(
    async (ctx: FullscreenTargetContext, showToast: boolean) => {
      await exitAllFullscreenDocs(ctx);
      await tryUnlockOrientation(ctx.isParent);
      setIsViewerFullscreen(false);
      if (showToast) {
        toast.error(IMMERSIVE_FULLSCREEN_TOAST);
      }
    },
    [],
  );

  /** 同步 viewer 全屏状态：mobile share 须 DOM 全屏 + viewport 有效，避免微信误判 */
  const syncFullscreenState = useCallback(() => {
    const ctx = resolveFullscreenTarget(isMobileShareViewer, viewerContainerRef.current);

    if (!ctx.element || !isDomFullscreenActive(ctx)) {
      setIsViewerFullscreen(false);
      return;
    }

    if (ctx.isParent) {
      if (isEffectiveViewerFullscreen(ctx)) {
        setIsViewerFullscreen(true);
        return;
      }

      // DOM 全屏已触发但 viewport 未扩展：先显示「全屏」，延迟复核
      setIsViewerFullscreen(false);

      if (fullscreenVerifyTimerRef.current !== null) {
        window.clearTimeout(fullscreenVerifyTimerRef.current);
      }
      fullscreenVerifyTimerRef.current = window.setTimeout(() => {
        fullscreenVerifyTimerRef.current = null;
        const freshCtx = resolveFullscreenTarget(isMobileShareViewer, viewerContainerRef.current);
        if (!isDomFullscreenActive(freshCtx)) {
          setIsViewerFullscreen(false);
          return;
        }
        if (isEffectiveViewerFullscreen(freshCtx)) {
          setIsViewerFullscreen(true);
          return;
        }
        // 被动检测到假全屏：静默退出，不 toast（仅用户点击失败时提示）
        void cleanupIneffectiveFullscreen(freshCtx, false);
      }, EFFECTIVE_FULLSCREEN_DELAY_MS);
      return;
    }

    setIsViewerFullscreen(true);
  }, [cleanupIneffectiveFullscreen, isMobileShareViewer]);

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
      if (fullscreenVerifyTimerRef.current !== null) {
        window.clearTimeout(fullscreenVerifyTimerRef.current);
        fullscreenVerifyTimerRef.current = null;
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

  useEffect(() => {
    if (!idValid || window.parent === window) return;

    let terminalMessageCount = 0;
    let lastSignature = "";

    const sendViewerStatus = () => {
      const childRoot = viewerContainerRef.current?.querySelector<HTMLElement>(
        "[data-lcc-viewer-status]",
      );
      const viewerStatus =
        childRoot?.getAttribute("data-lcc-viewer-status") ??
        (detailError ? "error" : detailLoading ? "loading" : null);

      if (!viewerStatus) return false;

      const firstFrame = childRoot?.getAttribute("data-lcc-first-frame") === "true";
      const loaded = childRoot?.getAttribute("data-lcc-loaded") === "true";
      const message = {
        type: LCC_VIEWER_STATUS_MESSAGE_TYPE,
        modelId: numericId,
        viewerType: "lcc",
        context: isDetailContext ? "detail" : isShareContext ? "share" : "standalone",
        viewerStatus,
        loaded,
        firstFrame,
      };
      const signature = JSON.stringify(message);
      const isTerminalStatus = viewerStatus === "loaded" || viewerStatus === "error" || loaded || firstFrame;

      if (signature !== lastSignature || isTerminalStatus) {
        window.parent.postMessage(message, window.location.origin);
        lastSignature = signature;
      }

      if (isTerminalStatus) {
        terminalMessageCount += 1;
        return terminalMessageCount >= 8;
      }

      terminalMessageCount = 0;
      return false;
    };

    const timer = window.setInterval(() => {
      if (sendViewerStatus()) {
        window.clearInterval(timer);
      }
    }, 250);
    sendViewerStatus();

    return () => window.clearInterval(timer);
  }, [detailError, detailLoading, idValid, isDetailContext, isShareContext, numericId]);

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
  // owner 可管理标注：登录所有者 + 非只读分享 + viewer 支持 pick/project/getCurrentView
  const canManageAnnotations =
    !isReadonly && Boolean(detail?.canSaveLaunchView);

  /* ---- 清除移动状态（窗口失焦/关闭帮助/退出漫游时调用） ---- */
  const clearMovementState = useCallback(() => {
    const emptyInput = cloneEmptyMovementInput();
    setMovementInput(emptyInput);
    setMoveSpeedMultiplier(1);
    viewerHandleRef.current?.setMovementInput?.(emptyInput);
    viewerHandleRef.current?.setMoveSpeedMultiplier?.(1);
  }, []);

  /* ---- 全屏（mobile share：父页面横屏舞台 root + 沉浸式有效性二次确认） ---- */
  const handleFullscreen = useCallback(async () => {
    const ctx = resolveFullscreenTarget(isMobileShareViewer, viewerContainerRef.current);
    const { element, isParent } = ctx;

    if (!element || !isFullscreenApiSupported(element)) {
      toast.error("当前环境不支持全屏");
      return;
    }

    try {
      if (isViewerFullscreen || isDomFullscreenActive(ctx)) {
        if (isViewerFullscreen) {
          await exitAllFullscreenDocs(ctx);
          await tryUnlockOrientation(isParent);
          setIsViewerFullscreen(false);
        } else if (isDomFullscreenActive(ctx)) {
          // DOM 假全屏残留：静默清理，按钮保持「全屏」
          await cleanupIneffectiveFullscreen(ctx, false);
        }
        return;
      }

      await requestElementFullscreen(element);
      await tryLockLandscape(isParent);
      await delay(EFFECTIVE_FULLSCREEN_DELAY_MS);

      const freshCtx = resolveFullscreenTarget(isMobileShareViewer, viewerContainerRef.current);
      if (!isDomFullscreenActive(freshCtx)) {
        setIsViewerFullscreen(false);
        toast.error("当前环境不支持全屏");
        return;
      }

      if (freshCtx.isParent && !checkEffectiveFullscreen(true)) {
        await cleanupIneffectiveFullscreen(freshCtx, true);
        return;
      }

      setIsViewerFullscreen(true);
    } catch {
      setIsViewerFullscreen(false);
      toast.error(IMMERSIVE_FULLSCREEN_TOAST);
    }
  }, [cleanupIneffectiveFullscreen, isMobileShareViewer, isViewerFullscreen]);

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

  /* ---- 点云显示模式切换 ---- */
  const handleTogglePointsDisplayMode = useCallback(() => {
    const ok = viewerHandleRef.current?.togglePointsDisplayMode?.();

    if (!ok) {
      console.warn("[LCC Viewer] togglePointsDisplayMode is not supported by current model.");
    }

    return Boolean(ok);
  }, []);

  /* ---- 环境显示开关 ---- */
  const handleSetEnvironmentEnabled = useCallback((enabled: boolean) => {
    const viewerHandle = viewerHandleRef.current;

    if (enabled && !viewerHandle?.hasEnvironment?.()) {
      console.warn("[LCC Viewer] environment is not supported by current model.");
      return false;
    }

    const ok = viewerHandle?.setEnvironmentEnabled?.(enabled) ?? false;

    if (!ok && enabled) {
      console.warn("[LCC Viewer] useEnvironment is not supported by current model.");
    }

    return Boolean(ok);
  }, []);

  /* ---- 高度剖切 ---- */
  const handleSetHeightClipPlane = useCallback(
    (options: ModelHeightClipOptions) => {
      if (processingBlocked) {
        toast.warning("当前模型不支持高度剖切");
        return false;
      }

      const ok = viewerHandleRef.current?.setHeightClipPlane?.(options) ?? false;

      if (!ok) {
        console.warn("[LCC Viewer] setClipBox is not supported by current model.");
        toast.warning("当前模型不支持高度剖切");
      }

      return Boolean(ok);
    },
    [processingBlocked],
  );

  const handleClearHeightClipPlane = useCallback(() => {
    if (processingBlocked) {
      toast.warning("当前模型不支持高度剖切");
      return false;
    }

    const ok = viewerHandleRef.current?.clearHeightClipPlane?.() ?? false;

    if (!ok) {
      console.warn("[LCC Viewer] clear setClipBox is not supported by current model.");
      toast.warning("高度剖切重置暂不可用");
    }

    return Boolean(ok);
  }, [processingBlocked]);

  /* ---- 测量模式 ---- */
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
    const measureArea = viewerContainerRef.current;
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
    if (processingBlocked) {
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
  }, [clearMovementState, processingBlocked]);

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
      if (!isMeasuring || processingBlocked) {
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
        processingBlocked ||
        isHelpOpen ||
        isMobileViewer ||
        isEmbeddedMobilePreview
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
      isEmbeddedMobilePreview,
      isHelpOpen,
      isMeasuring,
      isMobileViewer,
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

  /* ---- 拍照：生成默认文件名并打开保存对话框 ---- */
  const handleOpenScreenshotDialog = useCallback(() => {
    // 默认文件名：shujing-model-{modelId}-{yyyyMMdd-HHmmss}.png
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    setScreenshotDefaultName(`shujing-model-${numericId}-${ts}.png`);
    setScreenshotDialogOpen(true);
  }, [numericId]);

  /** 清理文件名非法字符并确保 .png 后缀；空文件名回退默认名 */
  const sanitizeScreenshotFileName = useCallback(
    (raw: string, fallback: string) => {
      const cleaned = raw.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
      const base = cleaned || fallback;
      return /\.png$/i.test(base) ? base : `${base}.png`;
    },
    [],
  );

  /** 将 Blob 保存到本地：优先 showSaveFilePicker（Chrome/Edge），降级 a.download（Safari/Firefox） */
  const saveScreenshotBlob = useCallback(
    async (blob: Blob, fileName: string) => {
      const w = window as unknown as {
        showSaveFilePicker?: (opts: {
          suggestedName?: string;
          types?: Array<{ description?: string; accept: Record<string, string[]> }>;
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob | BufferSource | string) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      };
      if (typeof w.showSaveFilePicker === "function") {
        const handle = await w.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "PNG 图片", accept: { "image/png": [".png"] } }],
        });
        const writable = await handle.createWritable();
        try {
          await writable.write(blob);
        } finally {
          await writable.close();
        }
        return;
      }
      // 降级：ObjectURL + a.click 触发浏览器下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 释放 ObjectURL（下一轮微任务，确保下载已触发）
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    [],
  );

  /** 确认保存：调用 viewerHandle.captureScreenshot 截图并保存到本地 */
  const handleConfirmScreenshot = useCallback(
    async (rawFileName: string) => {
      const handle = viewerHandleRef.current;
      if (!handle?.captureScreenshot) {
        toast.error("当前模型暂不支持拍照");
        setScreenshotDialogOpen(false);
        return;
      }
      setScreenshotPending(true);
      try {
        const blob = await handle.captureScreenshot({
          mimeType: "image/png",
          clean: true,
        });
        if (!blob) {
          toast.error("截图失败，请稍后重试");
          return;
        }
        const fileName = sanitizeScreenshotFileName(
          rawFileName,
          screenshotDefaultName,
        );
        await saveScreenshotBlob(blob, fileName);
        toast.success("图片已保存");
        setScreenshotDialogOpen(false);
      } catch (error) {
        // 用户取消系统保存位置选择（AbortError）不算错误
        if (error instanceof DOMException && error.name === "AbortError") {
          toast.info("已取消保存");
        } else {
          toast.error("图片保存失败，请重试");
        }
      } finally {
        setScreenshotPending(false);
      }
    },
    [sanitizeScreenshotFileName, saveScreenshotBlob, screenshotDefaultName],
  );

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

  /* ---- 模型空间热点标注 V1 ---- */
  /** 切换纯净模式：写 localStorage 持久化偏好 */
  const handleToggleCleanMode = useCallback(() => {
    setCleanMode((current) => {
      const next = !current;
      writeCleanModePref(next);
      // 开启纯净模式时清空已展开内容框
      if (next) setActiveAnnotationId(null);
      return next;
    });
  }, []);

  /** 切换标注管理模式：进入时临时关闭纯净模式，退出时恢复进入前状态 */
  const handleToggleManageMode = useCallback(() => {
    setManageMode((current) => {
      const next = !current;
      if (next) {
        // 进入管理：记住当前纯净模式偏好，临时显示标注层
        prevCleanModeRef.current = cleanMode;
        setCleanMode(false);
        setActiveAnnotationId(null);
      } else {
        // 退出管理：恢复进入前的纯净模式状态，关闭编辑/选点
        setCleanMode(prevCleanModeRef.current);
        setPicking(false);
        setEditorDraft(null);
        setEditingAnnotation(null);
      }
      return next;
    });
  }, [cleanMode]);

  /** 新增标注：进入选点模式 */
  const handleAddAnnotation = useCallback(() => {
    setEditingAnnotation(null);
    setEditorDraft(null);
    setActiveAnnotationId(null);
    setPicking(true);
  }, []);

  /** 取消选点 */
  const handleCancelPick = useCallback(() => {
    setPicking(false);
  }, []);

  /** 选点模式下点击模型表面：拾取 anchor + 当前视角，打开编辑器新建态 */
  const handleAnnotationPick = useCallback(
    async (clientX: number, clientY: number, nativeEvent: MouseEvent | PointerEvent) => {
      const pickResult = await viewerHandleRef.current?.pickPoint?.(clientX, clientY, nativeEvent);
      if (!pickResult) {
        toast.warning("未拾取到模型点，请点击模型表面");
        return;
      }
      const view = viewerHandleRef.current?.getCurrentView?.();
      if (!view) {
        toast.error("当前视角暂不支持保存");
        return;
      }
      const wp = pickResult.lockedWorldPoint;
      setEditorDraft({
        anchorPosition: [wp.x, wp.y, wp.z],
        anchorNormal: null,
        cameraSnapshot: view,
      });
      setPicking(false);
    },
    [],
  );

  /** owner 点击已有点/标题进入编辑 */
  const handleEditAnnotation = useCallback((annotation: ModelAnnotation) => {
    setEditorDraft(null);
    setEditingAnnotation(annotation);
    setActiveAnnotationId(null);
  }, []);

  /** 游客点击标题/标注点：快速漫游到保存视角后再展开内容框。
   *  - 飞行期间保持标题态（activeAnnotationId 置 null），避免内容框随飞行飘动。
   *  - 优先调用 viewerHandle.flyToView；不存在或异常时 fallback 到 applyView 闪现。
   *  - 飞行完成（或被用户操作取消）后再展开内容框。
   *  - 连续点击不同标注时，用 token 守卫：旧飞行的 finally 不再覆盖新点击的 flying/active 状态，
   *    避免旧飞行被取消后误把第一个标注展开、或把 flyingAnnotationId 提前清空。 */
  const selectAnnotationTokenRef = useRef(0);
  const handleSelectAnnotationTitle = useCallback(
    async (annotation: ModelAnnotation) => {
      const myToken = ++selectAnnotationTokenRef.current;
      if (process.env.NODE_ENV === "development") {
        console.log("[annotation] select start", annotation.id, myToken);
      }
      // 手机端标注导览模式：只飞行到保存视角，不展开内容看板（屏幕小避免遮挡模型）
      const shouldOpenCardAfterFly = !isMobileAnnotationMode;
      // annotation.cameraSnapshot 为扁平结构，applyView/flyToView 需要 ModelLaunchView，转换后再传
      const view = annotationCameraSnapshotToLaunchView(annotation.cameraSnapshot);
      const handle = viewerHandleRef.current;
      setFlyingAnnotationId(annotation.id);
      // 飞行期间不展开内容框
      setActiveAnnotationId(null);
      try {
        if (view && handle?.flyToView) {
          await handle.flyToView(view, { duration: 550 });
        } else if (view) {
          handle?.applyView?.(view);
        }
      } catch {
        // 飞行异常：兜底闪现到目标视角
        if (view) handle?.applyView?.(view);
      } finally {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[annotation] fly done",
            annotation.id,
            myToken,
            selectAnnotationTokenRef.current,
          );
        }
        // 仅当本次仍是最新一次点击时才落地展开，避免被更新的点击覆盖
        if (selectAnnotationTokenRef.current === myToken) {
          setFlyingAnnotationId(null);
          if (shouldOpenCardAfterFly) {
            // 桌面端：先让 AnnotationLayer 从 isFlying=false 恢复一帧投影，再打开内容框。
            // 否则 projected 仍为空时会被 layer 的“不可见自动收起”逻辑立即关闭。
            window.requestAnimationFrame(() => {
              if (selectAnnotationTokenRef.current === myToken) {
                if (process.env.NODE_ENV === "development") {
                  console.log("[annotation] open card", annotation.id);
                }
                setActiveAnnotationId(annotation.id);
              }
            });
          } else {
            // 手机端：飞行结束后不展开内容看板，仅恢复标题/点显示
            setActiveAnnotationId(null);
          }
        }
      }
    },
    [isMobileAnnotationMode],
  );

  /** 收起内容框 */
  const handleCollapseAnnotation = useCallback(() => {
    setActiveAnnotationId(null);
  }, []);

  /** 编辑器保存成功：合并到列表并关闭编辑器 */
  const handleAnnotationSaved = useCallback((annotation: ModelAnnotation) => {
    setAnnotations((current) => {
      const exists = current.some((item) => item.id === annotation.id);
      return exists
        ? current.map((item) => (item.id === annotation.id ? annotation : item))
        : [...current, annotation];
    });
    setEditorDraft(null);
    setEditingAnnotation(null);
  }, []);

  /** 媒体（图片）上传/删除成功：合并到列表并刷新编辑态标注，但保持编辑器打开。
   *  与 handleAnnotationSaved 的区别：不关闭编辑器，避免上传成功后编辑器被卸载、
   *  上传组件 finally 中的状态清理落到已卸载实例而无效（导致按钮卡在「上传中 100%」）。 */
  const handleAnnotationMediaUpdated = useCallback((annotation: ModelAnnotation) => {
    setAnnotations((current) =>
      current.map((item) => (item.id === annotation.id ? annotation : item)),
    );
    setEditingAnnotation(annotation);
  }, []);

  /** 编辑器删除成功：从列表移除 */
  const handleAnnotationDeleted = useCallback((annotationId: number) => {
    setAnnotations((current) => current.filter((item) => item.id !== annotationId));
    setActiveAnnotationId((current) => (current === annotationId ? null : current));
    setEditingAnnotation(null);
    setEditorDraft(null);
  }, []);

  /** 关闭编辑器 */
  const handleCloseEditor = useCallback(() => {
    setEditorDraft(null);
    setEditingAnnotation(null);
  }, []);

  /** 编辑器「重新保存当前视角」：读取 viewer 当前视角 */
  const handleCaptureCurrentView = useCallback((): ModelLaunchView | null => {
    return viewerHandleRef.current?.getCurrentView?.() ?? null;
  }, []);

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
        if (isViewerFullscreen && element) {
          exitAllFullscreenDocs({ element, doc, isParent })
            .then(() => tryUnlockOrientation(isParent))
            .then(() => setIsViewerFullscreen(false))
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
  }, [
    clearMovementState,
    controlMode,
    handleExitMeasure,
    handleFinishMeasure,
    handleResetView,
    isHelpOpen,
    isMeasurePanelOpen,
    isMeasuring,
    isMobileShareViewer,
    isViewerFullscreen,
  ]);

  /* ---- 关闭帮助时清除移动状态 ---- */
  useEffect(() => {
    if (isHelpOpen) clearMovementState();
  }, [clearMovementState, isHelpOpen]);

  /* ---- 模型切换时重置状态 ---- */
  useEffect(() => {
    hasAppliedMobileDefaultModeRef.current = false;
    hasAppliedEmbeddedOrbitRef.current = false;
    clearMovementState();
    setIsHelpOpen(false);
    setIsMeasuring(false);
    setIsMeasurePanelOpen(false);
    measurePointsRef.current = [];
    setMeasurePoints([]);
    setMeasurePreviewPoint(null);
    setMeasureAxisLines([]);
    setMeasureDistance(null);
    setControlMode(isEmbeddedMobilePreview ? "orbit" : "walk");
  }, [clearMovementState, detail?.id, isEmbeddedMobilePreview]);

  /* ---- 拉取标注列表：模型详情就绪后请求 GET /api/models/:id/annotations ---- */
  useEffect(() => {
    if (!idValid || !detail) return;
    let active = true;
    setAnnotationsLoading(true);
    listModelAnnotations(numericId)
      .then((list) => {
        if (!active) return;
        setAnnotations(list);
      })
      .catch((error) => {
        if (!active) return;
        // 标注加载失败不阻断模型查看，仅静默 + 控制台告警
        console.warn("[Annotations] load failed:", error);
        setAnnotations([]);
      })
      .finally(() => {
        if (active) setAnnotationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [idValid, numericId, detail]);

  /* ---- 详情页 embed 竖屏预览：首次 ready 后默认枢轴 orbit ---- */
  useEffect(() => {
    if (!isEmbeddedMobilePreview || !detail || processingBlocked) return;
    if (hasAppliedEmbeddedOrbitRef.current) return;

    hasAppliedEmbeddedOrbitRef.current = true;
    setControlMode("orbit");
    viewerHandleRef.current?.setControlMode?.("orbit");
    clearMovementState();
  }, [isEmbeddedMobilePreview, detail, processingBlocked, clearMovementState]);

  /* ---- 手机分享 iframe：首次 ready 后默认第一人称 walk（不覆盖用户后续手动切换） ---- */
  useEffect(() => {
    if (!isMobileViewer || isEmbeddedPreview || !detail || processingBlocked) return;
    if (hasAppliedMobileDefaultModeRef.current) return;

    hasAppliedMobileDefaultModeRef.current = true;
    setControlMode("walk");
    viewerHandleRef.current?.setControlMode?.("walk");
    clearMovementState();
  }, [isMobileViewer, isEmbeddedPreview, detail, processingBlocked, clearMovementState]);

  /* ---- 渲染：Loading ---- */
  if (detailLoading) {
    return (
      <div className={`relative overflow-hidden bg-[#0a0a0a] ${viewerShellClass}`}>
        <ModelLoadingOverlay visible showText={false} />
      </div>
    );
  }

  /* ---- 渲染：Error ---- */
  if (detailError || !detail) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 text-gray-500 bg-[#0a0a0a] ${viewerShellClass}`}
      >
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
      className={`${viewerShellClass} relative bg-[#0d0d0d] overflow-hidden outline-none`}
      data-lcc-viewer-context={isDetailContext ? "detail" : isShareContext ? "share" : "standalone"}
      data-lcc-viewer-embed={isEmbeddedPreview ? "true" : "false"}
    >
      {/* LCC Viewer 全屏渲染 */}
      <LccViewer
        key={`${detail.id}-${detail.viewerUrl || ""}-${detail.fileFormat || "none"}`}
        ref={viewerHandleRef}
        modelId={detail.id}
        modelUrl={detail.viewerUrl}
        viewerUrl={detail.viewerUrl}
        fileFormat={detail.fileFormat}
        viewerType={detail.viewerType}
        viewerContext={isDetailContext ? "detail" : isShareContext ? "share" : "standalone"}
        isReadonlyViewer={isReadonly}
        isMobileViewer={isMobileViewer}
        launchView={detail.launchView}
        defaultCameraJson={detail.defaultCameraJson}
        processingBlocked={processingBlocked}
        controlMode={controlMode}
        isHelpOpen={isHelpOpen}
        suppressLoadingOverlay={isMobileShareViewer}
      />

      <ModelMeasureOverlay
        active={
          !isMobileViewer &&
          !isEmbeddedMobilePreview &&
          (isMeasurePanelOpen || isMeasuring || measurePoints.length > 0) &&
          !processingBlocked &&
          !isHelpOpen
        }
        picking={
          !isMobileViewer &&
          !isEmbeddedMobilePreview &&
          isMeasuring &&
          !processingBlocked &&
          !isHelpOpen
        }
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

      {/* 模型空间热点标注层：embed 竖屏预览不渲染；纯净模式且非管理态隐藏 */}
      {!isEmbeddedMobilePreview && (
        <ModelAnnotationLayer
          annotations={annotations}
          visible={(!cleanMode || manageMode) && !annotationsLoading}
          containerRef={viewerContainerRef}
          viewerHandleRef={viewerHandleRef}
          onSelectTitle={handleSelectAnnotationTitle}
          onCollapse={handleCollapseAnnotation}
          expandedId={activeAnnotationId}
          flyingId={flyingAnnotationId}
          isFlying={flyingAnnotationId !== null}
          canManage={canManageAnnotations}
          manageMode={manageMode}
          onAddAnnotation={handleAddAnnotation}
          onEditAnnotation={handleEditAnnotation}
          picking={picking}
          onPick={handleAnnotationPick}
          onCancelPick={handleCancelPick}
          disableCards={isMobileAnnotationMode}
        />
      )}

      {/* 标注编辑器：owner 新建/编辑态 */}
      {canManageAnnotations && (editorDraft || editingAnnotation) && (
        <ModelAnnotationEditor
          modelId={numericId}
          draft={editorDraft}
          annotation={editingAnnotation}
          onCaptureCurrentView={handleCaptureCurrentView}
          onSaved={handleAnnotationSaved}
          onMediaUpdated={handleAnnotationMediaUpdated}
          onDeleted={handleAnnotationDeleted}
          onClose={handleCloseEditor}
        />
      )}

      {/* 帮助面板：分享 mobile=1 用触屏帮助；embed 预览不展示工具栏/帮助 */}
      {!isEmbeddedMobilePreview &&
        (isMobileViewer ? (
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
        ))}

      {/* 手机分享：常驻 chrome（模式切换 / 真实全屏 / 重置 / 帮助） */}
      {isMobileViewer && !isEmbeddedPreview && !processingBlocked && !isHelpOpen && (
        <MobileLccViewerChrome
          controlMode={controlMode}
          onControlModeChange={handleMobileControlModeChange}
          onToggleFullscreen={handleFullscreen}
          isFullscreen={isViewerFullscreen}
          fullscreenSupported={fullscreenSupported}
          onResetView={handleMobileResetView}
          onOpenHelp={handleOpenMobileHelp}
          cleanMode={cleanMode}
          onToggleCleanMode={handleToggleCleanMode}
        />
      )}

      {/* 手机 walk 专属触控层：仅分享页 mobile=1 */}
      {isMobileViewer &&
        !isEmbeddedPreview &&
        controlMode === "walk" &&
        !isHelpOpen &&
        !processingBlocked && (
          <MobileLccGameControls
            viewerHandleRef={viewerHandleRef}
            onMovementInputChange={setMovementInput}
            disabled={isHelpOpen || processingBlocked}
          />
        )}

      {/* 桌面 / 独立页工具栏；embed 竖屏预览隐藏 */}
      {!isMobileViewer && !isEmbeddedMobilePreview && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20">
          <div className="pointer-events-auto">
            <ModelViewerToolbar
              capabilities={viewerCapabilities}
              onResetView={handleResetView}
              onFitView={handleFitView}
              onTogglePointsDisplayMode={handleTogglePointsDisplayMode}
              canTogglePointsDisplayMode={!processingBlocked}
              onSetEnvironmentEnabled={handleSetEnvironmentEnabled}
              canUseEnvironment={!processingBlocked}
              onToggleMeasure={handleToggleMeasure}
              canMeasure={!processingBlocked}
              isMeasuring={isMeasurePanelOpen || isMeasuring}
              onSetHeightClipPlane={handleSetHeightClipPlane}
              onClearHeightClipPlane={handleClearHeightClipPlane}
              canUseHeightClipPlane={!processingBlocked}
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
              cleanMode={cleanMode}
              onToggleCleanMode={handleToggleCleanMode}
              manageMode={manageMode}
              onToggleManageMode={handleToggleManageMode}
              canManageAnnotations={canManageAnnotations}
              onTakeScreenshot={handleOpenScreenshotDialog}
            />
          </div>
        </div>
      )}

      {/* 拍照保存对话框：仅本地保存当前视角 PNG，不上传 OSS、不写库 */}
      <ModelScreenshotDialog
        open={screenshotDialogOpen}
        defaultFileName={screenshotDefaultName}
        pending={screenshotPending}
        onCancel={() => setScreenshotDialogOpen(false)}
        onConfirm={handleConfirmScreenshot}
      />
    </div>
  );
}
