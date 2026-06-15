"use client";

/**
 * 组件名称：LccViewer
 * 组件用途：统一承接 LCC / LCC2 浏览器容器，当前阶段已接入 Three.js + LCC Web SDK 的最小真实加载链路。
 * 说明：详情页只负责传入模型信息；LCC / LCC2 的 SDK 初始化、进度显示、尺寸同步与安全清理均在本组件内处理。
 * 当前规则：LCCRender.load 的 dataPath 始终传 .lcc / .lcc2 入口文件 URL，不再使用目录模式。
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ModelLoadingOverlay } from "@/components/models/model-loading-overlay";
import type {
  ModelViewerControlMode,
  ModelViewerHandle,
  ModelViewerMovementInput,
} from "@/components/models/viewers/types";
import type { LaunchViewSaveResult, ModelLaunchView } from "@/lib/types";

const LCC_WEB_VERSION = "0.6.0";
const LCC_WEB_UMD_URL = `/vendor/lcc-web/${LCC_WEB_VERSION}/lcc-${LCC_WEB_VERSION}.umd.js`;
const IS_DEV = process.env.NODE_ENV !== "production";
const LCC_APP_KEY = process.env.NEXT_PUBLIC_LCC_APP_KEY?.trim();
const LCC_STABLE_RESOURCE_WINDOW_MS = 500;
const LCC_STABLE_FRAME_THRESHOLD = 3;
const LCC_ONLOADED_FALLBACK_MS = 5000;
const LCC_WATERMARK_CROP_PX = 8;
const LCC_WATERMARK_BOTTOM_BAR_PX = 16;
const RELEVANT_LCC_RESOURCE_PATH_RE =
  /(?:\.lcc2?|\/index\.bin|\/environment\.bin|\/collision\.lci|\/attrs\.lcp)(?:$|\?)/i;

interface LccLoadParams {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  dataPath: string;
  renderLib: typeof THREE;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  appKey?: string;
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
  | "launchView"
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
  launchView?: ModelLaunchView | null;
  defaultCameraJson?: string | null;
  processingBlocked?: boolean;
  /** 控制模式：orbit=轨道观察（默认），walk=漫游（FPS） */
  controlMode?: ModelViewerControlMode;
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
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const OFFICIAL_VIEW_DIRECTION = OFFICIAL_CAMERA_TARGET.clone()
  .sub(OFFICIAL_CAMERA_POSITION)
  .normalize();
const EMPTY_MOVEMENT_INPUT: ModelViewerMovementInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

// 交互体验参数（2026-06-09 优化）
const ORBIT_DAMPING_FACTOR = 0.15;
const ORBIT_ROTATE_SPEED = 0.50;
const ORBIT_PAN_SPEED = 0.60;
const ORBIT_ZOOM_SPEED = 0.50;
// 漫游模式：左键原地转头灵敏度与俯仰角限制
const WALK_LOOK_SENSITIVITY = 0.002;
// 漫游 Fly 基础移动系数（相对原 0.002 累计降速；Shift 2x 仍由 moveSpeedMultiplier 叠加，倍率不变）
const WALK_MOVEMENT_DIM_FACTOR = 0.000588;
const WALK_PITCH_MIN = THREE.MathUtils.degToRad(-85);
const WALK_PITCH_MAX = THREE.MathUtils.degToRad(85);
const WALK_EULER_ORDER = "YXZ" as const;
const _walkEuler = new THREE.Euler(0, 0, 0, WALK_EULER_ORDER);

function hasMovementInput(input: ModelViewerMovementInput) {
  return input.forward || input.backward || input.left || input.right || input.up || input.down;
}

/** 从当前 camera.quaternion 提取 yaw/pitch，供漫游模式初始化 */
function syncYawPitchFromCamera(
  camera: THREE.PerspectiveCamera,
  yawRef: { current: number },
  pitchRef: { current: number },
) {
  _walkEuler.setFromQuaternion(camera.quaternion, WALK_EULER_ORDER);
  yawRef.current = _walkEuler.y;
  pitchRef.current = _walkEuler.x;
}

/** 根据 yaw/pitch 更新 camera.quaternion，相机在当前位置原地转头 */
function applyYawPitchToCamera(
  camera: THREE.PerspectiveCamera,
  yaw: number,
  pitch: number,
) {
  _walkEuler.set(pitch, yaw, 0, WALK_EULER_ORDER);
  camera.quaternion.setFromEuler(_walkEuler);
  camera.up.copy(WORLD_UP);
  camera.updateMatrixWorld(true);
}

/** 漫游模式下仅同步 OrbitControls.target，不调用 controls.update，避免 target 反控相机 */
function syncWalkControlsTarget(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  distance = 10,
) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  controls.target.copy(camera.position).add(forward.multiplyScalar(distance));
}

/** 漫游模式（Fly）移动基向量：W/S 沿完整视线方向，A/D 沿屏幕左右 */
function getWalkMovementBasis(camera: THREE.PerspectiveCamera) {
  camera.updateMatrixWorld(true);

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.normalize();

  const right = new THREE.Vector3();
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();

  return { forward, right };
}

/** 从漫游模式切回观察模式时，根据当前视线重建 OrbitControls.target */
function syncOrbitTargetFromCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const previousDistance = camera.position.distanceTo(controls.target);
  const distance = previousDistance > 0.5 ? previousDistance : 10;
  controls.target.copy(camera.position).add(forward.multiplyScalar(distance));
  controls.update();
}

function logLccDebug(_message: string, _payload?: unknown) {
  if (!IS_DEV) return;
}

function logLccError(_message: string, _payload?: unknown) {
  if (!IS_DEV) return;
}

