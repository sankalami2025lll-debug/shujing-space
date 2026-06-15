"use client";

import {
  completeMultipartPart,
  completeMultipartUpload,
  initMultipartUploadTask,
  presignMultipartParts,
  type CompleteMultipartUploadResult,
  type UploadMultipartSessionRecord,
  type UploadTaskFileKind,
} from "@/lib/api/upload-tasks";
import { UploadAbortedError, type UploadProgress } from "@/lib/api/uploads";
import { ApiError } from "@/lib/http";

const parsedConcurrency = Number(process.env.NEXT_PUBLIC_UPLOAD_CONCURRENCY ?? "3");
const DEFAULT_MULTIPART_CONCURRENCY =
  Number.isFinite(parsedConcurrency) && parsedConcurrency >= 1 ? parsedConcurrency : 3;

const parsedRetryLimit = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_RETRIES ?? "3");
const DEFAULT_PART_RETRY_LIMIT =
  Number.isFinite(parsedRetryLimit) && parsedRetryLimit >= 0 ? parsedRetryLimit : 3;

const parsedPartTimeoutMs = Number(process.env.NEXT_PUBLIC_UPLOAD_PART_TIMEOUT_MS ?? "600000");
const DEFAULT_PART_PUT_TIMEOUT_MS =
  Number.isFinite(parsedPartTimeoutMs) && parsedPartTimeoutMs > 0 ? parsedPartTimeoutMs : 600_000;

const ENABLE_UPLOAD_DEBUG_LOG = true;

let uploadSpeedTracker: {
  bytesAtTimestamps: Array<{ bytes: number; timestamp: number }>;
} | null = null;

const debug = (msg: string) => {
  if (ENABLE_UPLOAD_DEBUG_LOG) {
    console.log(`[upload-runner] ${msg}`);
  }
};

function getOrInitSpeedTracker(): { bytesAtTimestamps: Array<{ bytes: number; timestamp: number }> } {
  if (!uploadSpeedTracker) {
    uploadSpeedTracker = { bytesAtTimestamps: [] };
  }
  return uploadSpeedTracker;
}

function recordSpeedSample(bytes: number): number {
  const now = Date.now();
  const tracker = getOrInitSpeedTracker();
  tracker.bytesAtTimestamps.push({ bytes, timestamp: now });

  // 保留最近 10 秒的采样点
  const cutoff = now - 10_000;
  while (tracker.bytesAtTimestamps.length > 0 && tracker.bytesAtTimestamps[0].timestamp < cutoff) {
    tracker.bytesAtTimestamps.shift();
  }

  return now;
}

function calculateSpeed(_bytes: number): number {
  const now = Date.now();
  const tracker = getOrInitSpeedTracker();
  const cutoff = now - 10_000;
  const recentSamples = tracker.bytesAtTimestamps.filter((s) => s.timestamp >= cutoff);

  if (recentSamples.length < 2) return 0;

  const firstBytes = recentSamples[0].bytes;
  const firstTime = recentSamples[0].timestamp;
  const lastBytes = recentSamples[recentSamples.length - 1].bytes;
  const lastTime = recentSamples[recentSamples.length - 1].timestamp;

  const elapsedSeconds = (lastTime - firstTime) / 1000;
  if (elapsedSeconds < 0.5) return 0;

  return (lastBytes - firstBytes) / elapsedSeconds;
}

function estimateRemainingSeconds(totalBytes: number, uploadedBytes: number, speed: number): number {
  if (speed <= 0) return Infinity;
  const remainingBytes = totalBytes - uploadedBytes;
  if (remainingBytes <= 0) return 0;
  return remainingBytes / speed;
}

interface MultipartRunnerOptions {
  taskId: number;
  kind: UploadTaskFileKind;
  file: File;
  signal: AbortSignal;
  concurrency?: number;
  maxRetries?: number;
  onProgress?: (progress: UploadProgress) => void;
  onSessionReady?: (session: UploadMultipartSessionRecord) => void;
  onSessionUpdate?: (session: UploadMultipartSessionRecord) => void;
  /** 每片开始上传时回调，可用于外部 stall detector 更新活动标记 */
  onPartUploadStart?: (partNumber: number) => void;
  /** 每片上传完成（成功或最终失败）时回调 */
  onPartUploadEnd?: (partNumber: number) => void;
}

