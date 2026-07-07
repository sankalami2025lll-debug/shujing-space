"use client";

import type { ModelViewerKind } from "@/lib/model-viewer-kind";
import type { LaunchViewSaveResult, ModelDetail, ModelLaunchView } from "@/lib/types";

export type ModelViewerControlMode = "orbit" | "walk";

/** 转头增量来源：mobile 使用略低于桌面的灵敏度 */
export type ModelViewerLookDeltaSource = "desktop" | "mobile";

export type ModelViewerLookDelta = {
  x: number;
  y: number;
  source?: ModelViewerLookDeltaSource;
};

/** 沿视线前后移动来源：wheel 为 ±1 步进；mobile 为捏合像素间距变化 */
export type ModelViewerMoveAlongViewSource = "mobile" | "wheel";

export type ModelViewerMoveAlongViewDelta = {
  amount: number;
  source?: ModelViewerMoveAlongViewSource;
};

/** 第一人称平移来源 */
export type ModelViewerPanDeltaSource = "mobile" | "mouse";

export type ModelViewerPanByDelta = {
  x: number;
  y: number;
  source?: ModelViewerPanDeltaSource;
};

export type ModelViewerPointCoordinateSpace = "sdk" | "render";

export type ModelViewerPoint = {
  x: number;
  y: number;
  z: number;
  /** 测量点所在坐标空间。render 表示已经转换到当前 Three.js 渲染世界，可稳定重投影。 */
  coordinateSpace?: ModelViewerPointCoordinateSpace;
};

export type ModelViewerProjectedPoint = {
  clientX: number;
  clientY: number;
  visible: boolean;
};

export type ModelViewerPickResult = {
  /** SDK raycast 原始命中点，保留给后续做捕捉校验/诊断，不直接用于屏幕绘制。 */
  rawHitPoint: ModelViewerPoint;
  /** 最终锁定在当前 Three.js 渲染世界中的测量点，用于距离计算和相机重投影。 */
  lockedWorldPoint: ModelViewerPoint;
  /** 约束测量投影点。自由测量阶段为空，水平/垂直约束后再写入。 */
  projectedPoint?: ModelViewerPoint | null;
};

export type ModelViewerMeasureAxis = {
  id: "model-x" | "model-y" | "model-z";
  /** 模型基准坐标轴方向，已转换为 render 世界坐标。产品语义：X/Y 为平面，Z 为垂直。 */
  direction: ModelViewerPoint;
};

export type ModelHeightClipOptions = {
  enabled: boolean;
  horizontalPercent: number;
  verticalPercent: number;
};

export type ModelViewerHandle = {
  resetView?: () => void;
  fitView?: () => void;
  enterFullscreen?: () => void;
  takeScreenshot?: () => Promise<string | void> | string | void;
  togglePointsDisplayMode?: () => boolean;
  hasEnvironment?: () => boolean;
  setEnvironmentEnabled?: (enabled: boolean) => boolean;
  pickPoint?: (
    clientX: number,
    clientY: number,
    nativeEvent?: MouseEvent | PointerEvent,
  ) => Promise<ModelViewerPickResult | null>;
  /** 将 SDK 命中的模型空间点投影到当前浏览器视口坐标，用于测量点/线随相机实时绑定模型。 */
  projectPoint?: (point: ModelViewerPoint) => ModelViewerProjectedPoint | null;
  /** 测量辅助参考轴：固定使用模型基准三轴，避免随相机视图变化。 */
  getMeasurePlaneAxes?: () => ModelViewerMeasureAxis[];
  setHeightClipPlane?: (options: ModelHeightClipOptions) => boolean;
  clearHeightClipPlane?: () => boolean;
  getViewerBounds?: () => unknown;
  getCurrentView?: () => ModelLaunchView | null;
  /** 保存启动视图：含 orbit/walk 区分、near/far 兜底与有效性校验 */
  getLaunchViewForSave?: () => LaunchViewSaveResult;
  /** 保存成功后仅更新内存默认视角，不重新应用相机 */
  commitSavedLaunchView?: (view: ModelLaunchView) => void;
  applyView?: (view: ModelLaunchView) => boolean;
  moveForward?: (delta?: number) => void;
  moveBackward?: (delta?: number) => void;
  moveLeft?: (delta?: number) => void;
  moveRight?: (delta?: number) => void;
  moveUp?: (delta?: number) => void;
  moveDown?: (delta?: number) => void;
  setMoveSpeedMultiplier?: (multiplier: number) => void;
  setMovementInput?: (input: ModelViewerMovementInput) => void;
  /** 第一人称 walk：按屏幕像素增量转头（复用 yaw/pitch，不改变相机位置） */
  lookByDelta?: (delta: ModelViewerLookDelta) => void;
  /** 第一人称 walk：沿视线前后移动（桌面滚轮 ±1 / 手机捏合像素间距变化） */
  moveAlongView?: (delta: ModelViewerMoveAlongViewDelta) => void;
  /** 第一人称 walk：按屏幕像素增量平移相机（不改变 yaw/pitch） */
  panByDelta?: (delta: ModelViewerPanByDelta) => void;
  /** 切换观察（OrbitControls 轨道）/ 漫游（FPS yaw-pitch + WASD）模式 */
  setControlMode?: (mode: ModelViewerControlMode) => void;
  getControlMode?: () => ModelViewerControlMode;
};

export type ModelViewerMovementInput = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

export type ModelViewerCapabilities = {
  resetView: boolean;
  fitView: boolean;
  zoom: boolean;
  pan: boolean;
  orbit: boolean;
  walk: boolean;
  measure: boolean;
  annotation: boolean;
  layer: boolean;
  section: boolean;
  screenshot: boolean;
  fullscreen: boolean;
  saveView: boolean;
};

export interface ModelViewerEngineProps {
  model: ModelDetail;
  processingHint?: string;
}

export const EMPTY_VIEWER_CAPABILITIES: ModelViewerCapabilities = {
  resetView: false,
  fitView: false,
  zoom: false,
  pan: false,
  orbit: false,
  walk: false,
  measure: false,
  annotation: false,
  layer: false,
  section: false,
  screenshot: false,
  fullscreen: false,
  saveView: false,
};

export const LCC_VIEWER_CAPABILITIES: ModelViewerCapabilities = {
  ...EMPTY_VIEWER_CAPABILITIES,
  resetView: true,
  fitView: true,
  zoom: true,
  pan: true,
  orbit: true,
  walk: true,
  measure: true,
  section: true,
  fullscreen: true,
  saveView: true,
};

export const IFRAME_VIEWER_CAPABILITIES: ModelViewerCapabilities = {
  ...EMPTY_VIEWER_CAPABILITIES,
  fullscreen: true,
};

export function getViewerCapabilities(kind: ModelViewerKind): ModelViewerCapabilities {
  switch (kind) {
    case "lcc":
      return LCC_VIEWER_CAPABILITIES;
    case "iframe":
      return IFRAME_VIEWER_CAPABILITIES;
    default:
      return EMPTY_VIEWER_CAPABILITIES;
  }
}
