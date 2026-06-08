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

const DEFAULT_MULTIPART_CONCURRENCY = 1;
const DEFAULT_PART_RETRY_LIMIT = 3;
const DEFAULT_PART_PUT_TIMEOUT_MS = 60_000;
const ENABLE_MULTIPART_FETCH_PUT = true;

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

async function putMultipartPartToPresignedUrlWithFetch(
  uploadUrl: string,
  payload: ArrayBuffer,
  signal: AbortSignal,
  _partContext: MultipartPartDebugContext,
  onProgress?: (loaded: number) => void,
): Promise<string> {
  const requestController = new AbortController();
  let abortedByParent = false;
  let abortedByTimeout = false;
  const onAbort = () => {
    abortedByParent = true;
    requestController.abort();
  };
  const timeoutTimer = window.setTimeout(() => {
    abortedByTimeout = true;
    requestController.abort();
  }, DEFAULT_PART_PUT_TIMEOUT_MS);
  const cleanup = () => {
    signal.removeEventListener("abort", onAbort);
    window.clearTimeout(timeoutTimer);
  };

  if (signal.aborted) {
    throw new UploadAbortedError();
  }

  signal.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: payload,
      signal: requestController.signal,
    });
    cleanup();

    const etag = response.headers.get("ETag") ?? response.headers.get("etag");

    if (!response.ok) {
      throw new ApiError(`分片上传失败（HTTP ${response.status}）`, -1, response.status);
    }

    onProgress?.(payload.byteLength);
    if (!etag?.trim()) {
      throw new ApiError("分片上传成功，但未返回 ETag。", -1, response.status);
    }
    return etag.trim();
  } catch (error) {
    cleanup();

    if (abortedByParent || signal.aborted) {
      throw new UploadAbortedError();
    }

    if (abortedByTimeout) {
      throw new ApiError(
        `分片上传超时（${DEFAULT_PART_PUT_TIMEOUT_MS / 1000} 秒），请检查对象存储连通性后重试。`,
        -1,
        408,
      );
    }

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("分片上传失败，请检查网络后重试。", -1, 0);
  }
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
    const cleanup = () => signal.removeEventListener("abort", onAbort);

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
          `分片上传超时（${DEFAULT_PART_PUT_TIMEOUT_MS / 1000} 秒），请检查对象存储连通性后重试。`,
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
  if (ENABLE_MULTIPART_FETCH_PUT) {
    return await putMultipartPartToPresignedUrlWithFetch(
      uploadUrl,
      payload,
      signal,
      partContext,
      onProgress,
    );
  }
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

  throwIfAborted(signal);

  const session = await initMultipartUploadTask(taskId, {
    kind,
    fileName: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified,
  });
  onSessionReady?.(session);
  return await resumeMultipartUploadTask({
    ...options,
    session,
  });
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
  } = options;

  throwIfAborted(signal);

  const completedPartsMap = new Map<number, UploadMultipartSessionRecord["uploadedParts"][number]>(
    session.uploadedParts.map((part) => [part.partNumber, part]),
  );
  const inflightPartBytes = new Map<number, number>();
  const emitSessionUpdate = () => {
    onSessionUpdate?.(buildSessionSnapshot(session, completedPartsMap));
  };
  const emitProgress = () => {
    const uploadedBytes = [...completedPartsMap.values()].reduce((sum, part) => sum + part.partSize, 0);
    const inflightBytes = [...inflightPartBytes.values()].reduce((sum, size) => sum + size, 0);
    onProgress?.(createProgress(uploadedBytes + inflightBytes, file.size));
  };

  emitSessionUpdate();
  emitProgress();

  if (session.status === "completed" && session.modelFileId != null) {
    onProgress?.(createProgress(file.size, file.size));
    return await completeMultipartUpload(taskId, kind);
  }

  const pendingPartNumbers = [...new Set(session.missingParts)].sort((a, b) => a - b);
  const uploadPart = async (partNumber: number) => {
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
        const presigned = await presignMultipartParts(taskId, kind, {
          partNumbers: [partNumber],
        });
        const signedPart = presigned.parts.find((part) => part.partNumber === partNumber);
        if (!signedPart) {
          throw new ApiError(`分片 ${partNumber} 未返回上传地址。`, -1, 500);
        }

        inflightPartBytes.set(partNumber, 0);
        emitProgress();
        const etag = await putMultipartPartToPresignedUrl(
          signedPart.uploadUrl,
          payload,
          signal,
          partContext,
          (loaded) => {
            inflightPartBytes.set(partNumber, loaded);
            emitProgress();
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
        emitProgress();
        return;
      } catch (error) {
        inflightPartBytes.delete(partNumber);
        emitProgress();
        if (error instanceof UploadAbortedError) {
          throw error;
        }
        lastError = error;
        if (attempt >= maxRetries) {
          break;
        }
      }
    }

    throw lastError ?? new ApiError(`分片 ${partNumber} 上传失败。`, -1, 500);
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

  const result = await completeMultipartUpload(taskId, kind);
  onSessionUpdate?.({
    ...buildSessionSnapshot(session, completedPartsMap),
    status: "completed",
    modelFileId: result.fileId,
  });
  onProgress?.(createProgress(file.size, file.size));
  return result;
}