interface MultipartResumeOptions extends Omit<MultipartRunnerOptions, "onSessionReady"> {
  session: UploadMultipartSessionRecord;
}

interface MultipartPartDebugContext {
  partNumber: number;
  byteStart: number;
  byteEnd: number;
  partSize: number;
}

function createProgress(loaded: number, total: number): UploadProgress {
  const safeLoaded = Math.min(total, Math.max(0, loaded));
  return {
    loaded: safeLoaded,
    total,
    percent: total > 0 ? Math.min(100, Math.round((safeLoaded / total) * 100)) : 0,
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new UploadAbortedError();
  }
}

function getPartBounds(file: File, partNumber: number, partSize: number): {
  byteStart: number;
  byteEnd: number;
} {
  const byteStart = (partNumber - 1) * partSize;
  const byteEnd = Math.min(file.size, byteStart + partSize);
  return { byteStart, byteEnd };
}

async function getPartPayload(
  file: File,
  partNumber: number,
  partSize: number,
): Promise<ArrayBuffer> {
  const { byteStart, byteEnd } = getPartBounds(file, partNumber, partSize);
  const chunk = file.slice(byteStart, byteEnd);
  return await chunk.arrayBuffer();
}

function getPartSize(payload: ArrayBuffer): number {
  return payload.byteLength;
}

function sortUploadedParts(parts: UploadMultipartSessionRecord["uploadedParts"]) {
  return [...parts].sort((a, b) => a.partNumber - b.partNumber);
}

function buildSessionSnapshot(
  session: UploadMultipartSessionRecord,
  uploadedPartsMap: Map<number, UploadMultipartSessionRecord["uploadedParts"][number]>,
): UploadMultipartSessionRecord {
  const uploadedParts = sortUploadedParts([...uploadedPartsMap.values()]);
  const uploadedBytes = uploadedParts.reduce((sum, part) => sum + part.partSize, 0);
  const missingParts: number[] = [];

  for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
    if (!uploadedPartsMap.has(partNumber)) {
      missingParts.push(partNumber);
    }
  }

  return {
    ...session,
    status: missingParts.length === 0 ? session.status : "uploading",
    uploadedBytes,
    completedPartsCount: uploadedParts.length,
    uploadedParts,
    missingParts,
  };
}

async function putMultipartPartToPresignedUrlWithXhr(
  uploadUrl: string,
  payload: ArrayBuffer,
  signal: AbortSignal,
  _partContext: MultipartPartDebugContext,
  onProgress?: (loaded: number) => void,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const onAbort = () => xhr.abort();
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    if (signal.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    xhr.open("PUT", uploadUrl, true);
    xhr.timeout = DEFAULT_PART_PUT_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(event.loaded);
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(`分片上传失败（HTTP ${xhr.status}）`, -1, xhr.status));
        return;
      }

      onProgress?.(payload.byteLength);
      const etag = xhr.getResponseHeader("ETag") ?? xhr.getResponseHeader("etag");
      if (!etag?.trim()) {
        reject(new ApiError("分片上传成功，但未返回 ETag。", -1, xhr.status));
        return;
      }
      resolve(etag.trim());
    };

    xhr.onerror = () => {
      cleanup();
      reject(new ApiError("分片上传失败，请检查网络后重试。", -1, 0));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(
        new ApiError(
          `第 ${_partContext.partNumber} 个分片上传超时（${DEFAULT_PART_PUT_TIMEOUT_MS / 1000} 秒），请检查对象存储连通性后重试。`,
          -1,
          408,
        ),
      );
    };

    xhr.onabort = () => {
      cleanup();
      reject(new UploadAbortedError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
    xhr.send(payload);
  });
}

