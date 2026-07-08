export const MODEL_LAUNCH_VIEW_VERSION = 1 as const;
export const MODEL_LAUNCH_VIEW_VIEWER_KINDS = ['lcc'] as const;

export type ModelLaunchViewViewerKind =
  (typeof MODEL_LAUNCH_VIEW_VIEWER_KINDS)[number];

export type ModelLaunchViewVector3 = [number, number, number];

export interface ModelLaunchViewSnapshot {
  position: ModelLaunchViewVector3;
  target: ModelLaunchViewVector3;
  up: ModelLaunchViewVector3;
  near: number;
  far: number;
}

export interface ModelLaunchView {
  version: typeof MODEL_LAUNCH_VIEW_VERSION;
  viewerKind: ModelLaunchViewViewerKind;
  snapshot: ModelLaunchViewSnapshot;
}

/**
 * 标注保存视角（扁平结构）。
 * 与 annotations DTO 一致：position/target/up 为长度 3 的数字数组，near/far 为数字。
 * 区别于 ModelLaunchView 的包装结构 {version, viewerKind, snapshot}。
 * 标注落库与接口传输统一使用该扁平结构；applyView 时再转回 ModelLaunchView。
 */
export interface AnnotationCameraSnapshot {
  position: ModelLaunchViewVector3;
  target: ModelLaunchViewVector3;
  up: ModelLaunchViewVector3;
  near: number;
  far: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toVector3(value: unknown): ModelLaunchViewVector3 | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const [x, y, z] = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
    return null;
  }
  return [x, y, z];
}

export function parseModelLaunchView(value: unknown): ModelLaunchView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const snapshotValue = candidate.snapshot;
  if (!snapshotValue || typeof snapshotValue !== "object" || Array.isArray(snapshotValue)) {
    return null;
  }

  const snapshot = snapshotValue as Record<string, unknown>;
  const version = candidate.version;
  const viewerKind = candidate.viewerKind;
  const position = toVector3(snapshot.position);
  const target = toVector3(snapshot.target);
  const up = toVector3(snapshot.up);
  const near = snapshot.near;
  const far = snapshot.far;

  if (version !== MODEL_LAUNCH_VIEW_VERSION) {
    return null;
  }
  if (
    typeof viewerKind !== "string" ||
    !MODEL_LAUNCH_VIEW_VIEWER_KINDS.includes(viewerKind as ModelLaunchViewViewerKind)
  ) {
    return null;
  }
  if (!position || !target || !up || !isFiniteNumber(near) || !isFiniteNumber(far)) {
    return null;
  }
  if (near <= 0 || far <= 0 || far < near) {
    return null;
  }

  return {
    version: MODEL_LAUNCH_VIEW_VERSION,
    viewerKind: viewerKind as ModelLaunchViewViewerKind,
    snapshot: {
      position,
      target,
      up,
      near,
      far,
    },
  };
}

/**
 * 解析标注保存视角（扁平结构）。
 * 兼容两种输入：
 *  - 新格式（规范）：{ position:[x,y,z], target:[x,y,z], up:[x,y,z], near, far }
 *  - 旧/误存包装格式：{ version, viewerKind, snapshot:{ position:{x,y,z}|[..], ... } }
 * 返回统一的扁平 AnnotationCameraSnapshot；非法返回 null。
 */
export function parseAnnotationCameraSnapshot(
  value: unknown,
): AnnotationCameraSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const root = value as Record<string, unknown>;
  // 兼容包装结构：取 snapshot 子对象作为扁平源
  const flatSource =
    root.snapshot && typeof root.snapshot === 'object' && !Array.isArray(root.snapshot)
      ? (root.snapshot as Record<string, unknown>)
      : root;
  const position = toVector3(flatSource.position);
  const target = toVector3(flatSource.target);
  const up = toVector3(flatSource.up);
  const near = flatSource.near;
  const far = flatSource.far;
  if (!position || !target || !up || !isFiniteNumber(near) || !isFiniteNumber(far)) {
    return null;
  }
  if (near <= 0 || far <= 0 || far < near) {
    return null;
  }
  return { position, target, up, near, far };
}
