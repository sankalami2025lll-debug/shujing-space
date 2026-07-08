/**
 * 模块：模型空间标注 - 组件内部类型与辅助
 * 用途：标注层（AnnotationLayer）渲染所需的本地类型、屏幕投影工具与样式常量。
 * 说明：
 *  - anchorPosition 使用 render 空间坐标，与 LccViewer pickPoint.lockedWorldPoint 一致；
 *    投影复用 viewerHandle.projectPoint，不新增 handle 方法。
 *  - 标题胶囊、内容框均为 DOM/SVG overlay，不做成 3D 几何体。
 *  - 标题 placement（top/bottom）按 annotationId 缓存于 layer 内 ref，仅在首次出现 /
 *    上方放不下时翻转一次；取消长引线，标题紧贴标注点上方/下方，底部/顶部带小箭头指向标注点。
 *  - cameraSnapshot 在数据库/接口中保存为扁平结构（position/target/up 数组 + near/far），
 *    与 ModelLaunchView 的包装结构 {version, viewerKind, snapshot} 不同；
 *    提交前用 normalizeAnnotationCameraSnapshotForApi 转扁平，跳转视角用
 *    annotationCameraSnapshotToLaunchView 转回 ModelLaunchView 供 applyView 使用。
 */

import type {
  AnnotationCameraSnapshot,
  ModelLaunchView,
} from "@/lib/types";

export type AnnotationScreenPoint = {
  x: number;
  y: number;
  visible: boolean;
};

/** 标题胶囊相对标注点的纵向放置方向（每个 annotationId 缓存一份，不每帧切换） */
export type AnnotationPlacement = "top" | "bottom";

/** 标题胶囊与标注点之间的间距（px）。
 * 取消长引线后，标题紧贴标注点上方，小箭头落在此间距内指向标注点。 */
export const TITLE_GAP = 18;
/** 标题胶囊距视口左右/上下的最小留白（px），仅用于标题 clamp，不影响标注点真实投影 */
export const TITLE_MARGIN_X = 12;
export const TITLE_MARGIN_Y = 12;
/** 展开内容框与标注点之间的间距（px） */
export const CARD_GAP = 24;
/** 内容框 / 标题距视口的安全留白（px），用于 clamp */
export const VIEWPORT_MARGIN_X = 16;
export const VIEWPORT_MARGIN_Y = 16;
/** 内容框固定宽度（px）；移动端由 layer 用 min(360, 100vw-32) 兜底 */
export const CARD_WIDTH = 320;
/** 内容框高度估算值（px），用于首次定位；真实高度由 AnnotationCard 测量后回填缓存 */
export const CARD_ESTIMATED_HEIGHT = 140;
/** 内容框小箭头水平 clamp 的最小内边距（px） */
export const CARD_ARROW_PADDING = 20;

/**
 * 首次 placement 决策：默认标题在标注点上方（top）。
 * 仅当上方放不下时才翻转到 bottom；bottom 也放不下时再 clamp 到视口内。
 * 结果缓存到 layer 内的 placementRef，相机移动时不每帧切换，避免标题上下跳动。
 */
export function decideInitialPlacement(): AnnotationPlacement {
  return "top";
}

/**
 * 估算标题胶囊宽度（用于标题水平居中与左右 clamp）。
 * V1 接受估算值，不每帧调用 getBoundingClientRect 测量，避免标题尺寸波动导致位置抖动。
 * 估算口径：左右 padding 共 24px，中文 ~14px/字，英文/数字 ~8px/字，下限 56px。
 */
export function estimateTitleWidth(title: string): number {
  let w = 24;
  for (const ch of title) {
    w += /[\u4e00-\u9fff]/.test(ch) ? 14 : 8;
  }
  return Math.max(56, w);
}

/**
 * 计算标题胶囊左上角屏幕坐标（仅 top placement：标题始终在标注点上方，Y 不足时 clamp 到顶部安全边距，不翻转下方）。
 * - titleY = anchor.y - titleHeight - TITLE_GAP
 * - titleX 默认让标题水平居中于标注点，再 clamp 到视口左右留白内
 * - 上方空间不足时 titleY clamp 到 TITLE_MARGIN_Y，不允许翻转到标注点下方
 */
export function resolveTitleBox(
  anchor: AnnotationScreenPoint,
  titleWidth: number,
  titleHeight: number,
  _placement: AnnotationPlacement,
  containerWidth: number,
): { titleX: number; titleY: number } {
  let titleY = anchor.y - titleHeight - TITLE_GAP;
  if (titleY < TITLE_MARGIN_Y) titleY = TITLE_MARGIN_Y;
  let titleX = anchor.x - titleWidth / 2;
  const minX = TITLE_MARGIN_X;
  const maxX = containerWidth - titleWidth - TITLE_MARGIN_X;
  if (titleX < minX) titleX = minX;
  if (titleX > maxX) titleX = Math.max(minX, maxX);
  return { titleX, titleY };
}

/**
 * 计算展开内容框左上角屏幕坐标 + 底部小箭头水平位置。
 * - 内容框始终在标注点上方：cardY = anchor.y - cardHeight - CARD_GAP
 * - cardX 默认水平居中于标注点，clamp 到视口左右安全边距内
 * - 上方空间不足时 cardY clamp 到 VIEWPORT_MARGIN_Y，不翻转到下方
 * - 箭头在内容框底部，水平位置对准 anchor.x（相对 cardX），clamp 到内容框左右内边距内
 * 返回的坐标均为屏幕像素（相对 layer 容器），不涉及 3D scale。
 */