async function putMultipartPartToPresignedUrl(
  uploadUrl: string,
  payload: ArrayBuffer,
  signal: AbortSignal,
  partContext: MultipartPartDebugContext,
  onProgress?: (loaded: number) => void,
): Promise<string> {
  return await putMultipartPartToPresignedUrlWithXhr(
    uploadUrl,
    payload,
    signal,
    partContext,
    onProgress,
  );
}

export async function runMultipartUploadTask(
  options: MultipartRunnerOptions,
): Promise<CompleteMultipartUploadResult> {
  const {
    taskId,
    kind,
    file,
    signal,
    onSessionReady,
  } = options;
  debug(`runMultipartUploadTask entered | taskId=${taskId} kind=${kind} file=${file.name} size=${file.size} concurrency=${options.concurrency ?? DEFAULT_MULTIPART_CONCURRENCY}`);

  throwIfAborted(signal);

  const initAbortController = new AbortController();
  const initTimeout = setTimeout(() => {
    initAbortController.abort();
  }, 60_000);

  try {
    const session = await initMultipartUploadTask(taskId, {
      kind,
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified,
    }, { signal: initAbortController.signal });
    clearTimeout(initTimeout);
    onSessionReady?.(session);
    return await resumeMultipartUploadTask({
      ...options,
      session,
    });
  } catch (error) {
    clearTimeout(initTimeout);
    throw error;
  }
}

