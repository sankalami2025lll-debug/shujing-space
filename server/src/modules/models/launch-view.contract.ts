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