export function resolveCardBox(
  anchor: AnnotationScreenPoint,
  cardWidth: number,
  cardHeight: number,
  containerWidth: number,
): { cardX: number; cardY: number; arrowLeft: number } {
  let cardY = anchor.y - cardHeight - CARD_GAP;
  if (cardY < VIEWPORT_MARGIN_Y) cardY = VIEWPORT_MARGIN_Y;
  let cardX = anchor.x - cardWidth / 2;
  const minX = VIEWPORT_MARGIN_X;
  const maxX = containerWidth - cardWidth - VIEWPORT_MARGIN_X;
  if (cardX < minX) cardX = minX;
  if (cardX > maxX) cardX = Math.max(minX, maxX);
  const arrowLeft = Math.max(
    CARD_ARROW_PADDING,
    Math.min(cardWidth - CARD_ARROW_PADDING, anchor.x - cardX),
  );
  return { cardX, cardY, arrowLeft };
}

/** 标注层视觉常量（对齐产品 V1 视觉规范；取消长引线，改为标题胶囊 + 小箭头 + 标注点） */
export const ANNOTATION_VISUAL = {
  // 标注点：中心 cyan 实心圆 + 外圈描边 + 暗色外描边（避免亮背景上看不清，不发光）
  pinCenterRadius: 3.5,
  pinOuterRadius: 9,
  pinOuterOpacity: 0.85,
  pinDarkOutline: "0 0 0 1px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.45)",
  // 标题胶囊
  titleHeight: 30,
  titleFontSize: 12,
  titleShadow: "0 8px 18px rgba(0,0,0,0.28)",
  // 小箭头：标题底部/顶部三角，颜色与标题背景一致
  arrowSize: 8,
  // 内容框（保持原样，不改）
  cardWidth: CARD_WIDTH,
  cardMaxHeight: "60vh",
  cardRadius: 16,
  bg: "rgba(12,16,22,0.88)",
  bgCard: "rgba(10, 12, 16, 0.88)",
  border: "rgba(255,255,255,0.16)",
  borderCard: "rgba(255,255,255,0.12)",
  cyan: "rgba(34, 211, 238, 0.95)",
} as const;

/** 纯净模式 localStorage key */
export const CLEAN_MODE_STORAGE_KEY = "shujing:model-viewer:clean-mode";

export function readCleanModePref(defaultValue = false): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const v = window.localStorage.getItem(CLEAN_MODE_STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* localStorage 不可用时回退默认 */
  }
  return defaultValue;
}

export function writeCleanModePref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLEAN_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* 忽略 */
  }
}

/* ---------- cameraSnapshot 前后端结构转换 ---------- */

/** 把任意向量（{x,y,z} 或 [x,y,z]）归一为长度 3 的数字数组；非法返回 null */
function toVec3(value: unknown): [number, number, number] | null {
  if (Array.isArray(value) && value.length === 3) {
    const [x, y, z] = value;
    if (
      typeof x === "number" && Number.isFinite(x) &&
      typeof y === "number" && Number.isFinite(y) &&
      typeof z === "number" && Number.isFinite(z)
    ) {
      return [x, y, z];
    }
    return null;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as { x?: unknown; y?: unknown; z?: unknown };
    if (
      typeof o.x === "number" && Number.isFinite(o.x) &&
      typeof o.y === "number" && Number.isFinite(o.y) &&
      typeof o.z === "number" && Number.isFinite(o.z)
    ) {
      return [o.x, o.y, o.z];
    }
  }
  return null;
}

/**
 * 把 viewerHandle.getCurrentView() 返回的 ModelLaunchView（包装结构）或已扁平的
 * AnnotationCameraSnapshot 归一为后端 DTO 要求的扁平结构。
 * 兼容历史误存的 {version, viewerKind, snapshot:{...}} 包装格式与 {x,y,z} 对象向量。
 * 非法时抛错（保存路径由调用方保证输入来自 getCurrentView，正常不会触发）。
 */
export function normalizeAnnotationCameraSnapshotForApi(
  input: ModelLaunchView | AnnotationCameraSnapshot | unknown,
): AnnotationCameraSnapshot {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("cameraSnapshot 格式非法");
  }
  const root = input as Record<string, unknown>;
  // 兼容包装结构：取 snapshot 子对象作为扁平源
  const flatSource =
    root.snapshot && typeof root.snapshot === "object" && !Array.isArray(root.snapshot)
      ? (root.snapshot as Record<string, unknown>)
      : root;
  const position = toVec3(flatSource.position);
  const target = toVec3(flatSource.target);
  const up = toVec3(flatSource.up);
  const near = typeof flatSource.near === "number" ? flatSource.near : null;
  const far = typeof flatSource.far === "number" ? flatSource.far : null;
  if (!position || !target || !up || near == null || far == null) {
    throw new Error("cameraSnapshot 格式非法");
  }
  return { position, target, up, near, far };
}

/**
 * 把标注保存的 cameraSnapshot（扁平）转回 ModelLaunchView，供 viewerHandle.applyView 使用。
 * 同样兼容旧/误存包装格式与 {x,y,z} 对象向量；非法返回 null（跳转失败时调用方静默）。
 */
export function annotationCameraSnapshotToLaunchView(
  input: AnnotationCameraSnapshot | ModelLaunchView | unknown,
): ModelLaunchView | null {
  try {
    const flat = normalizeAnnotationCameraSnapshotForApi(input);
    return { version: 1, viewerKind: "lcc", snapshot: flat };
  } catch {
    return null;
  }
}