function logLccWarn(_message: string, _payload?: unknown) {
  if (!IS_DEV) return;
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

function doesCanvasLookPainted(canvas: HTMLCanvasElement) {
  try {
    const sampleWidth = Math.min(canvas.width, 32);
    const sampleHeight = Math.min(canvas.height, 32);
    if (sampleWidth <= 0 || sampleHeight <= 0) return false;
    const offscreen = document.createElement("canvas");
    offscreen.width = sampleWidth;
    offscreen.height = sampleHeight;
    const context = offscreen.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (alpha > 0 || red > 8 || green > 8 || blue > 8) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
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

/** 将 SDK 本地 bounds 变换到与 OFFICIAL_MODEL_MATRIX 一致的世界空间，避免相机对准错误坐标系。 */
function createWorldBoundsBoxFromSdk(bounds: LccBoundsLike | null | undefined) {
  const localBox = createBoundsBoxFromSdk(bounds);
  if (!localBox) {
    return null;
  }

  const worldBox = localBox.clone();
  worldBox.applyMatrix4(OFFICIAL_MODEL_MATRIX);
  return createBoundsSummary(worldBox) ? worldBox : null;
}

function resolveBoundsForCameraFit(args: {
  loadedObject: THREE.Object3D | null;
  scene: THREE.Scene | null;
  sdkBounds: LccBoundsLike | null | undefined;
}): {
  bounds: THREE.Box3 | null;
  source: "threeBounds" | "sdkBounds" | null;
} {
  const { loadedObject, scene, sdkBounds } = args;

  if (loadedObject) {
    const objectBounds = getValidatedObjectBounds(loadedObject, scene);
    if (objectBounds) {
      return { bounds: objectBounds, source: "threeBounds" as const };
    }
  }

  const worldSdkBounds = createWorldBoundsBoxFromSdk(sdkBounds);
  if (worldSdkBounds) {
    return { bounds: worldSdkBounds, source: "sdkBounds" as const };
  }

  const rawSdkBounds = createBoundsBoxFromSdk(sdkBounds);
  if (rawSdkBounds) {
    return { bounds: rawSdkBounds, source: "sdkBounds" as const };
  }

  return { bounds: null, source: null };
}

function sanitizeMaxDim(maxDim: number) {
  if (!Number.isFinite(maxDim) || maxDim < 1e-6) {
    return 10;
  }
  return maxDim;
}

function computeFitCameraPlanes(maxDim: number, distance: number, radius: number) {
  const safeMaxDim = sanitizeMaxDim(maxDim);
  const safeRadius = Number.isFinite(radius) && radius > 1e-6 ? radius : safeMaxDim / 2;
  return {
    near: Math.max(safeMaxDim / 10000, distance / 500, safeRadius / 200, 0.01),
    far: Math.max(safeMaxDim * 100, distance + safeRadius * 12, 10000),
  };
}

function applyCameraSnapshot(
  camera: THREE.PerspectiveCamera,
  snapshot: CameraSnapshot,
  controls?: OrbitControls | null,
  options?: { updateControls?: boolean },
) {
  camera.position.set(...snapshot.position);
  camera.up.set(...snapshot.up);
  camera.near = snapshot.near;
  camera.far = snapshot.far;
  camera.lookAt(...snapshot.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  if (!controls) {
    return;
  }

  controls.target.set(...snapshot.target);
  const distance = camera.position.distanceTo(controls.target);
  controls.minDistance = Math.max(distance * 0.1, 0.5);
  controls.maxDistance = Math.max(distance * 8, 50);

  if (options?.updateControls === false) {
    return;
  }

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
  const maxDim = sanitizeMaxDim(Math.max(size.x, size.y, size.z));
  const sphere = getBoundsSphere(bounds);
  const radius = Math.max(
    Number.isFinite(sphere.radius) && sphere.radius > 1e-6 ? sphere.radius : 0,
    maxDim / 2,
    1,
  );
  const fovInRadians = THREE.MathUtils.degToRad(camera.fov);
  const fitDistance = maxDim / (2 * Math.tan(fovInRadians / 2));
  const distance = Math.max(fitDistance * 1.2, maxDim * 1.5, radius * 2.4, 6);
  const offsetDirection = new THREE.Vector3(1, 0.6, 1).normalize();
  const position = center.clone().add(offsetDirection.multiplyScalar(distance));
  const planes = computeFitCameraPlanes(maxDim, distance, radius);

  return {
    position: position.toArray() as [number, number, number],
    target: center.toArray() as [number, number, number],
    up: OFFICIAL_CAMERA_UP.toArray() as [number, number, number],
    near: planes.near,
    far: planes.far,
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
  const size = bounds.getSize(new THREE.Vector3());
  const maxDim = sanitizeMaxDim(Math.max(size.x, size.y, size.z));
  const radius = Math.max(
    Number.isFinite(sphere.radius) && sphere.radius > 1e-6 ? sphere.radius : 0,
    maxDim / 2,
    1,
  );
  const planes = computeFitCameraPlanes(maxDim, distance, radius);

  return {
    position: position.toArray() as [number, number, number],
    target: target.toArray() as [number, number, number],
    up: up.clone().normalize().toArray() as [number, number, number],
    near: planes.near,
    far: planes.far,
    source,
  } satisfies CameraSnapshot;
}

function cloneMovementInput(input: ModelViewerMovementInput): ModelViewerMovementInput {
  return {
    forward: input.forward,
    backward: input.backward,
    left: input.left,
    right: input.right,
    up: input.up,
    down: input.down,
  };
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

function parseLaunchViewSnapshot(launchView: ModelLaunchView | null | undefined) {
  if (!launchView || launchView.version !== 1 || launchView.viewerKind !== "lcc") {
    return null;
  }

  const position = toVectorTuple(launchView.snapshot?.position);
  const target = toVectorTuple(launchView.snapshot?.target);
  const up = toVectorTuple(launchView.snapshot?.up);
  const near = launchView.snapshot?.near;
  const far = launchView.snapshot?.far;

  if (
    !position ||
    !target ||
    !up ||
    !isFiniteNumber(near) ||
    !isFiniteNumber(far) ||
    near <= 0 ||
    far <= 0 ||
    far < near
  ) {
    return null;
  }

  return {
    position,
    target,
    up,
    near,
    far,
    source: "launchView" as const,
  } satisfies CameraSnapshot;
}

const LAUNCH_VIEW_CAMERA_INVALID_MESSAGE = "当前相机状态无效，请调整视角后重试。";

function sanitizeLaunchViewPlanes(near: number, far: number, maxDim: number) {
  const safeMaxDim = sanitizeMaxDim(maxDim);
  return {
    near: Math.max(
      Number.isFinite(near) ? near : 0,
      safeMaxDim / 10000,
      0.01,
    ),
    far: Math.max(
      Number.isFinite(far) ? far : 0,
      safeMaxDim * 100,
      10000,
    ),
  };
}

/** walk 模式保存启动视图：从相机四元数实时计算 target，不使用 controls.target */
function computeWalkLaunchViewTarget(
  camera: THREE.PerspectiveCamera,
  maxDim: number,
) {
  const focusDistance = Math.max(sanitizeMaxDim(maxDim) * 0.8, 10);
  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(camera.quaternion)
    .normalize();
  return camera.position.clone().addScaledVector(forward, focusDistance);
}

function buildLaunchViewForSave(args: {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls | null;
  controlMode: ModelViewerControlMode;
  maxDim: number;
}): ModelLaunchView | null {
  const { camera, controls, controlMode, maxDim } = args;
  if (!controls) {
    return null;
  }

  let targetVector: THREE.Vector3 | null = null;
  if (controlMode === "walk") {
    // walk 模式：controls.target 已过期，从 camera.quaternion 实时计算 target
    targetVector = computeWalkLaunchViewTarget(camera, maxDim);
  } else {
    // orbit 模式：直接使用 controls.target，OrbitControls 在旋转/缩放时已自行维护
    targetVector = controls.target.clone();
  }

  if (!targetVector) {
    return null;
  }

  const position = camera.position.toArray();
  const targetArray = targetVector.toArray();
  const up = camera.up.toArray();
  const planes = sanitizeLaunchViewPlanes(camera.near, camera.far, maxDim);

  if (
    !position.every((value) => Number.isFinite(value)) ||
    !targetArray.every((value) => Number.isFinite(value)) ||
    !up.every((value) => Number.isFinite(value)) ||
    planes.far <= planes.near
  ) {
    return null;
  }

  return {
    version: 1,
    viewerKind: "lcc",
    snapshot: {
      position: position as [number, number, number],
      target: targetArray as [number, number, number],
      up: up as [number, number, number],
      near: planes.near,
      far: planes.far,
    },
  };
}

function validateLaunchViewForSave(
  view: ModelLaunchView,
): string | null {
  const position = toVectorTuple(view.snapshot.position);
  const target = toVectorTuple(view.snapshot.target);
  const up = toVectorTuple(view.snapshot.up);
  const { near, far } = view.snapshot;

  if (!position || !target || !up) {
    return LAUNCH_VIEW_CAMERA_INVALID_MESSAGE;
  }

  if (
    !isFiniteNumber(near) ||
    !isFiniteNumber(far) ||
    near <= 0 ||
    far <= 0 ||
    far <= near
  ) {
    return LAUNCH_VIEW_CAMERA_INVALID_MESSAGE;
  }

  const targetDistance = new THREE.Vector3(...position).distanceTo(
    new THREE.Vector3(...target),
  );
  if (!Number.isFinite(targetDistance) || targetDistance < 0.01) {
    return LAUNCH_VIEW_CAMERA_INVALID_MESSAGE;
  }

  return null;
}

function isCameraLikelySeeingBounds(
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3 | null,
) {
  if (!bounds || bounds.isEmpty()) {
    return true;
  }

  const sphere = getBoundsSphere(bounds);
  const distanceToCenter = camera.position.distanceTo(sphere.center);
  if (distanceToCenter > camera.far || distanceToCenter < camera.near) {
    return false;
  }

  const toCenter = sphere.center.clone().sub(camera.position);
  if (toCenter.lengthSq() <= 1e-8) {
    return true;
  }
  toCenter.normalize();

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const angle = forward.angleTo(toCenter);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const angularRadius = Math.atan(sphere.radius / Math.max(distanceToCenter, 1e-3));
  return angle <= halfFov + angularRadius + 0.35;
}

function captureCameraPose(camera: THREE.PerspectiveCamera) {
  return {
    position: camera.position.toArray() as [number, number, number],
    quaternion: camera.quaternion.toArray() as [number, number, number, number],
    up: camera.up.toArray() as [number, number, number],
    near: camera.near,
    far: camera.far,
  };
}

function restoreCameraPose(
  camera: THREE.PerspectiveCamera,
  pose: ReturnType<typeof captureCameraPose>,
) {
  camera.position.set(...pose.position);
  camera.quaternion.set(...pose.quaternion);
  camera.up.set(...pose.up);
  camera.near = pose.near;
  camera.far = pose.far;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function applyLaunchViewSnapshotToCamera(
  camera: THREE.PerspectiveCamera,
  snapshot: CameraSnapshot,
  controls: OrbitControls | null,
  options: {
    controlMode: ModelViewerControlMode;
    maxDim: number;
    updateControls: boolean;
  },
) {
  const planes = sanitizeLaunchViewPlanes(snapshot.near, snapshot.far, options.maxDim);
  camera.position.set(...snapshot.position);
  camera.up.set(...snapshot.up);
  camera.near = planes.near;
  camera.far = planes.far;
  camera.lookAt(...snapshot.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  if (!controls) {
    return;
  }

  controls.target.set(...snapshot.target);
  const distance = camera.position.distanceTo(controls.target);
  controls.minDistance = Math.max(distance * 0.1, 0.5);
  controls.maxDistance = Math.max(distance * 8, 50);

  if (!options.updateControls) {
    return;
  }

  controls.update();
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

function isBoundsBasedDefaultView(source: DefaultViewSource | null | undefined) {
  return (
    source === "bounds" ||
    source === "sdkBounds" ||
    source === "boundsCenterHomeView"
  );
}

function logOnLoadedBoundsDiagnostics(args: {
  loadedObject: THREE.Object3D | null;
  bounds: THREE.Box3 | null;
  boundsSource: "sdkBounds" | "threeBounds" | null;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls | null;
  defaultViewSource: DefaultViewSource | null;
  cameraBeforeFit: [number, number, number];
  cameraAfterFit: [number, number, number];
}) {
  if (!IS_DEV) return;

  const { loadedObject, bounds, boundsSource, camera, controls, defaultViewSource } = args;
  const boxSummary = bounds ? createBoundsSummary(bounds) : null;
  const sphere = bounds ? getBoundsSphere(bounds) : null;
  const objectDiagnostics = loadedObject
    ? {
        visible: loadedObject.visible,
        position: loadedObject.position.toArray(),
        scale: loadedObject.scale.toArray(),
        childrenLength: loadedObject.children.length,
      }
    : null;

  logLccDebug("onLoaded bounds / camera 诊断摘要", {
    defaultViewSource,
    boundsSource,
    group: objectDiagnostics,
    boundingBox: boxSummary
      ? { min: boxSummary.min, max: boxSummary.max, center: boxSummary.center, size: boxSummary.size }
      : null,
    boundingSphere: sphere
      ? { center: sphere.center.toArray(), radius: sphere.radius }
      : null,
    maxDim: boxSummary ? sanitizeMaxDim(Math.max(...boxSummary.size)) : null,
    cameraPositionBeforeFit: args.cameraBeforeFit,
    cameraPositionAfterFit: args.cameraAfterFit,
    cameraNear: camera.near,
    cameraFar: camera.far,
    controlsTarget: controls?.target.toArray() ?? null,
  });
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
  launchView,
  defaultCameraJson,
  processingBlocked = false,
  controlMode = "orbit",
}, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewerRootRef = useRef<HTMLDivElement | null>(null);
  const isDisposedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const lccRenderRef = useRef<LccRenderApi | null>(null);
  const lccInstanceRef = useRef<unknown>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const movementInputRef = useRef<ModelViewerMovementInput>(cloneMovementInput(EMPTY_MOVEMENT_INPUT));
  const moveSpeedMultiplierRef = useRef(1);
  const movementBaseStepRef = useRef(0.08);
  const applyMovementFrameRef = useRef<(deltaSeconds: number) => void>(() => {});
  const fitCurrentViewRef = useRef<() => boolean>(() => false);
  const controlModeRef = useRef<ModelViewerControlMode>(controlMode);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const isLookingRef = useRef(false);
  const lastLookPointerXRef = useRef(0);
  const lastLookPointerYRef = useRef(0);
  const applyControlModeRef = useRef<(mode: ModelViewerControlMode) => void>(() => {});
  const interactionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const isPointerDraggingRef = useRef(false);
  const lastFrameTimeRef = useRef<number | null>(null);
  const canMoveRef = useRef(false);
  const lastLoadedObjectRef = useRef<THREE.Object3D | null>(null);
  const defaultViewRef = useRef<CameraSnapshot | null>(null);
  const currentEntryUrlRef = useRef<string | null>(null);
  const activeInstanceEntryUrlRef = useRef<string | null>(null);
  const activeFormatRef = useRef<SupportedLccFormat | null>(null);
  const previousFormatRef = useRef<SupportedLccFormat | null>(null);
  const lastProgressLogRef = useRef<number | null>(null);
  const lastBoundsMaxDimRef = useRef(10);
  const lastActiveBoundsRef = useRef<THREE.Box3 | null>(null);
  const launchViewPropRef = useRef(launchView);
  const loadingCompletedRef = useRef(false);
  const firstFrameRenderedRef = useRef(false);
  const progressRef = useRef(0);
  const completeReasonRef = useRef<string | null>(null);
  const sdkLoadedRef = useRef(false);
  const sdkLoadedAtRef = useRef<number | null>(null);
  const loadedStableFrameCountRef = useRef(0);
  const initialViewReadyRef = useRef(false);
  const completeCallCountRef = useRef(0);
  const loadStartedAtRef = useRef<number | null>(null);
  const lastProgressAtRef = useRef<number | null>(null);
  const paintedCanvasSeenRef = useRef(false);
  const [viewerStatus, setViewerStatus] = useState<LccViewerStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [sdkLoadedState, setSdkLoadedState] = useState(false);
  const normalizedModelUrl = useMemo(() => modelUrl?.trim() ?? "", [modelUrl]);
  const normalizedViewerUrl = useMemo(() => viewerUrl?.trim() ?? "", [viewerUrl]);
  const normalizedDefaultCameraJson = useMemo(
    () => defaultCameraJson?.trim() ?? "",
    [defaultCameraJson],
  );
  // #region debug-point lcc-stuck-92
  const setDebugAttr = useCallback((name: string, value: string | null) => {
    const root = viewerRootRef.current;
    if (!root) return;
    if (value === null || value === "") {
      root.removeAttribute(name);
      return;
    }
    root.setAttribute(name, value);
  }, []);

  const markDebugEvent = useCallback(
    (event: string, details?: Record<string, unknown>) => {
      setDebugAttr("data-lcc-debug-last-event", event);
      if (!details) return;
      const encoded = Object.entries(details)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join("|")
        .slice(0, 240);
      setDebugAttr("data-lcc-debug-last-details", encoded || null);
    },
    [setDebugAttr],
  );
  // #endregion

  useEffect(() => {
    launchViewPropRef.current = launchView;
  }, [launchView]);

  useEffect(() => {
    progressRef.current = progress;
    // #region debug-point lcc-stuck-92
    setDebugAttr("data-lcc-debug-progress", progress.toFixed(3));
    // #endregion
  }, [progress, setDebugAttr]);

  // #region debug-point lcc-stuck-92
  useEffect(() => {
    setDebugAttr("data-lcc-debug-viewer-status-state", viewerStatus);
  }, [setDebugAttr, viewerStatus]);

  useEffect(() => {
    setDebugAttr("data-lcc-debug-sdk-loaded-state", sdkLoadedState ? "true" : "false");
  }, [sdkLoadedState, setDebugAttr]);
  // #endregion

  const platformDefaultCameraSnapshot = useMemo(
    () => parseDefaultCameraJson(normalizedDefaultCameraJson || null),
    [normalizedDefaultCameraJson],
  );
  const resolvedSourceUrl = useMemo(
    () => normalizedViewerUrl || normalizedModelUrl,
    [normalizedModelUrl, normalizedViewerUrl],
  );
  const entryUrl = useMemo(() => normalizeEntryUrl(resolvedSourceUrl), [resolvedSourceUrl]);
  const entryResourcePathPrefix = useMemo(() => {
    try {
      const url = new URL(entryUrl, "http://localhost");
      const lastSlashIndex = url.pathname.lastIndexOf("/");
      return lastSlashIndex >= 0 ? url.pathname.slice(0, lastSlashIndex + 1) : "";
    } catch {
      return "";
    }
  }, [entryUrl]);
  const dataExtension = useMemo(() => getCleanPathExtension(entryUrl), [entryUrl]);
  const isEntryFileDataPath = useMemo(() => isEntryFileUrl(entryUrl), [entryUrl]);
  const lccFormatDecision = useMemo(
    () => inferLccFormat(resolvedSourceUrl, fileFormat),
    [fileFormat, resolvedSourceUrl],
  );
  const lccFormat = lccFormatDecision.format;

  const resolveCurrentBounds = () => {
    const runtimeInstance = getRuntimeInstance(lccInstanceRef.current);
    const { bounds } = resolveBoundsForCameraFit({
      loadedObject: lastLoadedObjectRef.current,
      scene: sceneRef.current,
      sdkBounds: runtimeInstance?.getBounds?.(),
    });
    return bounds;
  };

  const rememberBoundsContext = (bounds: THREE.Box3 | null) => {
    lastActiveBoundsRef.current = bounds;
    const summary = bounds ? createBoundsSummary(bounds) : null;
    lastBoundsMaxDimRef.current = summary
      ? sanitizeMaxDim(Math.max(...summary.size))
      : lastBoundsMaxDimRef.current;
  };

  const fitCurrentView = () => {
    // 组件已销毁，禁止操作
    if (isDisposedRef.current) {
      logLccDebug("fitCurrentView 被跳过：组件已销毁");
      return false;
    }
    const camera = cameraRef.current;
    if (!camera) {
      return false;
    }

    const runtimeInstance = getRuntimeInstance(lccInstanceRef.current);
    const { bounds, source } = resolveBoundsForCameraFit({
      loadedObject: lastLoadedObjectRef.current,
      scene: sceneRef.current,
      sdkBounds: runtimeInstance?.getBounds?.(),
    });
    const snapshot = bounds
      ? buildBoundsFitSnapshot(camera, bounds, source === "sdkBounds" ? "sdkBounds" : "bounds")
      : null;
    if (!snapshot) {
      return false;
    }

    rememberBoundsContext(bounds);
    applyCameraSnapshot(camera, snapshot, controlsRef.current, {
      updateControls: controlModeRef.current !== "walk",
    });
    const cachedDefaultView = defaultViewRef.current;
    if (!cachedDefaultView || isBoundsBasedDefaultView(cachedDefaultView.source)) {
      defaultViewRef.current = snapshot;
    }
    syncViewerCamera();
    return true;
  };

  // 将 fitCurrentView 存入 ref，供 useEffect 内部异步回调使用（避免依赖数组警告）
  fitCurrentViewRef.current = fitCurrentView;

  const completeViewerLoading = useCallback((reason: string) => {
    if (loadingCompletedRef.current) return;
    loadingCompletedRef.current = true;
    completeCallCountRef.current += 1;
    completeReasonRef.current = reason;
    progressRef.current = 0.98;
    setProgress(0.98);
    setViewerStatus("loaded");
    // #region debug-point lcc-stuck-92
    setDebugAttr("data-lcc-debug-complete-call-count", String(completeCallCountRef.current));
    setDebugAttr("data-lcc-debug-stable-reason", "passed");
    markDebugEvent("completeViewerLoading", { reason });
    // #endregion
    logLccDebug("loading completed, awaiting first frame", { reason });
  }, [markDebugEvent, setDebugAttr]);

  const resolveRelevantResourceStability = useCallback(
    (now: number) => {
      if (typeof performance === "undefined" || !entryResourcePathPrefix) {
        return {
          relevantResourceCount: 0,
          lastRelevantResponseEnd: sdkLoadedAtRef.current,
          isStable: sdkLoadedAtRef.current !== null && now - sdkLoadedAtRef.current >= LCC_STABLE_RESOURCE_WINDOW_MS,
        };
      }

      const resourceEntries = performance
        .getEntriesByType("resource")
        .filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming);

      const relevantEntries = resourceEntries.filter((entry) => {
        try {
          const resourceUrl = new URL(entry.name, window.location.href);
          return (
            resourceUrl.pathname.startsWith(entryResourcePathPrefix) &&
            RELEVANT_LCC_RESOURCE_PATH_RE.test(resourceUrl.pathname)
          );
        } catch {
          return false;
        }
      });

      const lastRelevantResponseEnd = relevantEntries.reduce<number | null>((latest, entry) => {
        if (entry.responseEnd <= 0) return latest;
        return latest === null ? entry.responseEnd : Math.max(latest, entry.responseEnd);
      }, sdkLoadedAtRef.current);

      const stableReferenceTime = lastRelevantResponseEnd ?? sdkLoadedAtRef.current;
      return {
        relevantResourceCount: relevantEntries.length,
        lastRelevantResponseEnd,
        isStable:
          stableReferenceTime !== null && now - stableReferenceTime >= LCC_STABLE_RESOURCE_WINDOW_MS,
      };
    },
    [entryResourcePathPrefix],
  );

  const applyLaunchView = (view: ModelLaunchView, options?: { allowRollback?: boolean }) => {
    // 组件已销毁，禁止操作
    if (isDisposedRef.current) {
      logLccDebug("applyLaunchView 被跳过：组件已销毁");
      return false;
    }
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera) {
      return false;
    }

    const snapshot = parseLaunchViewSnapshot(view);
    if (!snapshot) {
      return false;
    }

    const poseBeforeApply = captureCameraPose(camera);
    const maxDim = lastBoundsMaxDimRef.current;
    applyLaunchViewSnapshotToCamera(camera, snapshot, controls, {
      controlMode: controlModeRef.current,
      maxDim,
      updateControls: controlModeRef.current !== "walk",
    });
    defaultViewRef.current = snapshot;
    if (controlModeRef.current === "walk") {
      syncYawPitchFromCamera(camera, yawRef, pitchRef);
      if (controls) {
        syncWalkControlsTarget(camera, controls);
      }
    }
    syncViewerCamera();

    const bounds = lastActiveBoundsRef.current ?? resolveCurrentBounds();
    if (
      options?.allowRollback !== false &&
      !isCameraLikelySeeingBounds(camera, bounds)
    ) {
      restoreCameraPose(camera, poseBeforeApply);
      if (controlModeRef.current === "walk") {
        syncYawPitchFromCamera(camera, yawRef, pitchRef);
        if (controls) {
          syncWalkControlsTarget(camera, controls);
        }
      } else if (controls) {
        syncOrbitTargetFromCamera(camera, controls);
      }
      syncViewerCamera();
      logLccWarn("应用启动视图后模型不可见，已回滚到应用前相机状态", {
        launchView: view,
      });
      return false;
    }

    return true;
  };

  const buildLaunchViewSaveResult = (): LaunchViewSaveResult => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return { ok: false, message: "当前视角暂不支持保存" };
    }

    const maxDim = lastBoundsMaxDimRef.current;
    const controlMode = controlModeRef.current;

    logLccDebug("保存启动视图前诊断", {
      controlMode,
      cameraPosition: camera.position.toArray(),
      cameraQuaternion: camera.quaternion.toArray(),
      cameraNear: camera.near,
      cameraFar: camera.far,
      controlsTarget: controls.target.toArray(),
      maxDim,
    });

    const view = buildLaunchViewForSave({
      camera,
      controls,
      controlMode,
      maxDim,
    });
    if (!view) {
      return { ok: false, message: LAUNCH_VIEW_CAMERA_INVALID_MESSAGE };
    }

    const validationError = validateLaunchViewForSave(view);
    if (validationError) {
      return { ok: false, message: validationError };
    }

    logLccDebug("保存启动视图 payload", {
      controlMode,
      position: view.snapshot.position,
      target: view.snapshot.target,
      up: view.snapshot.up,
      near: view.snapshot.near,
      far: view.snapshot.far,
      fov: camera.fov,
    });

    return { ok: true, view };
  };

  const setMovementBaseStep = (maxDim: number | null) => {
    const safeMaxDim = Number.isFinite(maxDim) && maxDim && maxDim > 0 ? maxDim : 20;
    // 基础移动步长 = maxDim * WALK_MOVEMENT_DIM_FACTOR，配合 frameScale 直接平移
    movementBaseStepRef.current = THREE.MathUtils.clamp(
      safeMaxDim * WALK_MOVEMENT_DIM_FACTOR,
      0.00588,
      1.176,
    );
  };

  const clearMovementRuntimeState = () => {
    movementInputRef.current = cloneMovementInput(EMPTY_MOVEMENT_INPUT);
    moveSpeedMultiplierRef.current = 1;
    lastFrameTimeRef.current = null;
    isLookingRef.current = false;
  };

  /** 切换观察 / 漫游模式：漫游禁用 OrbitControls，改由 yaw/pitch 原地转头 */
  const applyControlMode = (mode: ModelViewerControlMode) => {
    const previousMode = controlModeRef.current;
    if (previousMode === mode) {
      return;
    }

    controlModeRef.current = mode;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    if (mode === "walk") {
      controls.enabled = false;
      controls.enableDamping = false;
      syncYawPitchFromCamera(camera, yawRef, pitchRef);
      applyYawPitchToCamera(camera, yawRef.current, pitchRef.current);
      syncWalkControlsTarget(camera, controls);
      clearMovementRuntimeState();
      logLccDebug("切换至漫游模式", { yaw: yawRef.current, pitch: pitchRef.current });
      return;
    }

    // 回到观察模式：重建 target，恢复 OrbitControls
    controls.enableDamping = true;
    controls.dampingFactor = ORBIT_DAMPING_FACTOR;
    syncOrbitTargetFromCamera(camera, controls);
    controls.enabled = true;
    isLookingRef.current = false;
    activePointerIdRef.current = null;
    isPointerDraggingRef.current = false;
    clearMovementRuntimeState();
    logLccDebug("切换至观察模式");
  };

  applyControlModeRef.current = applyControlMode;

  const syncViewerCamera = () => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    camera.updateMatrixWorld();
    lccRenderRef.current?.setCamera?.(camera);
  };

  const stopPointerInteraction = (hardStop = false) => {
    activePointerIdRef.current = null;
    isPointerDraggingRef.current = false;
    isLookingRef.current = false;

    // 漫游模式：相机由 yaw/pitch 控制，绝不调用 controls.update()
    if (controlModeRef.current === "walk") {
      return;
    }

    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    controls.update();
    if (!hardStop || !controls.enabled) {
      return;
    }

    controls.enabled = false;
    controls.update();
    queueMicrotask(() => {
      if (isDisposedRef.current || controlsRef.current !== controls) {
        return;
      }
      if (controlModeRef.current !== "orbit") {
        return;
      }
      controls.enabled = true;
      controls.update();
    });
  };

  const getForwardVector = () => {
    const camera = cameraRef.current;
    if (!camera) {
      return null;
    }
    return getWalkMovementBasis(camera).forward.clone();
  };

  const getRightVector = () => {
    const camera = cameraRef.current;
    if (!camera) {
      return null;
    }
    return getWalkMovementBasis(camera).right.clone();
  };

  const getMovementDistance = (delta?: number) => {
    if (typeof delta === "number" && Number.isFinite(delta) && delta > 0) {
      return delta;
    }
    return movementBaseStepRef.current * moveSpeedMultiplierRef.current;
  };

  const moveAlongDirection = (direction: THREE.Vector3 | null, delta?: number) => {
    if (!direction || direction.lengthSq() <= 0 || controlModeRef.current !== "walk") {
      return false;
    }
    const camera = cameraRef.current;
    if (!camera) {
      return false;
    }
    camera.position.add(
      direction.clone().normalize().multiplyScalar(getMovementDistance(delta)),
    );
    syncViewerCamera();
    return true;
  };

  /**
   * 漫游模式按键移动：仅平移 camera.position，不依赖 controls.target
   */
  const applyMovementFrame = (deltaSeconds: number) => {
    if (!canMoveRef.current || controlModeRef.current !== "walk") {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    const input = movementInputRef.current;
    if (!input.forward && !input.backward && !input.left && !input.right && !input.up && !input.down) {
      return;
    }

    const { forward, right } = getWalkMovementBasis(camera);

    const delta = new THREE.Vector3();
    if (input.forward) delta.add(forward);
    if (input.backward) delta.addScaledVector(forward, -1);
    if (input.right) delta.add(right);
    if (input.left) delta.addScaledVector(right, -1);
    if (input.up) delta.add(WORLD_UP);
    if (input.down) delta.addScaledVector(WORLD_UP, -1);

    if (delta.lengthSq() <= 0) {
      return;
    }

    const frameScale = Math.min(Math.max(deltaSeconds * 60, 0.25), 4);
    delta
      .normalize()
      .multiplyScalar(movementBaseStepRef.current * moveSpeedMultiplierRef.current * frameScale);

    camera.position.add(delta);
    syncViewerCamera();
  };

  applyMovementFrameRef.current = applyMovementFrame;

  useImperativeHandle(ref, () => ({
      fitView: () => {
        if (!fitCurrentView()) {
          logLccWarn("fitView 暂无可复用的已加载对象，当前版本跳过执行");
        }
      },
      getCurrentView: () => {
        const result = buildLaunchViewSaveResult();
        return result.ok ? result.view : null;
      },
      getLaunchViewForSave: () => buildLaunchViewSaveResult(),
      commitSavedLaunchView: (view) => {
        const snapshot = parseLaunchViewSnapshot(view);
        if (snapshot) {
          defaultViewRef.current = snapshot;
        }
      },
      applyView: (view) => applyLaunchView(view),
      resetView: () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera) {
          return;
        }

        const cachedDefaultView = defaultViewRef.current;

        /** 尝试应用某个快照；不可见则返回 false */
        const tryApplyAndCheck = (snapshot: CameraSnapshot): boolean => {
          if (snapshot.source === "launchView") {
            applyLaunchViewSnapshotToCamera(camera, snapshot, controls, {
              controlMode: controlModeRef.current,
              maxDim: lastBoundsMaxDimRef.current,
              updateControls: controlModeRef.current !== "walk",
            });
          } else {
            applyCameraSnapshot(camera, snapshot, controls, {
              updateControls: controlModeRef.current !== "walk",
            });
          }
          const bounds = lastActiveBoundsRef.current ?? resolveCurrentBounds();
          return isCameraLikelySeeingBounds(camera, bounds);
        };

        // 1. 优先恢复到保存的 launchView 或 defaultCamera
        if (
          cachedDefaultView &&
          (cachedDefaultView.source === "launchView" ||
            cachedDefaultView.source === "defaultCamera")
        ) {
          const applied = tryApplyAndCheck(cachedDefaultView);
          if (controlModeRef.current === "walk") {
            syncYawPitchFromCamera(camera, yawRef, pitchRef);
            if (controls) syncWalkControlsTarget(camera, controls);
          }
          syncViewerCamera();
          if (applied) return;
          // launchView 已失效，继续 fallback 到 fit
          logLccWarn("保存的启动视角已失效，自动适配模型");
        }

        // 2. 自动 fitBounds
        if (fitCurrentView()) return;

        // 3. 兜底：应用缓存的任何默认视角
        if (cachedDefaultView) {
          applyCameraSnapshot(camera, cachedDefaultView, controls, {
            updateControls: controlModeRef.current !== "walk",
          });
          if (controlModeRef.current === "walk") {
            syncYawPitchFromCamera(camera, yawRef, pitchRef);
            if (controls) syncWalkControlsTarget(camera, controls);
          }
          syncViewerCamera();
          return;
        }

        logLccWarn("resetView 暂无默认视角快照，也无法执行 bounds fit");
      },
      moveForward: (delta) => {
        moveAlongDirection(getForwardVector(), delta);
      },
      moveBackward: (delta) => {
        const forward = getForwardVector();
        moveAlongDirection(forward ? forward.multiplyScalar(-1) : null, delta);
      },
      moveLeft: (delta) => {
        const right = getRightVector();
        moveAlongDirection(right ? right.multiplyScalar(-1) : null, delta);
      },
      moveRight: (delta) => {
        moveAlongDirection(getRightVector(), delta);
      },
      moveUp: (delta) => {
        moveAlongDirection(WORLD_UP, delta);
      },
      moveDown: (delta) => {
        moveAlongDirection(WORLD_UP.clone().multiplyScalar(-1), delta);
      },
      setMoveSpeedMultiplier: (multiplier) => {
        moveSpeedMultiplierRef.current =
          Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
      },
      setMovementInput: (input) => {
        movementInputRef.current = cloneMovementInput(input);
        if (!hasMovementInput(movementInputRef.current)) {
          lastFrameTimeRef.current = null;
        }
      },
      setControlMode: (mode) => {
        applyControlModeRef.current(mode);
      },
      getControlMode: () => controlModeRef.current,
  }));

  useEffect(() => {
    applyControlModeRef.current(controlMode);
  }, [controlMode]);

  useEffect(() => {
    let effectDisposed = false;
    let isFailed = false;
    let rafLogged = false;
    const loadId = globalLoadSequence + 1;
    globalLoadSequence = loadId;
    activeGlobalLoadId = loadId;
    isDisposedRef.current = false;

    // 诊断日志：记录本次加载的 loadId、modelUrl、entryUrl
    logLccDebug(`[生命周期] mount loadId=${loadId}`, {
      loadId,
      modelUrl: normalizedModelUrl || "(empty)",
      viewerUrl: normalizedViewerUrl || "(empty)",
      entryUrl: entryUrl || "(empty)",
      resolvedSourceUrl: resolvedSourceUrl || "(empty)",
      fileFormat: fileFormat ?? null,
      lccFormat,
      processingBlocked,
    });

    let removeResizeListeners = () => {};
    let removeInteractionListeners = () => {};

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
          // 全局 SDK Promise 同步置空，避免下一轮加载复用已销毁的 SDK 实例
          lccSdkPromise = null;
          lastSdkFormat = null;
          logLccDebug("格式切换前执行 LCCRender.dispose()，已重置全局 SDK 缓存", {
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
      // 诊断日志：记录清理时机和原因
      logLccDebug(`[生命周期] cleanup loadId=${loadId}`, {
        loadId,
        activeGlobalLoadId,
        reason,
        entryUrl: entryUrl || "(empty)",
      });
      isDisposedRef.current = true;
      stopLoop(true);
      removeResizeListeners();
      removeInteractionListeners();
      stopPointerInteraction(true);
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
      interactionCanvasRef.current = null;
      clearMovementRuntimeState();
      canMoveRef.current = false;
      lastFrameTimeRef.current = null;
      lastLoadedObjectRef.current = null;
      defaultViewRef.current = null;
      // 重置 bounds 上下文，防止跨模型污染（二次打开时旧 bounds 影响新模型视角）
      lastActiveBoundsRef.current = null;
      lastBoundsMaxDimRef.current = 10;
      if (mountRef.current) {
        mountRef.current.replaceChildren();
      }
    };

    if (processingBlocked) {
      cleanup("processing-blocked");
      loadingCompletedRef.current = false;
      completeReasonRef.current = null;
      sdkLoadedRef.current = false;
      sdkLoadedAtRef.current = null;
      loadedStableFrameCountRef.current = 0;
      initialViewReadyRef.current = false;
      progressRef.current = 0;
      setViewerStatus("idle");
      setProgress(0);
      setSdkLoadedState(false);
      return () => {
        effectDisposed = true;
        isDisposedRef.current = true;
      };
    }

    if (!resolvedSourceUrl) {
      cleanup("missing-source-url");
      loadingCompletedRef.current = false;
      completeReasonRef.current = null;
      sdkLoadedRef.current = false;
      sdkLoadedAtRef.current = null;
      loadedStableFrameCountRef.current = 0;
      initialViewReadyRef.current = false;
      progressRef.current = 0;
      setViewerStatus("error");
      setProgress(0);
      setSdkLoadedState(false);
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
      loadingCompletedRef.current = false;
      completeReasonRef.current = null;
      sdkLoadedRef.current = false;
      sdkLoadedAtRef.current = null;
      loadedStableFrameCountRef.current = 0;
      initialViewReadyRef.current = false;
      loadStartedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      lastProgressAtRef.current = loadStartedAtRef.current;
      paintedCanvasSeenRef.current = false;
      progressRef.current = 0;
      setSdkLoadedState(false);
      // 每个新模型重置 bounds 上下文，防止跨模型污染
      lastActiveBoundsRef.current = null;
      lastBoundsMaxDimRef.current = 10;
      canMoveRef.current = false;
      lastFrameTimeRef.current = null;
      setViewerStatus("loading");
      setProgress(0);
      // #region debug-point lcc-stuck-92
      completeCallCountRef.current = 0;
      setDebugAttr("data-lcc-debug-progress", "0.000");
      setDebugAttr("data-lcc-debug-sdk-onloaded", "false");
      setDebugAttr("data-lcc-debug-onloaded-stable", "false");
      setDebugAttr("data-lcc-debug-complete-call-count", "0");
      setDebugAttr("data-lcc-debug-stable-reason", "waiting-sdk-onloaded");
      setDebugAttr("data-lcc-debug-appkey", LCC_APP_KEY ? "present" : "absent");
      // #endregion
      const isLcc2 = lccFormat === "lcc2";
      const useLcc2 = isLcc2;
      const currentFormat: SupportedLccFormat = useLcc2 ? "lcc2" : "lcc";
      // #region debug-point lcc-stuck-92
      markDebugEvent("load-start", {
        loadId,
        format: currentFormat,
        appKey: LCC_APP_KEY ? "present" : "absent",
      });
      // #endregion
      const previousFormat = previousFormatRef.current ?? lastSdkFormat;
      previousFormatRef.current = previousFormat;
      const { didUnloadPreviousInstance, didDisposeForFormatSwitch } = resetSdkForFormatSwitch({
        previousFormat,
        currentFormat,
      });

      if (dataExtension === "zip") {
        cleanup("zip-data-path");
        loadingCompletedRef.current = false;
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
        loadingCompletedRef.current = false;
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

        /**
         * 硬性容器尺寸检查：客户端路由进入时，容器可能尚未完成布局。
         * 如果 clientWidth 或 clientHeight 过小（<=100），不要创建 renderer/camera，
         * 等待 requestAnimationFrame 后重试，避免读入错误的容器尺寸。
         */
        const containerWidth = mountElement.clientWidth;
        const containerHeight = mountElement.clientHeight;
        if (containerWidth <= 100 || containerHeight <= 100) {
          logLccWarn("初始化时容器尺寸过小，延迟等待布局稳定", {
            loadId,
            containerWidth,
            containerHeight,
            offsetParent: mountElement.offsetParent ? "present" : "null",
          });
          let retryCount = 0;
          const maxRetries = 50;
          await new Promise<void>((resolveRetry, rejectRetry) => {
            const retryCheck = () => {
              if (isStaleRequest() || isFailed || isDisposedRef.current) {
                rejectRetry(new Error("stale"));
                return;
              }
              const w = mountElement.clientWidth;
              const h = mountElement.clientHeight;
              if (w > 100 && h > 100) {
                logLccDebug("容器尺寸已就绪，继续初始化", { loadId, containerWidth: w, containerHeight: h, retryCount });
                resolveRetry();
                return;
              }
              if (retryCount++ < maxRetries) {
                requestAnimationFrame(retryCheck);
              } else {
                logLccError("容器尺寸超时未就绪，放弃初始化", { loadId, containerWidth: w, containerHeight: h });
                rejectRetry(new Error("container-size-timeout"));
              }
            };
            requestAnimationFrame(retryCheck);
          });
          // size is now valid, continue below
          if (isStaleRequest() || isFailed) return;
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
        // 交互体验优化：加入阻尼与降低灵敏度
        controls.enableDamping = true;
        controls.dampingFactor = ORBIT_DAMPING_FACTOR;
        controls.rotateSpeed = ORBIT_ROTATE_SPEED;
        controls.panSpeed = ORBIT_PAN_SPEED;
        controls.zoomSpeed = ORBIT_ZOOM_SPEED;
        controls.autoRotate = false;
        controls.screenSpacePanning = true;
        controls.target.copy(OFFICIAL_CAMERA_TARGET);
        controls.update();
        controlsRef.current = controls;
        interactionCanvasRef.current = currentRenderer.domElement;
        applyControlModeRef.current(controlModeRef.current);

        const syncSize = () => {
          if (!mountRef.current || !rendererRef.current) return;
          const nextWidth = Math.max(mountRef.current.clientWidth, 1);
          const nextHeight = Math.max(mountRef.current.clientHeight, 1);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          rendererRef.current.setSize(nextWidth, nextHeight, false);
          if (controlModeRef.current === "orbit") {
            controlsRef.current?.update();
          }
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

        const handlePointerDown = (event: PointerEvent) => {
          if (controlModeRef.current === "walk" && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            isLookingRef.current = true;
            lastLookPointerXRef.current = event.clientX;
            lastLookPointerYRef.current = event.clientY;
            activePointerIdRef.current = event.pointerId;
            isPointerDraggingRef.current = true;
            currentRenderer.domElement.setPointerCapture(event.pointerId);
            return;
          }

          if (controlModeRef.current !== "walk") {
            activePointerIdRef.current = event.pointerId;
            isPointerDraggingRef.current = true;
          }
        };

        const handlePointerMove = (event: PointerEvent) => {
          if (controlModeRef.current !== "walk" || !isLookingRef.current) {
            return;
          }

          if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          const deltaX = event.movementX || event.clientX - lastLookPointerXRef.current;
          const deltaY = event.movementY || event.clientY - lastLookPointerYRef.current;
          lastLookPointerXRef.current = event.clientX;
          lastLookPointerYRef.current = event.clientY;

          if (deltaX === 0 && deltaY === 0) {
            return;
          }

          yawRef.current -= deltaX * WALK_LOOK_SENSITIVITY;
          pitchRef.current -= deltaY * WALK_LOOK_SENSITIVITY;
          pitchRef.current = THREE.MathUtils.clamp(
            pitchRef.current,
            WALK_PITCH_MIN,
            WALK_PITCH_MAX,
          );
        };

        const handlePointerUp = (event: PointerEvent) => {
          if (controlModeRef.current === "walk" && isLookingRef.current) {
            isLookingRef.current = false;
            activePointerIdRef.current = null;
            isPointerDraggingRef.current = false;
            try {
              currentRenderer.domElement.releasePointerCapture(event.pointerId);
            } catch {
              // 指针可能已被释放，忽略
            }
            return;
          }

          stopPointerInteraction(false);
        };
        const handlePointerCancel = () => {
          stopPointerInteraction(true);
        };
        const handlePointerLeave = () => {
          if (!isPointerDraggingRef.current) {
            return;
          }
          stopPointerInteraction(true);
        };
        const handleWindowBlur = () => {
          clearMovementRuntimeState();
          stopPointerInteraction(true);
        };

        currentRenderer.domElement.addEventListener("pointerdown", handlePointerDown);
        currentRenderer.domElement.addEventListener("pointermove", handlePointerMove);
        currentRenderer.domElement.addEventListener("pointerleave", handlePointerLeave);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);
        window.addEventListener("blur", handleWindowBlur);
        removeInteractionListeners = () => {
          currentRenderer.domElement.removeEventListener("pointerdown", handlePointerDown);
          currentRenderer.domElement.removeEventListener("pointermove", handlePointerMove);
          currentRenderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
          window.removeEventListener("pointerup", handlePointerUp);
          window.removeEventListener("pointercancel", handlePointerCancel);
          window.removeEventListener("blur", handleWindowBlur);
        };

        const baseLoadParams: LccLoadParams = {
          camera,
          scene,
          dataPath: entryUrl,
          renderLib: THREE,
          canvas: currentRenderer.domElement,
          renderer: currentRenderer,
          ...(LCC_APP_KEY ? { appKey: LCC_APP_KEY } : {}),
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
            sdkLoadedRef.current = true;
            sdkLoadedAtRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
            loadedStableFrameCountRef.current = 0;
            setSdkLoadedState(true);
            // #region debug-point lcc-stuck-92
            setDebugAttr("data-lcc-debug-sdk-onloaded", "true");
            setDebugAttr("data-lcc-debug-stable-reason", "waiting-initial-view");
            markDebugEvent("sdk-onLoaded", { loadId, progress: progressRef.current.toFixed(3) });
            // #endregion
            logLccDebug("SDK onLoaded 已触发，进入 onLoadedStable 检查阶段", {
              loadId,
              sdkLoadedAt: sdkLoadedAtRef.current,
            });
            logLccDebug("onLoaded 原始回调内容", mesh);
            const loadedObject = isThreeObject3D(mesh) ? mesh : null;
            lastLoadedObjectRef.current = loadedObject;

            void (async () => {
              const runtimeInstance = getRuntimeInstance(lccInstanceRef.current);
              const cameraBeforeFit = camera.position.toArray() as [number, number, number];
              logLcc2RuntimeDiagnostics({
                lccRender,
                runtimeInstance,
                currentFormat,
              });
              const rawSdkBounds = runtimeInstance?.getBounds?.() ?? null;
              const { bounds: activeBounds, source: boundsSource } = resolveBoundsForCameraFit({
                loadedObject,
                scene,
                sdkBounds: rawSdkBounds,
              });
              const boundsSummary = activeBounds ? createBoundsSummary(activeBounds) : null;
              const boundsFitSnapshot = activeBounds
                ? buildBoundsFitSnapshot(
                    camera,
                    activeBounds,
                    boundsSource === "sdkBounds" ? "sdkBounds" : "bounds",
                  )
                : null;
              const boundsCenterHomeView = activeBounds
                ? buildBoundsCenterHomeView({
                    camera,
                    bounds: activeBounds,
                    boundsSource: boundsSource === "sdkBounds" ? "sdkBounds" : "threeBounds",
                  })
                : null;
              const spawnPointResult = await loadLccSpawnPointSnapshot(
                entryUrl,
                currentFormat,
                activeBounds,
              );
              if (isStaleRequest() || isFailed) return;

              const savedLaunchViewSnapshot = parseLaunchViewSnapshot(launchViewPropRef.current);
              rememberBoundsContext(activeBounds);

              const resolvedSnapshot =
                savedLaunchViewSnapshot ??
                platformDefaultCameraSnapshot ??
                boundsFitSnapshot ??
                null;
              const usedBoundsFallback = false;
              const source: DefaultViewSource | null =
                savedLaunchViewSnapshot?.source ??
                platformDefaultCameraSnapshot?.source ??
                boundsFitSnapshot?.source ??
                null;

              // boundsCenterHomeView 不再作为 resolvedSnapshot 的兜底（与 boundsFitSnapshot 冗余，且不够稳定），保留其 maxDim 供后续使用
              const loadedMaxDim = boundsSummary
                ? sanitizeMaxDim(Math.max(...boundsSummary.size))
                : 10;
              lastBoundsMaxDimRef.current = loadedMaxDim;

              /**
               * 检查容器尺寸是否有效。
               * 二次打开空白常见原因：fitBounds 在容器尺寸还未稳定时执行。
               * 如果容器尺寸为 0 或异常小，需要等待 ResizeObserver 更新后再应用视角。
               */
              const getContainerSize = () => {
                const el = mountRef.current;
                if (!el) return { width: 0, height: 0 };
                return {
                  width: Math.max(el.clientWidth, 1),
                  height: Math.max(el.clientHeight, 1),
                };
              };

              const isContainerSizeValid = () => {
                const { width, height } = getContainerSize();
                return width > 50 && height > 50;
              };

              // 诊断日志：记录容器尺寸和状态
              logLccDebug("onLoaded 容器尺寸检查", {
                loadId,
                container: getContainerSize(),
                isValid: isContainerSizeValid(),
                hasLaunchView: Boolean(savedLaunchViewSnapshot),
                hasDefaultCamera: Boolean(platformDefaultCameraSnapshot),
                hasBounds: Boolean(activeBounds),
                rendererSize: currentRenderer.getSize(new THREE.Vector2()).toArray(),
                cameraAspect: camera.aspect,
                canvasWidth: currentRenderer.domElement.width,
                canvasHeight: currentRenderer.domElement.height,
              });

              /** 应用视角并设置默认视角，返回实际应用的 snapshot（可能和 resolvedSnapshot 不同） */
              const applyInitialView = () => {
                /**
                 * onLoaded 前强制同步 renderer size 和 camera aspect。
                 * 客户端路由进入时，ResizeObserver 回调可能还未触发，导致 canvas size 和 camera.aspect 仍然是旧值。
                 * 必须在 fitBounds 前重新同步，否则首次 fit 使用的是创建时的 aspect（可能为 0 或 1）。
                 */
                if (mountRef.current && currentRenderer) {
                  const w = Math.max(mountRef.current.clientWidth, 1);
                  const h = Math.max(mountRef.current.clientHeight, 1);
                  currentRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                  currentRenderer.setSize(w, h, false);
                  camera.aspect = w / h;
                  camera.updateProjectionMatrix();
                  camera.updateMatrixWorld(true);
                  logLccDebug("applyInitialView 前重新同步 renderer size/camera aspect", {
                    loadId,
                    width: w,
                    height: h,
                    aspect: camera.aspect,
                  });
                }
                // 优先尝试 launchView
                if (resolvedSnapshot) {
                  if (resolvedSnapshot.source === "launchView") {
                    applyLaunchViewSnapshotToCamera(camera, resolvedSnapshot, controlsRef.current, {
                      controlMode: controlModeRef.current,
                      maxDim: loadedMaxDim,
                      updateControls: controlModeRef.current !== "walk",
                    });
                    if (isCameraLikelySeeingBounds(camera, activeBounds)) {
                      // launchView 可见：直接使用
                      return resolvedSnapshot;
                    }
                    // launchView 不可见 → 自动 fitBounds，但不改变后端已保存值
                    logLccWarn("保存的启动视角下模型不可见，自动回退到适配视角（不删除后端保存值）");
                  } else {
                    applyCameraSnapshot(camera, resolvedSnapshot, controlsRef.current, {
                      updateControls: controlModeRef.current !== "walk",
                    });
                    if (isCameraLikelySeeingBounds(camera, activeBounds)) {
                      return resolvedSnapshot;
                    }
                    logLccWarn("默认相机快照下模型不可见，自动回退到适配视角");
                  }
                }

                // fallback：自动 fitBounds
                if (activeBounds) {
                  const fitSnap = buildBoundsFitSnapshot(
                    camera,
                    activeBounds,
                    boundsSource === "sdkBounds" ? "sdkBounds" : "bounds",
                  );
                  if (fitSnap) {
                    applyCameraSnapshot(camera, fitSnap, controlsRef.current, {
                      updateControls: controlModeRef.current !== "walk",
                    });
                    return fitSnap;
                  }
                }

                // 完全没有 bounds，保留已有视角或默认 camera
                return resolvedSnapshot;
              };

              let appliedSnapshot: CameraSnapshot | null = null;

              // 如果容器尺寸无效，延迟重试；否则直接应用
              if (!isContainerSizeValid()) {
                logLccWarn("onLoaded 容器尺寸无效，延迟 3 帧后重试应用初始视角", {
                  loadId,
                  container: getContainerSize(),
                });
                // 等待 3 个 requestAnimationFrame 让容器布局稳定
                let retryCount = 0;
                const maxRetries = 3;
                const tryApplyAfterResize = () => {
                  if (isStaleRequest() || isFailed || isDisposedRef.current) return;
                  if (isContainerSizeValid() || retryCount >= maxRetries) {
                    logLccDebug("容器尺寸已就绪或达到最大重试次数", {
                      loadId,
                      container: getContainerSize(),
                      retryCount,
                      isValid: isContainerSizeValid(),
                    });
                    appliedSnapshot = applyInitialView();
                    finishOnLoaded(appliedSnapshot);
                    return;
                  }
                  retryCount++;
                  requestAnimationFrame(tryApplyAfterResize);
                };
                requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(tryApplyAfterResize)));
              } else {
                appliedSnapshot = applyInitialView();
              }

              /** onLoaded 后续收尾逻辑：同步模式、记录默认视角、可见性兜底检查 */
              const finishOnLoaded = (snapshot: CameraSnapshot | null) => {
                if (isStaleRequest() || isFailed || isDisposedRef.current) return;

                // 漫游模式同步 yaw/pitch
                if (controlModeRef.current === "walk") {
                  syncYawPitchFromCamera(camera, yawRef, pitchRef);
                  if (controlsRef.current) {
                    syncWalkControlsTarget(camera, controlsRef.current);
                  }
                }
                syncViewerCamera();

                // defaultViewRef：始终指向用户保存的 launchView（如果有），方便 resetView 恢复
                if (savedLaunchViewSnapshot) {
                  defaultViewRef.current = savedLaunchViewSnapshot;
                } else if (snapshot) {
                  defaultViewRef.current = snapshot;
                } else {
                  defaultViewRef.current = null;
                }

                setMovementBaseStep(loadedMaxDim);
                canMoveRef.current = true;
                initialViewReadyRef.current = true;
                // #region debug-point lcc-stuck-92
                setDebugAttr("data-lcc-debug-onloaded-stable", "initial-view-ready");
                setDebugAttr("data-lcc-debug-stable-reason", "waiting-stable-window");
                markDebugEvent("initial-view-ready", {
                  loadId,
                  canvasCount: currentRenderer.domElement ? 1 : 0,
                });
                // #endregion

                if (!loadedObject) {
                  logLccWarn("onLoaded 返回值不是 Three Object3D，无法使用 Three bounds 作为兜底", mesh);
                }

                const resolution: DefaultViewResolution = {
                  snapshot: resolvedSnapshot,
                  usedBoundsFallback,
                  boundsSummary,
                  boundsSource: boundsSource ?? null,
                };

                logOnLoadedBoundsDiagnostics({
                  loadedObject,
                  bounds: activeBounds,
                  boundsSource: boundsSource ?? null,
                  camera,
                  controls: controlsRef.current,
                  defaultViewSource: source,
                  cameraBeforeFit,
                  cameraAfterFit: camera.position.toArray() as [number, number, number],
                });

                logLccDebug("默认视角解析结果", {
                  loadId,
                  format: currentFormat,
                  useLcc2,
                  defaultViewSource:
                    savedLaunchViewSnapshot
                      ? "launchView"
                      : platformDefaultCameraSnapshot
                        ? "defaultCamera"
                        : boundsFitSnapshot
                          ? boundsFitSnapshot.source
                          : boundsCenterHomeView?.snapshot
                            ? "boundsCenterHomeView"
                            : "none",
                  appliedViewSource: snapshot?.source ?? null,
                  hasLaunchView: Boolean(savedLaunchViewSnapshot),
                  hasPlatformDefaultCameraJson: Boolean(platformDefaultCameraSnapshot),
                  boundsSource: resolution.boundsSource,
                  center: boundsSummary?.center ?? boundsCenterHomeView?.center ?? null,
                  size: boundsSummary?.size ?? boundsCenterHomeView?.size ?? null,
                  maxDim: boundsSummary
                    ? sanitizeMaxDim(Math.max(...boundsSummary.size))
                    : boundsCenterHomeView?.maxDim ?? null,
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
                  cameraPosition: camera.position.toArray(),
                  target: controlsRef.current?.target.toArray() ?? null,
                  up: camera.up.toArray(),
                  cameraNear: camera.near,
                  cameraFar: camera.far,
                  resetViewSource: resolution.snapshot?.source ?? null,
                  hasMeta: Boolean(runtimeInstance?.getMeta?.()),
                  skippedSpawnPointRotation: Boolean(spawnPointResult.rawRotation),
                });

                // 可见性兜底检查：初始视角应用后 2 帧再次确认模型在视野内
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (isStaleRequest() || isFailed || isDisposedRef.current) return;
                    if (!isActiveLoadOwner()) return;

                    const currentBounds = lastActiveBoundsRef.current ?? resolveCurrentBounds();
                    if (!isCameraLikelySeeingBounds(camera, currentBounds)) {
                      logLccWarn("[可见性兜底] 初始视角应用后模型仍不可见，自动 fitBounds", {
                        loadId,
                        cameraPosition: camera.position.toArray(),
                        cameraNear: camera.near,
                        cameraFar: camera.far,
                        boundsCenter: currentBounds
                          ? new THREE.Vector3().copy(currentBounds.getCenter(new THREE.Vector3())).toArray()
                          : null,
                      });
                      fitCurrentViewRef.current();
                    } else {
                      logLccDebug("[可见性兜底] 初始视角应用后模型可见，检查通过", { loadId });
                    }
                  });
                });
              };

              // 容器尺寸有效的情况，直接执行收尾
              if (appliedSnapshot !== null || isContainerSizeValid()) {
                finishOnLoaded(appliedSnapshot);
              }
            })();
          },
          (rawProgress) => {
            if (isStaleRequest() || isFailed || loadingCompletedRef.current) return;
            const nextProgress = clampProgress(
              typeof rawProgress === "number" ? rawProgress : Number(rawProgress),
            );
            if (Math.abs(nextProgress - progressRef.current) > 0.0001) {
              lastProgressAtRef.current =
                typeof performance !== "undefined" ? performance.now() : Date.now();
            }
            progressRef.current = nextProgress;
            setProgress(nextProgress);
            setViewerStatus("loading");
            // #region debug-point lcc-stuck-92
            setDebugAttr("data-lcc-debug-progress", nextProgress.toFixed(3));
            // #endregion
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
            loadingCompletedRef.current = false;
            sdkLoadedRef.current = false;
            sdkLoadedAtRef.current = null;
            loadedStableFrameCountRef.current = 0;
            initialViewReadyRef.current = false;
            completeReasonRef.current = null;
            setSdkLoadedState(false);
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
            const now = typeof performance !== "undefined" ? performance.now() : Date.now();
            const previousTime = lastFrameTimeRef.current ?? now;
            const deltaSeconds = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
            lastFrameTimeRef.current = now;

            const activeControls = controlsRef.current;
            const activeCamera = cameraRef.current ?? camera;

            if (controlModeRef.current === "orbit") {
              if (activeControls) {
                activeControls.enabled = true;
                activeControls.update();
              }
            } else {
              if (activeControls) {
                activeControls.enabled = false;
              }

              applyYawPitchToCamera(activeCamera, yawRef.current, pitchRef.current);
              if (activeControls) {
                syncWalkControlsTarget(activeCamera, activeControls);
              }
              applyMovementFrameRef.current(deltaSeconds);
              activeCamera.updateMatrixWorld(true);
              syncViewerCamera();
            }

            lccRender.update();
            rendererRef.current.render(scene, activeCamera);

            if (!loadingCompletedRef.current) {
              const canvasElement = rendererRef.current.domElement;
              const hasVisibleCanvas =
                canvasElement.isConnected &&
                canvasElement.clientWidth > 0 &&
                canvasElement.clientHeight > 0 &&
                canvasElement.width > 0 &&
                canvasElement.height > 0;
              if (!paintedCanvasSeenRef.current && hasVisibleCanvas) {
                paintedCanvasSeenRef.current = doesCanvasLookPainted(canvasElement);
              }
              const resourceStability = resolveRelevantResourceStability(now);
              const loadElapsedMs =
                loadStartedAtRef.current === null ? 0 : now - loadStartedAtRef.current;
              const progressIdleMs =
                lastProgressAtRef.current === null ? 0 : now - lastProgressAtRef.current;
              const hasProgressForStableCheck = progressRef.current >= 0.95 || sdkLoadedRef.current;
              const canCompleteFromStableWindow =
                !isFailed &&
                sdkLoadedRef.current &&
                initialViewReadyRef.current &&
                hasVisibleCanvas &&
                hasProgressForStableCheck &&
                resourceStability.isStable;
              const canCompleteFromFallbackWithoutOnLoaded =
                !isFailed &&
                !sdkLoadedRef.current &&
                hasVisibleCanvas &&
                loadElapsedMs >= LCC_ONLOADED_FALLBACK_MS &&
                resourceStability.isStable &&
                (paintedCanvasSeenRef.current || progressRef.current >= 0.9);

              if (canCompleteFromStableWindow) {
                loadedStableFrameCountRef.current += 1;
                // #region debug-point lcc-stuck-92
                setDebugAttr("data-lcc-debug-stable-reason", `stable-frames:${loadedStableFrameCountRef.current}`);
                // #endregion
                if (loadedStableFrameCountRef.current >= LCC_STABLE_FRAME_THRESHOLD) {
                  // #region debug-point lcc-stuck-92
                  setDebugAttr("data-lcc-debug-onloaded-stable", "true");
                  markDebugEvent("onLoadedStable", {
                    loadId,
                    progress: progressRef.current.toFixed(3),
                  });
                  // #endregion
                  completeViewerLoading("onLoadedStable");
                }
              } else if (canCompleteFromFallbackWithoutOnLoaded) {
                // #region debug-point lcc-stuck-92
                setDebugAttr("data-lcc-debug-stable-reason", "fallback-no-onLoaded");
                setDebugAttr("data-lcc-debug-onloaded-stable", "fallback");
                markDebugEvent("fallback-complete", {
                  loadId,
                  progress: progressRef.current.toFixed(3),
                  loadElapsedMs: Math.round(loadElapsedMs),
                  progressIdleMs: Math.round(progressIdleMs),
                  paintedCanvas: paintedCanvasSeenRef.current ? "true" : "false",
                });
                // #endregion
                completeViewerLoading("onLoadedStable");
              } else {
                loadedStableFrameCountRef.current = 0;
                // #region debug-point lcc-stuck-92
                let stableFailReason = "unknown";
                if (isFailed) {
                  stableFailReason = "isFailed";
                } else if (!sdkLoadedRef.current) {
                  stableFailReason = `waiting-sdk-onloaded:${Math.round(loadElapsedMs)}ms:painted=${paintedCanvasSeenRef.current ? "true" : "false"}:progress=${progressRef.current.toFixed(3)}`;
                } else if (!initialViewReadyRef.current) {
                  stableFailReason = "initialViewNotReady";
                } else if (!hasVisibleCanvas) {
                  stableFailReason = "canvasNotVisible";
                } else if (!hasProgressForStableCheck) {
                  stableFailReason = `progress:${progressRef.current.toFixed(3)}`;
                } else if (!resourceStability.isStable) {
                  stableFailReason = `resourceWindow:${resourceStability.relevantResourceCount}`;
                }
                setDebugAttr("data-lcc-debug-stable-reason", stableFailReason);
                // #endregion
              }
            }

            // 加载完成 (completeViewerLoading) 后，等待首帧实际渲染到 canvas
            if (loadingCompletedRef.current && !firstFrameRenderedRef.current) {
              const canvasElement = rendererRef.current.domElement;
              const hasVisibleCanvas =
                canvasElement.isConnected &&
                canvasElement.clientWidth > 0 &&
                canvasElement.clientHeight > 0 &&
                canvasElement.width > 0 &&
                canvasElement.height > 0;
              if (hasVisibleCanvas && doesCanvasLookPainted(canvasElement)) {
                firstFrameRenderedRef.current = true;
                progressRef.current = 1;
                setProgress(1);
                setDebugAttr("data-lcc-first-frame", "true");
                markDebugEvent("firstFrameRendered", { loadId });
                logLccDebug("first frame rendered, loading complete");
              } else {
                setDebugAttr("data-lcc-debug-first-frame-wait", "true");
              }
            }
          } catch (error) {
            isFailed = true;
            stopLoop();
            sdkLoadedRef.current = false;
            sdkLoadedAtRef.current = null;
            loadedStableFrameCountRef.current = 0;
            initialViewReadyRef.current = false;
            completeReasonRef.current = null;
            setSdkLoadedState(false);
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
        sdkLoadedRef.current = false;
        sdkLoadedAtRef.current = null;
        loadedStableFrameCountRef.current = 0;
        initialViewReadyRef.current = false;
        completeReasonRef.current = null;
        setSdkLoadedState(false);
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
    completeViewerLoading,
    resolveRelevantResourceStability,
    resolvedSourceUrl,
    viewerType,
    markDebugEvent,
    setDebugAttr,
  ]);

  const showOverlay = processingBlocked || viewerStatus !== "loaded";
  const displayProgress =
    viewerStatus === "loaded" && firstFrameRenderedRef.current
      ? 1
      : viewerStatus === "loaded"
        ? 0.98
        : Math.min(Number.isFinite(progress) ? progress : 0, sdkLoadedState ? 0.98 : 0.95);
  const overlayStatus = processingBlocked
    ? "info"
    : viewerStatus === "error"
      ? "error"
      : "loading";

  return (
    <div
      ref={viewerRootRef}
      data-lcc-loaded={viewerStatus === "loaded" ? "true" : "false"}
      data-lcc-first-frame={firstFrameRenderedRef.current ? "true" : "false"}
      data-lcc-viewer-status={viewerStatus}
      data-lcc-complete-reason={completeReasonRef.current ?? ""}
      data-lcc-sdk-loaded={sdkLoadedRef.current ? "true" : "false"}
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.14),transparent_32%),linear-gradient(135deg,#07111a_0%,#071826_45%,#04070c_100%)]"
    >
      {/* 通过底部微裁切抬高 viewer 可视区域，尽量自然吃掉 SDK 底部水印。 */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          ref={mountRef}
          className="absolute inset-x-0 top-0"
          style={{ bottom: `-${LCC_WATERMARK_CROP_PX}px` }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/10 to-transparent" />
      {viewerStatus === "loaded" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-[#0d0d0d]"
          style={{ height: `${LCC_WATERMARK_BOTTOM_BAR_PX}px` }}
        />
      ) : null}

      <ModelLoadingOverlay
        visible={showOverlay}
        status={overlayStatus}
        progress={displayProgress}
        showText={false}
      />
    </div>
  );
});
