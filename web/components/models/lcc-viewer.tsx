"use client";

/**
 * 组件名称：LccViewer
 * 组件用途：统一承接 LCC / LCC2 浏览器容器，当前阶段已接入 Three.js + LCC Web SDK 的最小真实加载链路。
 * 说明：详情页只负责传入模型信息；LCC / LCC2 的 SDK 初始化、进度显示、尺寸同步与安全清理均在本组件内处理。
 * 当前规则：LCCRender.load 的 dataPath 始终传 .lcc / .lcc2 入口文件 URL，不再使用目录模式。
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import type { ModelViewerHandle } from "@/components/models/viewers/types";

const LCC_WEB_VERSION = "0.6.0";
const LCC_WEB_UMD_URL = `/vendor/lcc-web/${LCC_WEB_VERSION}/lcc-${LCC_WEB_VERSION}.umd.js`;
const IS_DEV = process.env.NODE_ENV !== "production";

interface LccLoadParams {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  dataPath: string;
  renderLib: typeof THREE;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  modelMatrix?: THREE.Matrix4;
  useEnv?: boolean;
  useIndexDB?: boolean;
  useLoadingEffect?: boolean;
  useLcc2?: boolean;
  maxConcurrentDownloads?: number;
  workerPerFrameRequests?: number;
  enableLoadingLog?: boolean;
}

interface LccRenderApi {
  load: (
    params: LccLoadParams,
    onLoaded?: (mesh: unknown) => void,
    onProgress?: (percent: number) => void,
    onFailed?: (error?: unknown) => void,
    options?: unknown,
  ) => unknown;
  update: () => void;
  unload?: (instance?: unknown) => void;
  dispose?: () => void;
  setCamera?: (camera: THREE.PerspectiveCamera) => void;
  getVersion?: () => string;
}

interface LccBoundsLike {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface LccRuntimeInstance {
  getBounds?: () => LccBoundsLike | null;
  getMeta?: () => unknown;
}

interface LccSdkGlobal {
  LCCRender?: LccRenderApi;
}

declare global {
  interface Window {
    LCC?: LccSdkGlobal;
  }
}

type LccViewerStatus = "idle" | "loading" | "loaded" | "error";
type SupportedLccFormat = "lcc" | "lcc2";
type DefaultViewSource =
  | "defaultCamera"
  | "sdkBounds"
  | "boundsCenterHomeView"
  | "bounds";

interface CameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  near: number;
  far: number;
  source: DefaultViewSource;
}

interface BoundsSummary {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
}

interface SpawnPointLoadResult {
  attrsPath: string | null;
  rawPosition: [number, number, number] | null;
  rawRotation: [number, number, number, number] | null;
  resolvedPosition: [number, number, number] | null;
  skippedRotation: boolean;
  fallbackReason: string | null;
}

interface BoundsCenterHomeViewResult {
  snapshot: CameraSnapshot | null;
  boundsSource: "sdkBounds" | "threeBounds";
  center: [number, number, number] | null;
  size: [number, number, number] | null;
  maxDim: number | null;
  distance: number | null;
  cameraPosition: [number, number, number] | null;
  target: [number, number, number] | null;
  up: [number, number, number] | null;
  heightOffset: number | null;
}

interface DefaultViewResolution {
  snapshot: CameraSnapshot | null;
  usedBoundsFallback: boolean;
  boundsSummary: BoundsSummary | null;
  boundsSource: "sdkBounds" | "threeBounds" | null;
}

interface LccViewerProps {
  modelUrl?: string | null;
  viewerUrl?: string | null;
  fileFormat?: string | null;
  viewerType?: string | null;
  defaultCameraJson?: string | null;
  processingBlocked?: boolean;
  processingHint?: string;
}

let lccSdkPromise: Promise<LccRenderApi> | null = null;
let lastSdkFormat: SupportedLccFormat | null = null;
let globalLoadSequence = 0;
let activeGlobalLoadId = 0;
const OFFICIAL_MODEL_MATRIX = new THREE.Matrix4().set(
  -1, 0, 0, 0,
  0, 0, 1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1,
);
const OFFICIAL_CAMERA_POSITION = new THREE.Vector3(0, 2, 0);
const OFFICIAL_CAMERA_TARGET = new THREE.Vector3(0, 2, 1);
const OFFICIAL_CAMERA_UP = new THREE.Vector3(0, 1, 0);
const OFFICIAL_VIEW_DIRECTION = OFFICIAL_CAMERA_TARGET.clone()
  .sub(OFFICIAL_CAMERA_POSITION)
  .normalize();

function logLccDebug(message: string, payload?: unknown) {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.info(`[LccViewer] ${message}`);
    return;
  }
  console.info(`[LccViewer] ${message}`, payload);
}

function logLccError(message: string, payload?: unknown) {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.error(`[LccViewer] ${message}`);
    return;
  }
  console.error(`[LccViewer] ${message}`, payload);
}

function logLccWarn(message: string, payload?: unknown) {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.warn(`[LccViewer] ${message}`);
    return;
  }
  console.warn(`[LccViewer] ${message}`, payload);
}

function safeDecodeUri(value: string) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function getCleanPathname(inputUrl?: string | null) {
  if (!inputUrl) return "";
  try {
    return safeDecodeUri(
      new URL(inputUrl, typeof window !== "undefined" ? window.location.href : "http://localhost")
        .pathname,
    ).toLowerCase();
  } catch {
    return safeDecodeUri(inputUrl.split(/[?#]/)[0] ?? "").toLowerCase();
  }
}

function getCleanPathExtension(inputUrl?: string | null) {
  const pathname = getCleanPathname(inputUrl);
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function normalizeEntryUrl(inputUrl?: string | null) {
  if (!inputUrl) return "";

  try {
    const parsed = new URL(
      inputUrl,
      typeof window !== "undefined" ? window.location.href : "http://localhost",
    );
    const encodedPathname = encodeURI(safeDecodeUri(parsed.pathname));
    if (parsed.origin === "null") {
      return `${encodedPathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.origin}${encodedPathname}${parsed.search}${parsed.hash}`;
  } catch {
    const [withoutHash = "", hash = ""] = inputUrl.split("#", 2);
    const [pathname = "", search = ""] = withoutHash.split("?", 2);
    const encodedPathname = encodeURI(safeDecodeUri(pathname));
    return `${encodedPathname}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
  }
}

async function probeDataPath(dataPath: string) {
  if (!IS_DEV || typeof window === "undefined" || !dataPath) return;

  try {
    const response = await fetch(dataPath, {
      method: "HEAD",
      cache: "no-store",
      mode: "cors",
    });

    const headers = {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      acceptRanges: response.headers.get("accept-ranges"),
    };

    if (response.ok) {
      logLccDebug("dataPath HEAD 检查成功", headers);
      return;
    }

    logLccWarn("dataPath HEAD 检查返回非 2xx，不阻断后续 SDK 加载", headers);
  } catch (error) {
    logLccWarn("dataPath HEAD 检查失败，不阻断后续 SDK 加载", error);
  }
}

function inferLccFormat(viewerUrl?: string | null, fileFormat?: string | null) {
  const normalizedFormat = (fileFormat ?? "").toLowerCase();
  if (normalizedFormat.includes("lcc2")) {
    return { format: "lcc2" as const, source: "fileFormat" as const };
  }
  if (normalizedFormat.includes("lcc")) {
    return { format: "lcc" as const, source: "fileFormat" as const };
  }
  const extension = getCleanPathExtension(viewerUrl);
  if (extension === "lcc2") {
    return { format: "lcc2" as const, source: "urlExtension" as const };
  }
  if (extension === "lcc") {
    return { format: "lcc" as const, source: "urlExtension" as const };
  }
  return { format: null, source: "unknown" as const };
}

function isEntryFileUrl(inputUrl?: string | null) {
  const extension = getCleanPathExtension(inputUrl);
  return extension === "lcc" || extension === "lcc2";
}

function buildLccLoadParams({
  baseParams,
  useLcc2,
}: {
  baseParams: LccLoadParams;
  useLcc2: boolean;
}) {
  // LCC2 仍使用同一个 LCCRender，只在格式参数上做最小分支。
  if (useLcc2) {
    return {
      ...baseParams,
      useLcc2: true,
      maxConcurrentDownloads: 1,
      workerPerFrameRequests: 1,
      enableLoadingLog: IS_DEV,
    } satisfies LccLoadParams;
  }

  return {
    ...baseParams,
    useLcc2: false,
  } satisfies LccLoadParams;
}

function getFormatSpecificLoadLogFields(format: SupportedLccFormat, params: LccLoadParams) {
  return {
    format,
    useLcc2: params.useLcc2 ?? false,
    maxConcurrentDownloads:
      params.maxConcurrentDownloads === undefined ? "default" : params.maxConcurrentDownloads,
    workerPerFrameRequests:
      params.workerPerFrameRequests === undefined ? "default" : params.workerPerFrameRequests,
    enableLoadingLog:
      params.enableLoadingLog === undefined ? "default" : params.enableLoadingLog,
  };
}

function clampProgress(percent: number) {
  if (!Number.isFinite(percent)) return 0;
  if (percent < 0) return 0;
  if (percent > 1) return 1;
  return percent;
}

function getProgressLogKey(percent: number) {
  const normalized = clampProgress(percent);
  const percentValue = Math.round(normalized * 100);
  if (percentValue >= 100) return 100;
  if (percentValue >= 75) return 75;
  if (percentValue >= 50) return 50;
  if (percentValue >= 25) return 25;
  return 0;
}

function isThreeObject3D(value: unknown): value is THREE.Object3D {
  return (
    typeof value === "object" &&
    value !== null &&
    "isObject3D" in value &&
    (value as { isObject3D?: boolean }).isObject3D === true
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toVectorTuple(value: unknown): [number, number, number] | null {
  if (Array.isArray(value) && value.length >= 3) {
    const [x, y, z] = value;
    if (isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(z)) {
      return [x, y, z];
    }
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "z" in value
  ) {
    const vector = value as { x?: unknown; y?: unknown; z?: unknown };
    if (isFiniteNumber(vector.x) && isFiniteNumber(vector.y) && isFiniteNumber(vector.z)) {
      return [vector.x, vector.y, vector.z];
    }
  }

  return null;
}

function toMatrixValues(value: unknown) {
  if (!Array.isArray(value) || value.length !== 16) {
    return null;
  }

  const numbers = value.map((item) => Number(item));
  return numbers.every((item) => Number.isFinite(item)) ? numbers : null;
}

function toQuaternionTuple(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) {
    return null;
  }

  const [a, b, c, d] = value;
  if ([a, b, c, d].every((item) => isFiniteNumber(item))) {
    return [a, b, c, d];
  }

  return null;
}

function createBoundsSummary(bounds: THREE.Box3): BoundsSummary | null {
  if (bounds.isEmpty()) {
    return null;
  }

  const values = [
    bounds.min.x,
    bounds.min.y,
    bounds.min.z,
    bounds.max.x,
    bounds.max.y,
    bounds.max.z,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  if (
    [center.x, center.y, center.z, size.x, size.y, size.z].some(
      (value) => !Number.isFinite(value),
    )
  ) {
    return null;
  }

  return {
    min: bounds.min.toArray() as [number, number, number],
    max: bounds.max.toArray() as [number, number, number],
    center: center.toArray() as [number, number, number],
    size: size.toArray() as [number, number, number],
  };
}

function getValidatedObjectBounds(object: THREE.Object3D, scene?: THREE.Scene | null) {
  object.updateWorldMatrix(true, true);
  scene?.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  return createBoundsSummary(bounds) ? bounds : null;
}

function createBoundsBoxFromSdk(bounds: LccBoundsLike | null | undefined) {
  const min = toVectorTuple(bounds?.min);
  const max = toVectorTuple(bounds?.max);
  if (!min || !max) {
    return null;
  }

  const box = new THREE.Box3(
    new THREE.Vector3(min[0], min[1], min[2]),
    new THREE.Vector3(max[0], max[1], max[2]),
  );

  return createBoundsSummary(box) ? box : null;
}

function applyCameraSnapshot(
  camera: THREE.PerspectiveCamera,
  snapshot: CameraSnapshot,
  controls?: OrbitControls | null,
) {
  camera.position.set(...snapshot.position);
  camera.up.set(...snapshot.up);
  camera.near = snapshot.near;
  camera.far = snapshot.far;
  camera.lookAt(...snapshot.target);
  camera.updateProjectionMatrix();

  if (!controls) {
    return;
  }

  controls.target.set(...snapshot.target);
  const distance = camera.position.distanceTo(controls.target);
  controls.minDistance = Math.max(distance * 0.1, 0.5);
  controls.maxDistance = Math.max(distance * 8, 50);
  controls.update();
}

function buildBoundsFitSnapshot(
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  source: DefaultViewSource = "bounds",
): CameraSnapshot | null {
  const summary = createBoundsSummary(bounds);
  if (!summary) {
    return null;
  }

  const center = new THREE.Vector3(...summary.center);
  const size = new THREE.Vector3(...summary.size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const safeMaxDim = Number.isFinite(maxDim) && maxDim > 0 ? maxDim : 10;
  const radius = Math.max(size.length() / 2, safeMaxDim / 2, 1);
  const fovInRadians = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.max(radius / Math.sin(fovInRadians / 2), safeMaxDim * 0.8, 6);
  const position = center
    .clone()
    .sub(OFFICIAL_VIEW_DIRECTION.clone().multiplyScalar(distance));

  return {
    position: position.toArray() as [number, number, number],
    target: center.toArray() as [number, number, number],
    up: OFFICIAL_CAMERA_UP.toArray() as [number, number, number],
    near: Math.max(distance / 500, radius / 200, 0.01),
    far: Math.max(distance + radius * 12, 100),
    source,
  };
}

function buildBoundsCenterHomeView(args: {
  camera: THREE.PerspectiveCamera;
  bounds: THREE.Box3;
  boundsSource: "sdkBounds" | "threeBounds";
}): BoundsCenterHomeViewResult {
  const { camera, bounds, boundsSource } = args;
  const summary = createBoundsSummary(bounds);
  if (!summary) {
    return {
      snapshot: null,
      boundsSource,
      center: null,
      size: null,
      maxDim: null,
      distance: null,
      cameraPosition: null,
      target: null,
      up: null,
      heightOffset: null,
    };
  }

  const center = new THREE.Vector3(...summary.center);
  const size = new THREE.Vector3(...summary.size);
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fovInRadians = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(camera.fov, 35, 70),
  );
  const fitDistance = (maxDim * 0.5) / Math.tan(fovInRadians / 2);
  let distance = Math.max(fitDistance * 0.85, maxDim * 0.85, 6);
  const heightOffset = Math.max(size.y * 0.05, 0);
  const up = OFFICIAL_CAMERA_UP.clone();
  const forward = OFFICIAL_VIEW_DIRECTION.clone().normalize();

  let position = center
    .clone()
    .sub(forward.clone().multiplyScalar(distance))
    .add(new THREE.Vector3(0, heightOffset, 0));

  if (bounds.containsPoint(position)) {
    distance = Math.max(distance, maxDim * 1.35, 8);
    position = center
      .clone()
      .sub(forward.clone().multiplyScalar(distance))
      .add(new THREE.Vector3(0, heightOffset, 0));
  }

  const snapshot = buildLookAtSnapshot({
    position,
    target: center,
    up,
    bounds,
    source: "boundsCenterHomeView",
  });

  return {
    snapshot,
    boundsSource,
    center: summary.center,
    size: summary.size,
    maxDim,
    distance,
    cameraPosition: snapshot?.position ?? (position.toArray() as [number, number, number]),
    target: snapshot?.target ?? (center.toArray() as [number, number, number]),
    up: snapshot?.up ?? (up.toArray() as [number, number, number]),
    heightOffset,
  };
}

function getRuntimeInstance(value: unknown): LccRuntimeInstance | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as LccRuntimeInstance;
}

function buildAssetSidecarUrl(entryUrl: string, relativePath: string) {
  if (!entryUrl) return null;
  try {
    return new URL(relativePath, entryUrl).toString();
  } catch {
    return null;
  }
}

function getBoundsSphere(bounds: THREE.Box3) {
  const sphere = new THREE.Sphere();
  bounds.getBoundingSphere(sphere);
  return sphere;
}

function isValidVector3(vector: THREE.Vector3) {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function buildLookAtSnapshot(args: {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  bounds: THREE.Box3;
  source: DefaultViewSource;
}) {
  const { position, target, up, bounds, source } = args;
  const summary = createBoundsSummary(bounds);
  if (!summary || !isValidVector3(position) || !isValidVector3(target) || !isValidVector3(up)) {
    return null;
  }

  const direction = target.clone().sub(position);
  const distance = direction.length();
  if (!Number.isFinite(distance) || distance < 1e-6) {
    return null;
  }

  const sphere = getBoundsSphere(bounds);
  const radius = Math.max(sphere.radius, 1);
  const near = Math.max(distance / 500, radius / 200, 0.01);
  const far = Math.max(distance + radius * 12, 100);

  return {
    position: position.toArray() as [number, number, number],
    target: target.toArray() as [number, number, number],
    up: up.clone().normalize().toArray() as [number, number, number],
    near,
    far,
    source,
  } satisfies CameraSnapshot;
}

function extractPoseSnapshotCandidate(value: unknown): CameraSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const directPosition = toVectorTuple(
    candidate.position ?? candidate.eye ?? candidate.origin ?? candidate.cameraPosition,
  );
  const directTarget = toVectorTuple(
    candidate.target ?? candidate.lookAt ?? candidate.focus ?? candidate.center,
  );
  const directUp =
    toVectorTuple(candidate.up) ??
    (OFFICIAL_CAMERA_UP.toArray() as [number, number, number]);

  if (directPosition && directTarget) {
    return {
      position: directPosition,
      target: directTarget,
      up: directUp,
      near: 0.01,
      far: 20000,
      source: "defaultCamera",
    };
  }

  const matrixValues = toMatrixValues(
    candidate.matrix ?? candidate.cameraMatrix ?? candidate.viewMatrix,
  );
  if (matrixValues) {
    const matrix = new THREE.Matrix4().fromArray(matrixValues);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion).normalize();
    const target = position.clone().add(direction);
    return {
      position: position.toArray() as [number, number, number],
      target: target.toArray() as [number, number, number],
      up: OFFICIAL_CAMERA_UP.toArray() as [number, number, number],
      near: 0.01,
      far: 20000,
      source: "defaultCamera",
    };
  }

  return null;
}

function parseDefaultCameraJson(defaultCameraJson: string | null | undefined) {
  if (!defaultCameraJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(defaultCameraJson) as unknown;
    return extractPoseSnapshotCandidate(parsed);
  } catch {
    return null;
  }
}

async function loadLccSpawnPointSnapshot(
  entryUrl: string,
  format: SupportedLccFormat,
  bounds: THREE.Box3 | null,
): Promise<SpawnPointLoadResult> {
  if (format !== "lcc") {
    return {
      attrsPath: null,
      rawPosition: null,
      rawRotation: null,
      resolvedPosition: null,
      skippedRotation: false,
      fallbackReason: "spawnPoint-only-for-lcc",
    };
  }

  const attrsPath = buildAssetSidecarUrl(entryUrl, "./attrs.lcp");
  if (!attrsPath) {
    return {
      attrsPath: null,
      rawPosition: null,
      rawRotation: null,
      resolvedPosition: null,
      skippedRotation: false,
      fallbackReason: "attrs-path-unavailable",
    };
  }

  try {
    const response = await fetch(attrsPath, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
    });
    if (!response.ok) {
      return {
        attrsPath,
        rawPosition: null,
        rawRotation: null,
        resolvedPosition: null,
        skippedRotation: false,
        fallbackReason: `attrs-fetch-${response.status}`,
      };
    }

    const text = await response.text();
    const data = JSON.parse(text) as Record<string, unknown>;
    const spawnPoint =
      typeof data.spawnPoint === "object" && data.spawnPoint !== null
        ? (data.spawnPoint as Record<string, unknown>)
        : null;
    const rawPosition = toVectorTuple(spawnPoint?.position);
    const rawRotation = toQuaternionTuple(spawnPoint?.rotation);

    if (!spawnPoint || !rawPosition) {
      return {
        attrsPath,
        rawPosition,
        rawRotation,
        resolvedPosition: null,
        skippedRotation: Boolean(rawRotation),
        fallbackReason: "spawnPoint-missing-position",
      };
    }

    return {
      attrsPath,
      rawPosition,
      rawRotation,
      resolvedPosition: bounds
        ? (new THREE.Vector3(...rawPosition).applyMatrix4(OFFICIAL_MODEL_MATRIX).toArray() as [
            number,
            number,
            number,
          ])
        : rawPosition,
      skippedRotation: Boolean(rawRotation),
      fallbackReason: rawRotation ? "spawnPoint-rotation-skipped-for-default-view" : "spawnPoint-missing-rotation",
    };
  } catch (error) {
    return {
      attrsPath,
      rawPosition: null,
      rawRotation: null,
      resolvedPosition: null,
      skippedRotation: false,
      fallbackReason: error instanceof Error ? error.message : "attrs-parse-failed",
    };
  }
}

function getEnumerableKeys(value: unknown) {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return [];
  }

  return Object.keys(value as Record<string, unknown>).slice(0, 50);
}

function summarizeDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (typeof value[0] === "number") {
      return value.slice(0, 8);
    }
    if (typeof value[0] === "string") {
      return value.slice(0, 8);
    }
    if (value[0] && typeof value[0] === "object") {
      return {
        length: value.length,
        firstKeys: Object.keys(value[0] as Record<string, unknown>).slice(0, 12),
      };
    }
    return { length: value.length };
  }

  if (typeof value === "object" && value !== null) {
    return {
      keys: Object.keys(value as Record<string, unknown>).slice(0, 12),
    };
  }

  return value;
}

function collectSuspiciousFieldSummaries(
  value: unknown,
  maxDepth = 3,
  currentPath = "",
  results: Array<{ path: string; summary: unknown }> = [],
  seen = new WeakSet<object>(),
) {
  if (results.length >= 20 || maxDepth < 0) {
    return results;
  }

  if (!value || typeof value !== "object") {
    return results;
  }

  if (seen.has(value)) {
    return results;
  }
  seen.add(value);

  const suspiciousTokens = ["camera", "view", "home", "default", "spawn", "origin", "transform", "bounds"];
  const entries = Array.isArray(value)
    ? value.slice(0, 5).map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>).slice(0, 40);

  for (const [key, nextValue] of entries) {
    const path = currentPath ? `${currentPath}.${key}` : key;
    const loweredPath = path.toLowerCase();
    if (suspiciousTokens.some((token) => loweredPath.includes(token))) {
      results.push({
        path,
        summary: summarizeDiagnosticValue(nextValue),
      });
      if (results.length >= 20) {
        break;
      }
    }
    collectSuspiciousFieldSummaries(nextValue, maxDepth - 1, path, results, seen);
    if (results.length >= 20) {
      break;
    }
  }

  return results;
}

function logLcc2RuntimeDiagnostics(args: {
  lccRender: LccRenderApi;
  runtimeInstance: LccRuntimeInstance | null;
  currentFormat: SupportedLccFormat;
}) {
  if (!IS_DEV || args.currentFormat !== "lcc2") {
    return;
  }

  const { lccRender, runtimeInstance } = args;
  const lccRenderRecord = lccRender as unknown as Record<string, unknown>;
  let metaSummary:
    | {
        topLevelKeys: string[];
        suspiciousFields: Array<{ path: string; summary: unknown }>;
      }
    | null = null;

  try {
    const meta = runtimeInstance?.getMeta?.();
    if (meta && typeof meta === "object") {
      metaSummary = {
        topLevelKeys: Object.keys(meta as Record<string, unknown>).slice(0, 50),
        suspiciousFields: collectSuspiciousFieldSummaries(meta),
      };
    }
  } catch (error) {
    metaSummary = {
      topLevelKeys: [],
      suspiciousFields: [
        {
          path: "getMeta()",
          summary: error instanceof Error ? error.message : "unknown-error",
        },
      ],
    };
  }

  logLccDebug("LCC2 runtime 诊断摘要", {
    lccRenderApi: {
      hasGetMeta: typeof lccRenderRecord.getMeta === "function",
      hasGetBounds: typeof lccRenderRecord.getBounds === "function",
      hasSetCamera: typeof lccRender.setCamera === "function",
      enumerableKeys: getEnumerableKeys(lccRender),
    },
    runtimeInstance: {
      hasGetMeta: typeof runtimeInstance?.getMeta === "function",
      hasGetBounds: typeof runtimeInstance?.getBounds === "function",
      enumerableKeys: getEnumerableKeys(runtimeInstance),
      directSuspiciousKeys: getEnumerableKeys(runtimeInstance).filter((key) =>
        ["camera", "view", "home", "default", "spawn", "origin", "transform"].some((token) =>
          key.toLowerCase().includes(token),
        ),
      ),
      hasDefaultView: Boolean((runtimeInstance as Record<string, unknown> | null)?.defaultView),
      hasCamera: Boolean((runtimeInstance as Record<string, unknown> | null)?.camera),
      hasHomeView: Boolean((runtimeInstance as Record<string, unknown> | null)?.homeView),
    },
    meta: metaSummary,
  });
}

function resolveLccRender() {
  return window.LCC?.LCCRender ?? null;
}

function ensureLccRender() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("LCC Viewer 只能在浏览器环境中初始化"));
  }

  const existingRender = resolveLccRender();
  if (existingRender) {
    return Promise.resolve(existingRender);
  }

  if (lccSdkPromise) {
    return lccSdkPromise;
  }

  lccSdkPromise = new Promise<LccRenderApi>((resolve, reject) => {
    const scriptSelector = `script[data-lcc-sdk="${LCC_WEB_VERSION}"]`;
    const currentScript = document.querySelector<HTMLScriptElement>(scriptSelector);

    const resolveRender = () => {
      const lccRender = resolveLccRender();
      logLccDebug("window.LCC 是否存在", Boolean(window.LCC));
      if (lccRender) {
        logLccDebug("LCC SDK 脚本加载成功");
        logLccDebug("LCCRender 是否存在", Boolean(lccRender));
        resolve(lccRender);
        return;
      }
      lccSdkPromise = null;
      reject(new Error("LCCRender 初始化失败"));
    };

    const rejectScript = () => {
      lccSdkPromise = null;
      reject(new Error("LCC SDK 加载失败"));
    };

    if (currentScript) {
      if (currentScript.dataset.lccLoaded === "true") {
        resolveRender();
        return;
      }
      if (currentScript.dataset.lccFailed === "true") {
        rejectScript();
        return;
      }
      currentScript.addEventListener(
        "load",
        () => {
          currentScript.dataset.lccLoaded = "true";
          resolveRender();
        },
        { once: true },
      );
      currentScript.addEventListener(
        "error",
        () => {
          currentScript.dataset.lccFailed = "true";
          logLccError("LCC SDK 脚本加载失败");
          rejectScript();
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = LCC_WEB_UMD_URL;
    script.async = true;
    script.dataset.lccSdk = LCC_WEB_VERSION;
    script.addEventListener(
      "load",
      () => {
        script.dataset.lccLoaded = "true";
        resolveRender();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        script.dataset.lccFailed = "true";
        logLccError("LCC SDK 脚本加载失败");
        rejectScript();
      },
      { once: true },
    );
    document.body.appendChild(script);
  });

  return lccSdkPromise;
}

export const LccViewer = forwardRef<ModelViewerHandle, LccViewerProps>(function LccViewer({
  modelUrl,
  viewerUrl,
  fileFormat,
  viewerType,
  defaultCameraJson,
  processingBlocked = false,
  processingHint = "",
}, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isDisposedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const lccRenderRef = useRef<LccRenderApi | null>(null);
  const lccInstanceRef = useRef<unknown>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const lastLoadedObjectRef = useRef<THREE.Object3D | null>(null);
  const defaultViewRef = useRef<CameraSnapshot | null>(null);
  const currentEntryUrlRef = useRef<string | null>(null);
  const activeInstanceEntryUrlRef = useRef<string | null>(null);
  const activeFormatRef = useRef<SupportedLccFormat | null>(null);
  const previousFormatRef = useRef<SupportedLccFormat | null>(null);
  const lastProgressLogRef = useRef<number | null>(null);
  const [viewerStatus, setViewerStatus] = useState<LccViewerStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [retrySeed, setRetrySeed] = useState(0);
  const normalizedModelUrl = useMemo(() => modelUrl?.trim() ?? "", [modelUrl]);
  const normalizedViewerUrl = useMemo(() => viewerUrl?.trim() ?? "", [viewerUrl]);
  const normalizedDefaultCameraJson = useMemo(
    () => defaultCameraJson?.trim() ?? "",
    [defaultCameraJson],
  );
  const platformDefaultCameraSnapshot = useMemo(
    () => parseDefaultCameraJson(normalizedDefaultCameraJson || null),
    [normalizedDefaultCameraJson],
  );
  const resolvedSourceUrl = useMemo(
    () => normalizedViewerUrl || normalizedModelUrl,
    [normalizedModelUrl, normalizedViewerUrl],
  );
  const entryUrl = useMemo(() => normalizeEntryUrl(resolvedSourceUrl), [resolvedSourceUrl]);
  const dataExtension = useMemo(() => getCleanPathExtension(entryUrl), [entryUrl]);
  const isEntryFileDataPath = useMemo(() => isEntryFileUrl(entryUrl), [entryUrl]);
  const lccFormatDecision = useMemo(
    () => inferLccFormat(resolvedSourceUrl, fileFormat),
    [fileFormat, resolvedSourceUrl],
  );
  const lccFormat = lccFormatDecision.format;

  const fitCurrentView = () => {
    const camera = cameraRef.current;
    const loadedObject = lastLoadedObjectRef.current;
    if (!camera || !loadedObject) {
      return false;
    }

    const runtimeInstance = getRuntimeInstance(lccInstanceRef.current);
    const sdkBounds = createBoundsBoxFromSdk(runtimeInstance?.getBounds?.());
    const bounds = sdkBounds ?? getValidatedObjectBounds(loadedObject, sceneRef.current);
    const snapshot = bounds
      ? buildBoundsFitSnapshot(camera, bounds, sdkBounds ? "sdkBounds" : "bounds")
      : null;
    if (!snapshot) {
      return false;
    }

    applyCameraSnapshot(camera, snapshot, controlsRef.current);
    return true;
  };

  useImperativeHandle(
    ref,
    () => ({
      fitView: () => {
        if (!fitCurrentView()) {
          logLccWarn("fitView 暂无可复用的已加载对象，当前版本跳过执行");
        }
      },
      resetView: () => {
        const camera = cameraRef.current;
        if (camera && defaultViewRef.current) {
          applyCameraSnapshot(camera, defaultViewRef.current, controlsRef.current);
          return;
        }

        if (!fitCurrentView()) {
          logLccWarn("resetView 暂无默认视角快照，也无法执行 bounds fit");
        }
      },
    }),
    [],
  );

  useEffect(() => {
    let effectDisposed = false;
    let isFailed = false;
    let rafLogged = false;
    const loadId = globalLoadSequence + 1;
    globalLoadSequence = loadId;
    activeGlobalLoadId = loadId;
    isDisposedRef.current = false;
    let removeResizeListeners = () => {};

    const isStaleRequest = () =>
      effectDisposed ||
      isDisposedRef.current ||
      activeGlobalLoadId !== loadId ||
      currentEntryUrlRef.current !== entryUrl;

    const isActiveLoadOwner = () => activeGlobalLoadId === loadId;

    const stopLoop = (force = false) => {
      if (!force && !isActiveLoadOwner()) return;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const unloadCurrentInstance = (reason: string) => {
      const lccRender = lccRenderRef.current;
      const currentLccInstance = lccInstanceRef.current;
      const entryUrlAtUnload = activeInstanceEntryUrlRef.current;
      const formatAtUnload = activeFormatRef.current;
      if (!lccRender?.unload || !currentLccInstance) return false;

      try {
        lccRender.unload?.(currentLccInstance);
        logLccDebug("同步执行 LCCRender.unload(instance)", {
          reason,
          dataPath: entryUrlAtUnload,
          format: formatAtUnload,
        });
      } catch (error) {
        logLccWarn("LCCRender.unload(instance) 执行失败", error);
      }

      if (formatAtUnload) {
        previousFormatRef.current = formatAtUnload;
        lastSdkFormat = formatAtUnload;
      }
      lccInstanceRef.current = null;
      activeInstanceEntryUrlRef.current = null;
      activeFormatRef.current = null;
      return true;
    };

    const resetSdkForFormatSwitch = ({
      previousFormat,
      currentFormat,
    }: {
      previousFormat: SupportedLccFormat | null;
      currentFormat: SupportedLccFormat;
    }) => {
      const didUnloadPreviousInstance = unloadCurrentInstance("before-new-load");
      let didDisposeForFormatSwitch = false;
      const didSwitchFormat = Boolean(previousFormat && previousFormat !== currentFormat);
      const lccRender = lccRenderRef.current ?? resolveLccRender();

      if (didSwitchFormat && lccRender?.dispose) {
        try {
          lccRender.dispose();
          didDisposeForFormatSwitch = true;
          lccRenderRef.current = null;
          logLccDebug("格式切换前执行 LCCRender.dispose()", {
            previousFormat,
            currentFormat,
          });
        } catch (error) {
          logLccWarn("LCCRender.dispose() 执行失败", error);
        }
      }

      return {
        didUnloadPreviousInstance,
        didDisposeForFormatSwitch,
      };
    };

    const disposeControls = () => {
      controlsRef.current?.dispose();
      controlsRef.current = null;
    };

    const disposeRenderer = () => {
      const currentRenderer = rendererRef.current;
      if (!currentRenderer) return;
      currentRenderer.dispose();
      const canvas = currentRenderer.domElement;
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      rendererRef.current = null;
    };

    const cleanup = (reason: string) => {
      isDisposedRef.current = true;
      stopLoop(true);
      removeResizeListeners();
      disposeControls();
      if (isActiveLoadOwner()) {
        currentEntryUrlRef.current = null;
        unloadCurrentInstance(reason);
      } else {
        logLccDebug("跳过非当前全局 loadId 的 SDK cleanup，仅清理本地 Three 资源", {
          loadId,
          activeGlobalLoadId,
          reason,
        });
      }
      disposeRenderer();
      cameraRef.current = null;
      sceneRef.current = null;
      lastLoadedObjectRef.current = null;
      defaultViewRef.current = null;
      if (mountRef.current) {
        mountRef.current.replaceChildren();
      }
    };

    if (processingBlocked) {
      cleanup("processing-blocked");
      setViewerStatus("idle");
      setProgress(0);
      return () => {
        effectDisposed = true;
        isDisposedRef.current = true;
      };
    }

    if (!resolvedSourceUrl) {
      cleanup("missing-source-url");
      setViewerStatus("error");
      setProgress(0);
      logLccError("未配置 LCC 模型地址");
      return () => {
        effectDisposed = true;
        isDisposedRef.current = true;
      };
    }

    const initializeViewer = async () => {
      currentEntryUrlRef.current = entryUrl;
      lastProgressLogRef.current = null;
      lastLoadedObjectRef.current = null;
      defaultViewRef.current = null;
      setViewerStatus("loading");
      setProgress(0);
      const isLcc2 = lccFormat === "lcc2";
      const useLcc2 = isLcc2;
      const currentFormat: SupportedLccFormat = useLcc2 ? "lcc2" : "lcc";
      const previousFormat = previousFormatRef.current ?? lastSdkFormat;
      previousFormatRef.current = previousFormat;
      const { didUnloadPreviousInstance, didDisposeForFormatSwitch } = resetSdkForFormatSwitch({
        previousFormat,
        currentFormat,
      });

      if (dataExtension === "zip") {
        cleanup("zip-data-path");
        setViewerStatus("error");
        setProgress(0);
        logLccError("检测到错误的 ZIP dataPath", {
          resolvedSourceUrl,
          entryUrl,
        });
        return;
      }

      if (!isEntryFileDataPath) {
        cleanup("non-entry-url");
        setViewerStatus("error");
        setProgress(0);
        logLccError("检测到非入口文件 URL，已阻止目录模式 dataPath", {
          modelUrl: normalizedModelUrl || null,
          viewerUrl: normalizedViewerUrl || null,
          fileFormat: fileFormat ?? null,
          formatSource: lccFormatDecision.source,
          entryUrl,
          dataPath: entryUrl,
          useLcc2,
          isEntryFileUrl: false,
        });
        return;
      }

      try {
        await probeDataPath(entryUrl);
        const lccRender = await ensureLccRender();
        if (isStaleRequest()) return;

        lccRenderRef.current = lccRender;
        logLccDebug("SDK 状态", {
          sdkScriptUrl: LCC_WEB_UMD_URL,
          hasWindowLCC: Boolean(window.LCC),
          hasWindowLccRender: Boolean(window.LCC?.LCCRender),
        });

        const mountElement = mountRef.current;
        if (!mountElement) {
          throw new Error("LCC 渲染容器不存在");
        }

        const width = Math.max(mountElement.clientWidth, 1);
        const height = Math.max(mountElement.clientHeight, 1);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#050b12");
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 20000);
        camera.position.copy(OFFICIAL_CAMERA_POSITION);
        camera.up.copy(OFFICIAL_CAMERA_UP);
        camera.lookAt(OFFICIAL_CAMERA_TARGET);
        cameraRef.current = camera;

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
        directionalLight.position.set(4, 6, 8);
        scene.add(ambientLight, directionalLight);

        const currentRenderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        rendererRef.current = currentRenderer;
        currentRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        currentRenderer.setSize(width, height, false);
        currentRenderer.outputColorSpace = THREE.SRGBColorSpace;
        currentRenderer.domElement.className = "h-full w-full";
        mountElement.replaceChildren(currentRenderer.domElement);
        logLccDebug("Three 初始化结果", {
          hasCanvas: Boolean(currentRenderer.domElement),
          hasRenderer: Boolean(currentRenderer),
          canvasWidth: currentRenderer.domElement.width,
          canvasHeight: currentRenderer.domElement.height,
          devicePixelRatio: window.devicePixelRatio || 1,
        });

        const controls = new OrbitControls(camera, currentRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        controls.target.copy(OFFICIAL_CAMERA_TARGET);
        controls.update();
        controlsRef.current = controls;

        const syncSize = () => {
          if (!mountRef.current || !rendererRef.current) return;
          const nextWidth = Math.max(mountRef.current.clientWidth, 1);
          const nextHeight = Math.max(mountRef.current.clientHeight, 1);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          rendererRef.current.setSize(nextWidth, nextHeight, false);
          controlsRef.current?.update();
        };

        if (typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current = new ResizeObserver(syncSize);
          resizeObserverRef.current.observe(mountElement);
        }
        window.addEventListener("resize", syncSize);
        removeResizeListeners = () => {
          resizeObserverRef.current?.disconnect();
          resizeObserverRef.current = null;
          window.removeEventListener("resize", syncSize);
        };

        const baseLoadParams: LccLoadParams = {
          camera,
          scene,
          dataPath: entryUrl,
          renderLib: THREE,
          canvas: currentRenderer.domElement,
          renderer: currentRenderer,
          useEnv: true,
          useIndexDB: true,
          useLoadingEffect: true,
          modelMatrix: OFFICIAL_MODEL_MATRIX.clone(),
        };

        const finalLoadParams = buildLccLoadParams({
          baseParams: baseLoadParams,
          useLcc2,
        });

        logLccDebug("LCCRender.load 前参数", {
          loadId,
          modelUrl: normalizedModelUrl || null,
          viewerUrl: normalizedViewerUrl || null,
          entryUrl,
          dataPath: finalLoadParams.dataPath,
          fileFormat: fileFormat ?? null,
          formatSource: lccFormatDecision.source,
          previousFormat,
          currentFormat,
          sourceExtension: dataExtension,
          isEntryFileUrl: isEntryFileDataPath,
          viewerType: viewerType ?? null,
          didUnloadPreviousInstance,
          didDisposeForFormatSwitch,
          hasLcc2SpecificParams:
            finalLoadParams.maxConcurrentDownloads !== undefined ||
            finalLoadParams.workerPerFrameRequests !== undefined ||
            finalLoadParams.enableLoadingLog !== undefined,
          ...getFormatSpecificLoadLogFields(currentFormat, finalLoadParams),
        });

        const nextLccInstance = lccRender.load(
          finalLoadParams,
          (mesh) => {
            if (isStaleRequest() || isFailed) return;
            setProgress(1);
            setViewerStatus("loaded");
            logLccDebug("onLoaded 原始回调内容", mesh);
            const loadedObject = isThreeObject3D(mesh) ? mesh : null;
            lastLoadedObjectRef.current = loadedObject;

            void (async () => {
              const runtimeInstance = getRuntimeInstance(lccInstanceRef.current);
              logLcc2RuntimeDiagnostics({
                lccRender,
                runtimeInstance,
                currentFormat,
              });
              const sdkBounds = createBoundsBoxFromSdk(runtimeInstance?.getBounds?.());
              const objectBounds = loadedObject ? getValidatedObjectBounds(loadedObject, scene) : null;
              const activeBounds = sdkBounds ?? objectBounds;
              const boundsSummary = activeBounds ? createBoundsSummary(activeBounds) : null;
              const boundsSource = sdkBounds ? "sdkBounds" : "threeBounds";
              const boundsFallbackSnapshot = activeBounds
                ? buildBoundsFitSnapshot(camera, activeBounds, sdkBounds ? "sdkBounds" : "bounds")
                : null;
              const boundsCenterHomeView = activeBounds
                ? buildBoundsCenterHomeView({
                    camera,
                    bounds: activeBounds,
                    boundsSource,
                  })
                : null;
              const spawnPointResult = await loadLccSpawnPointSnapshot(
                entryUrl,
                currentFormat,
                activeBounds,
              );
              if (isStaleRequest() || isFailed) return;

              let resolvedSnapshot =
                platformDefaultCameraSnapshot ??
                boundsCenterHomeView?.snapshot ??
                null;
              let usedBoundsFallback = false;
              let source: DefaultViewSource | null =
                platformDefaultCameraSnapshot?.source ??
                boundsCenterHomeView?.snapshot?.source ??
                null;

              if (!resolvedSnapshot && boundsFallbackSnapshot) {
                resolvedSnapshot = boundsFallbackSnapshot;
                usedBoundsFallback = true;
                source = boundsFallbackSnapshot.source;
              }

              if (resolvedSnapshot) {
                applyCameraSnapshot(camera, resolvedSnapshot, controlsRef.current);
                defaultViewRef.current = resolvedSnapshot;
              } else {
                defaultViewRef.current = null;
              }

              if (!loadedObject) {
                logLccWarn("onLoaded 返回值不是 Three Object3D，无法使用 Three bounds 作为兜底", mesh);
              }

              const resolution: DefaultViewResolution = {
                snapshot: resolvedSnapshot,
                usedBoundsFallback,
                boundsSummary,
                boundsSource: boundsCenterHomeView?.boundsSource ?? (activeBounds ? boundsSource : null),
              };

              logLccDebug("默认视角解析结果", {
                format: currentFormat,
                useLcc2,
                defaultViewSource:
                  platformDefaultCameraSnapshot
                    ? "defaultCamera"
                    : boundsCenterHomeView?.snapshot
                      ? "boundsCenterHomeView"
                    : source === "boundsCenterHomeView"
                      ? "boundsCenterHomeView"
                      : "bounds",
                hasPlatformDefaultCameraJson: Boolean(platformDefaultCameraSnapshot),
                boundsSource: resolution.boundsSource,
                center: boundsCenterHomeView?.center ?? null,
                size: boundsCenterHomeView?.size ?? null,
                maxDim: boundsCenterHomeView?.maxDim ?? null,
                distance: boundsCenterHomeView?.distance ?? null,
                usedBoundsFallback: resolution.usedBoundsFallback,
                spawnPointDiagnostic: {
                  attrsPath: spawnPointResult.attrsPath,
                  rawPosition: spawnPointResult.rawPosition,
                  rawRotation: spawnPointResult.rawRotation,
                  skippedRotation: spawnPointResult.skippedRotation,
                  fallbackReason: spawnPointResult.fallbackReason,
                  resolvedPosition: spawnPointResult.resolvedPosition,
                },
                bounds: resolution.boundsSummary,
                cameraPosition: boundsCenterHomeView?.cameraPosition ?? camera.position.toArray(),
                target: boundsCenterHomeView?.target ?? controlsRef.current?.target.toArray() ?? null,
                up: boundsCenterHomeView?.up ?? camera.up.toArray(),
                resetViewSource: resolution.snapshot?.source ?? null,
                hasMeta: Boolean(runtimeInstance?.getMeta?.()),
                skippedSpawnPointRotation: Boolean(spawnPointResult.rawRotation),
              });
            })();
          },
          (rawProgress) => {
            if (isStaleRequest() || isFailed) return;
            const nextProgress = clampProgress(
              typeof rawProgress === "number" ? rawProgress : Number(rawProgress),
            );
            setProgress(nextProgress);
            setViewerStatus("loading");
            const progressLogKey = getProgressLogKey(nextProgress);
            if (lastProgressLogRef.current !== progressLogKey) {
              lastProgressLogRef.current = progressLogKey;
              logLccDebug("onProgress 原始回调内容", rawProgress);
            }
          },
          (error) => {
            if (isStaleRequest()) return;
            isFailed = true;
            stopLoop();
            setViewerStatus("error");
            const failureMessage =
              error instanceof Error
                ? `模型加载失败：${error.message}`
                : "模型加载失败，请检查控制台日志和资源可访问性";
            logLccError("onFailed 原始错误内容", error);
            logLccError("onFailed 归一化错误信息", failureMessage);
          },
        );

        if (!nextLccInstance) {
          throw new Error("LCC 模型启动失败");
        }

        lccInstanceRef.current = nextLccInstance;
        activeInstanceEntryUrlRef.current = entryUrl;
        activeFormatRef.current = currentFormat;
        previousFormatRef.current = currentFormat;
        lastSdkFormat = currentFormat;

        const renderFrame = () => {
          if (isStaleRequest() || isFailed || !rendererRef.current) return;
          if (!rafLogged) {
            rafLogged = true;
            logLccDebug("requestAnimationFrame 已启动，LCCRender.update() 将持续执行");
          }
          animationFrameRef.current = window.requestAnimationFrame(renderFrame);
          try {
            controlsRef.current?.update();
            lccRender.update();
            rendererRef.current.render(scene, camera);
          } catch (error) {
            isFailed = true;
            stopLoop();
            setViewerStatus("error");
            const nextError =
              error instanceof Error
                ? `渲染失败：${error.message}`
                : "WebGL / Three 初始化失败";
            logLccError("渲染循环执行失败", error);
            logLccError("渲染循环归一化错误信息", nextError);
          }
        };

        renderFrame();
      } catch (error) {
        if (isStaleRequest()) return;
        cleanup("initialize-failed");
        const message =
          error instanceof Error ? error.message : "WebGL / Three 初始化失败";
        setViewerStatus("error");
        setProgress(0);
        logLccError("初始化失败", error);
        logLccError("初始化归一化错误信息", message);
      }
    };

    void initializeViewer();

    return () => {
      effectDisposed = true;
      cleanup("effect-cleanup");
    };
  }, [
    dataExtension,
    entryUrl,
    fileFormat,
    isEntryFileDataPath,
    lccFormat,
    lccFormatDecision.source,
    normalizedModelUrl,
    platformDefaultCameraSnapshot,
    normalizedViewerUrl,
    processingBlocked,
    resolvedSourceUrl,
    retrySeed,
    viewerType,
  ]);

  const showOverlay = processingBlocked || viewerStatus !== "loaded";
  const overlayStatus = processingBlocked
    ? "info"
    : viewerStatus === "error"
      ? "error"
      : "loading";
  const overlayTitle = processingBlocked
    ? "模型处理中"
    : viewerStatus === "error"
      ? "模型加载失败"
      : "模型加载中";
  const overlayDescription = processingBlocked
    ? processingHint || "请稍候"
    : viewerStatus === "error"
      ? "请刷新后重试"
      : "正在载入三维场景";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.14),transparent_32%),linear-gradient(135deg,#07111a_0%,#071826_45%,#04070c_100%)]">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/10 to-transparent" />
      <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-cyan-400/35" />
      <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-cyan-400/35" />
      <div className="pointer-events-none absolute bottom-14 left-4 h-5 w-5 border-b border-l border-cyan-400/35" />
      <div className="pointer-events-none absolute bottom-14 right-4 h-5 w-5 border-b border-r border-cyan-400/35" />

      <ModelLoadingOverlay
        visible={showOverlay}
        status={overlayStatus}
        progress={progress}
        title={overlayTitle}
        description={overlayDescription}
        onRetry={
          !processingBlocked && viewerStatus === "error"
            ? () => setRetrySeed((value) => value + 1)
            : undefined
        }
      />
    </div>
  );
});