export async function resumeMultipartUploadTask(
  options: MultipartResumeOptions,
): Promise<CompleteMultipartUploadResult> {
  const {
    taskId,
    kind,
    file,
    signal,
    session,
    onProgress,
    onSessionUpdate,
    concurrency = DEFAULT_MULTIPART_CONCURRENCY,
    maxRetries = DEFAULT_PART_RETRY_LIMIT,
    onPartUploadStart,
    onPartUploadEnd,
  } = options;
  debug(`resumeMultipartUploadTask | taskId=${taskId} kind=${kind} file=${file.name} uploadedParts=${session.uploadedParts.length} totalParts=${session.totalParts} partSize=${session.partSize}`);

  throwIfAborted(signal);

  const completedPartsMap = new Map<number, UploadMultipartSessionRecord["uploadedParts"][number]>(
    session.uploadedParts.map((part) => [part.partNumber, part]),
  );
  const inflightPartBytes = new Map<number, number>();

  const emitSessionUpdate = () => {
    onSessionUpdate?.(buildSessionSnapshot(session, completedPartsMap));
  };

  let lastProgressTime = 0;
  const PROGRESS_THROTTLE_MS = 300;

  const emitProgress = (speedBytesPerSecond = 0, etaSeconds = Infinity) => {
    const now = Date.now();
    if (now - lastProgressTime < PROGRESS_THROTTLE_MS) return;
    lastProgressTime = now;

    const uploadedBytes = [...completedPartsMap.values()].reduce((sum, part) => sum + part.partSize, 0);
    const inflightBytes = [...inflightPartBytes.values()].reduce((sum, size) => sum + size, 0);
    const totalLoaded = uploadedBytes + inflightBytes;
    const progress = createProgress(totalLoaded, file.size);

    recordSpeedSample(totalLoaded);

    onProgress?.({
      ...progress,
      speedBytesPerSecond,
      etaSeconds,
    });
  };

  // 节流不受限的完整进度更新（用于速度/ETA计算）
  const emitProgressUnthrottled = (speedBytesPerSecond = 0, etaSeconds = Infinity) => {
    const uploadedBytes = [...completedPartsMap.values()].reduce((sum, part) => sum + part.partSize, 0);
    const inflightBytes = [...inflightPartBytes.values()].reduce((sum, size) => sum + size, 0);
    const totalLoaded = uploadedBytes + inflightBytes;

    recordSpeedSample(totalLoaded);

    const speed = speedBytesPerSecond > 0 ? speedBytesPerSecond : calculateSpeed(totalLoaded);
    const eta = etaSeconds < Infinity ? etaSeconds : estimateRemainingSeconds(file.size, totalLoaded, speed);
    const progress = createProgress(totalLoaded, file.size);

    onProgress?.({
      ...progress,
      speedBytesPerSecond: speed,
      etaSeconds: eta,
    });
  };

  emitSessionUpdate();
  emitProgress(0, Infinity);

  if (session.status === "completed" && session.modelFileId != null) {
    onProgress?.(createProgress(file.size, file.size));
    return await completeMultipartUpload(taskId, kind);
  }

  const pendingPartNumbers = [...new Set(session.missingParts)].sort((a, b) => a - b);

  // 重试状态追踪

  const uploadPart = async (partNumber: number) => {
    onPartUploadStart?.(partNumber);
    const { byteStart, byteEnd } = getPartBounds(file, partNumber, session.partSize);
    const payload = await getPartPayload(file, partNumber, session.partSize);
    const partSize = getPartSize(payload);
    const partContext: MultipartPartDebugContext = {
      partNumber,
      byteStart,
      byteEnd,
      partSize,
    };
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      throwIfAborted(signal);
      try {
        debug(`part presign | partNumber=${partNumber} attempt=${attempt}`);
        const presigned = await presignMultipartParts(taskId, kind, {
          partNumbers: [partNumber],
        });
        const signedPart = presigned.parts.find((part) => part.partNumber === partNumber);
        if (!signedPart) {
          throw new ApiError(`分片 ${partNumber} 未返回上传地址。`, -1, 500);
        }
        debug(`part PUT start | partNumber=${partNumber} attempt=${attempt} url=${signedPart.uploadUrl.slice(0, 60)}...`);

        inflightPartBytes.set(partNumber, 0);
        emitProgressUnthrottled();
        const etag = await putMultipartPartToPresignedUrl(
          signedPart.uploadUrl,
          payload,
          signal,
          partContext,
          (loaded) => {
            inflightPartBytes.set(partNumber, loaded);
            emitProgressUnthrottled();
          },
        );
        throwIfAborted(signal);

        await completeMultipartPart(taskId, kind, partNumber, {
          etag,
          partSize,
        });

        inflightPartBytes.delete(partNumber);
        completedPartsMap.set(partNumber, {
          partNumber,
          byteStart,
          byteEnd,
          partSize,
          etag,
          uploadedAt: new Date().toISOString(),
          attemptCount: 1,
        });
        emitSessionUpdate();
        emitProgressUnthrottled();
        onPartUploadEnd?.(partNumber);
        return;
      } catch (error) {
        inflightPartBytes.delete(partNumber);
        emitProgressUnthrottled();
        if (error instanceof UploadAbortedError) {
          onPartUploadEnd?.(partNumber);
          throw error;
        }
        // 403/401 签名错误不可重试，直接抛出
        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 401)
        ) {
          onPartUploadEnd?.(partNumber);
          throw error;
        }
        lastError = error;
        if (attempt >= maxRetries) {
          break;
        }
      }
    }

    onPartUploadEnd?.(partNumber);
    throw new ApiError(
      `第 ${partNumber} 个分片上传失败，已重试 ${maxRetries} 次，请检查网络后重试。`,
      -1,
      lastError instanceof ApiError ? lastError.status : 500,
    );
  };

  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, pendingPartNumbers.length || 1));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      throwIfAborted(signal);
      const currentIndex = nextIndex;
      nextIndex += 1;
      const partNumber = pendingPartNumbers[currentIndex];
      if (partNumber == null) return;
      await uploadPart(partNumber);
    }
  });

  await Promise.all(workers);
  throwIfAborted(signal);

  debug(`all parts uploaded, calling completeMultipartUpload | taskId=${taskId} kind=${kind}`);
  const result = await completeMultipartUpload(taskId, kind);
  onSessionUpdate?.({
    ...buildSessionSnapshot(session, completedPartsMap),
    status: "completed",
    modelFileId: result.fileId,
  });
  onProgress?.(createProgress(file.size, file.size));
  return result;
}
