import {
  abortMultipartUpload,
  bindUploadTaskFile,
  cancelUploadTask,
  heartbeatUploadTask,
  publishUploadTask,
  updateUploadTaskStatus,
} from "@/lib/api/upload-tasks";
import {
  presignUpload,
  putFileToPresignedUrl,
  uploadCallback,
  UploadAbortedError,
  type UploadProgress,
} from "@/lib/api/uploads";
import { ApiError } from "@/lib/http";
import type { PublishUploadTaskResult } from "@/lib/api/upload-tasks";
import { runMultipartUploadTask } from "./multipart-runner";
import type {
  PersistedUploadTaskRecord,
  UploadTask,
  UploadTaskError,
  UploadTaskStage,
} from "./types";
import { toPersistedStage } from "./types";

const HEARTBEAT_INTERVAL_MS = 15_000;
const STALL_TIMEOUT_MS = 60_000;
const parsedMultipartModelMinMb = Number(
  process.env.NEXT_PUBLIC_MULTIPART_MODEL_MIN_MB ?? "5",
);
const MULTIPART_MODEL_MIN_MB =
  Number.isFinite(parsedMultipartModelMinMb) && parsedMultipartModelMinMb >= 0
    ? parsedMultipartModelMinMb
    : 0;
const MULTIPART_MODEL_THRESHOLD_BYTES = MULTIPART_MODEL_MIN_MB * 1024 * 1024;
const ENABLE_UPLOAD_DEBUG_LOG = true;

interface RunUploadTaskHooks {
  onAbortController: (controller: AbortController | null) => void;
  onStageChange: (stage: UploadTaskStage) => void;
  onModelProgress: (progress: UploadProgress) => void;
  onCoverProgress: (progress: UploadProgress) => void;
  onRemoteTaskUpdate?: (task: PersistedUploadTaskRecord) => void;
}

function createTaskError(
  stage: UploadTaskStage,
  error: unknown,
): UploadTaskError {
  const stageMessage = getStageMessage(stage);
  const detail = error instanceof ApiError ? error.message : "发布失败，请稍后重试。";
  return {
    stage,
    message: detail.startsWith(stageMessage) ? detail : `${stageMessage}：${detail}`,
  };
}

function getStageMessage(stage: UploadTaskStage): string {
  switch (stage) {
    case "presigning-model":
      return "模型文件预签名";
    case "uploading-model":
      return "上传模型文件";
    case "callbacking-model":
      return "模型文件回调登记";
    case "presigning-cover":
      return "封面上传预签名";
    case "uploading-cover":
      return "上传封面";
    case "callbacking-cover":
      return "封面上传回调登记";
    case "creating-model":
      return "发布模型";
    default:
      return "发布";
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new UploadAbortedError();
  }
}

export async function runUploadTask(
  task: UploadTask,
  hooks: RunUploadTaskHooks,
): Promise<PublishUploadTaskResult> {
  const { draft } = task;
  if (ENABLE_UPLOAD_DEBUG_LOG) {
    console.log(
      `[upload-runner] runUploadTask entered | uploadTaskId=${task.uploadTaskId} stage=${(task as any)['stage' as keyof UploadTask]} modelFile=${draft.modelFile?.name ?? 'N/A'} size=${draft.modelFile?.size ?? 0} coverFile=${draft.coverFile?.name ?? 'N/A'}`,
    );
  }
  const debug = (msg: string) => {
    if (ENABLE_UPLOAD_DEBUG_LOG) {
      console.log(`[upload-runner] ${msg}`);
    }
  };
  const abortController = new AbortController();
  let currentStage: UploadTaskStage = "queued";
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let latestRemoteTask: PersistedUploadTaskRecord | null = null;
  let modelMultipartStarted = false;
  let modelMultipartCompleted = false;
  let stallDeadline = Date.now() + STALL_TIMEOUT_MS;

  const updateStallDeadline = () => {
    stallDeadline = Date.now() + STALL_TIMEOUT_MS;
  };

  const checkStall = () => {
    if (Date.now() > stallDeadline) {
      throw new ApiError(
        `上传卡住超过 ${STALL_TIMEOUT_MS / 1000} 秒，请刷新页面后重试。`,
        -1,
        408,
      );
    }
  };

  const stallCheckTimer = setInterval(checkStall, 10_000);

  const syncRemoteTask = async (payload: {
    status?: "running" | "processing" | "failed" | "canceled" | "interrupted";
    stage?: ReturnType<typeof toPersistedStage>;
    lastErrorStage?: ReturnType<typeof toPersistedStage>;
    lastErrorCode?: string;
    lastErrorMessage?: string;
    currentModelObjectKey?: string;
    currentCoverObjectKey?: string;
  }) => {
    if (task.uploadTaskId == null) return null;
    latestRemoteTask = await updateUploadTaskStatus(task.uploadTaskId, payload);
    hooks.onRemoteTaskUpdate?.(latestRemoteTask);
    return latestRemoteTask;
  };

  const sendHeartbeat = async () => {
    if (task.uploadTaskId == null) return;
    const remoteTask = await heartbeatUploadTask(task.uploadTaskId);
    latestRemoteTask = remoteTask;
    hooks.onRemoteTaskUpdate?.(remoteTask);
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer != null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    if (task.uploadTaskId == null) return;
    debug(`startHeartbeat | taskId=${task.uploadTaskId} interval=${HEARTBEAT_INTERVAL_MS}ms`);
    heartbeatTimer = setInterval(() => {
      void sendHeartbeat().catch(() => undefined);
    }, HEARTBEAT_INTERVAL_MS);
  };

  const setStage = (stage: UploadTaskStage) => {
    currentStage = stage;
    hooks.onStageChange(stage);
    updateStallDeadline();
  };
  hooks.onAbortController(abortController);

  const onModelProgress = (progress: UploadProgress) => {
    updateStallDeadline();
    hooks.onModelProgress(progress);
  };

  const onCoverProgress = (progress: UploadProgress) => {
    updateStallDeadline();
    hooks.onCoverProgress(progress);
  };

  try {
    await syncRemoteTask({
      status: "running",
      stage: "queued",
    });
    await sendHeartbeat().catch(() => undefined);
    startHeartbeat();

    const url = draft.viewerUrl?.trim() ?? "";
    let modelFileId: number | undefined;
    let coverFileId: number | undefined;

    if (draft.modelFile) {
      const mime = draft.modelFile.type || "application/octet-stream";
      const shouldUseMultipart = draft.modelFile.size >= MULTIPART_MODEL_THRESHOLD_BYTES;

      setStage("presigning-model");
      await syncRemoteTask({
        status: "running",
        stage: "presigning_model",
      });
      throwIfAborted(abortController.signal);
      if (shouldUseMultipart) {
        if (task.uploadTaskId == null) {
          throw new ApiError("上传任务不存在，请重新创建后再试。", -1, 400);
        }

        const multipartResult = await runMultipartUploadTask({
          taskId: task.uploadTaskId,
          kind: "model",
          file: draft.modelFile,
          signal: abortController.signal,
          onSessionReady: (session) => {
            modelMultipartStarted = true;
            setStage("uploading-model");
            void syncRemoteTask({
              status: "running",
              stage: "uploading_model",
              currentModelObjectKey: session.objectKey,
            }).catch(() => undefined);
          },
          onProgress: onModelProgress,
        });

        modelMultipartCompleted = true;
        setStage("callbacking-model");
        await syncRemoteTask({
          status: "running",
          stage: "callbacking_model",
          currentModelObjectKey: multipartResult.objectKey,
        });
        modelFileId = multipartResult.fileId;
        throwIfAborted(abortController.signal);
      } else {
        const modelPresign = await presignUpload({
          kind: "model",
          fileName: draft.modelFile.name,
          mime,
          size: draft.modelFile.size,
        });

        setStage("uploading-model");
        await syncRemoteTask({
          status: "running",
          stage: "uploading_model",
          currentModelObjectKey: modelPresign.r2Key,
        });
        throwIfAborted(abortController.signal);
        await putFileToPresignedUrl(
          modelPresign.uploadUrl,
          draft.modelFile,
          modelPresign.requiredHeaders,
          {
            signal: abortController.signal,
            onProgress: onModelProgress,
          },
        );

        setStage("callbacking-model");
        await syncRemoteTask({
          status: "running",
          stage: "callbacking_model",
          currentModelObjectKey: modelPresign.r2Key,
        });
        throwIfAborted(abortController.signal);
        const modelCallback = await uploadCallback({
          kind: "model",
          r2Key: modelPresign.r2Key,
          originalName: draft.modelFile.name,
          mime,
          size: draft.modelFile.size,
        });
        modelFileId = modelCallback.fileId;
        if (task.uploadTaskId != null) {
          latestRemoteTask = await bindUploadTaskFile(task.uploadTaskId, {
            kind: "model",
            fileId: modelFileId,
          });
          hooks.onRemoteTaskUpdate?.(latestRemoteTask);
        }
        throwIfAborted(abortController.signal);
      }
    }

    if (draft.coverFile) {
      const mime = draft.coverFile.type || "application/octet-stream";

      setStage("presigning-cover");
      await syncRemoteTask({
        status: "running",
        stage: "presigning_cover",
      });
      throwIfAborted(abortController.signal);
      const coverPresign = await presignUpload({
        kind: "cover",
        fileName: draft.coverFile.name,
        mime,
        size: draft.coverFile.size,
      });

      setStage("uploading-cover");
      await syncRemoteTask({
        status: "running",
        stage: "uploading_cover",
        currentCoverObjectKey: coverPresign.r2Key,
      });
      throwIfAborted(abortController.signal);
      await putFileToPresignedUrl(
        coverPresign.uploadUrl,
        draft.coverFile,
        coverPresign.requiredHeaders,
        {
          signal: abortController.signal,
          onProgress: onCoverProgress,
        },
      );

      setStage("callbacking-cover");
      await syncRemoteTask({
        status: "running",
        stage: "callbacking_cover",
        currentCoverObjectKey: coverPresign.r2Key,
      });
      throwIfAborted(abortController.signal);
      const coverCallback = await uploadCallback({
        kind: "cover",
        r2Key: coverPresign.r2Key,
        originalName: draft.coverFile.name,
        mime,
        size: draft.coverFile.size,
      });
      coverFileId = coverCallback.fileId;
      if (task.uploadTaskId != null) {
        latestRemoteTask = await bindUploadTaskFile(task.uploadTaskId, {
          kind: "cover",
          fileId: coverFileId,
        });
        hooks.onRemoteTaskUpdate?.(latestRemoteTask);
      }
      throwIfAborted(abortController.signal);
    }

    if (!modelFileId && !url) {
      throw new ApiError("请上传模型文件或填写在线查看链接", -1, 400);
    }

    setStage("creating-model");
    await syncRemoteTask({
      status: "running",
      stage: "creating_model",
    });
    throwIfAborted(abortController.signal);

    if (task.uploadTaskId == null) {
      throw new ApiError("上传任务不存在，请重新创建后再试。", -1, 400);
    }

    stopHeartbeat();
    const result = await publishUploadTask(task.uploadTaskId);
    latestRemoteTask = result.task;
    hooks.onRemoteTaskUpdate?.(result.task);
    return result;
  } catch (error) {
    if (error instanceof UploadAbortedError) {
      stopHeartbeat();
      if (task.uploadTaskId != null) {
        if (modelMultipartStarted && !modelMultipartCompleted) {
          try {
            await abortMultipartUpload(task.uploadTaskId, "model");
          } catch {
            // multipart abort 失败不阻塞任务取消，避免吞掉本地取消结果。
          }
        }
        try {
          latestRemoteTask = await cancelUploadTask(task.uploadTaskId);
          hooks.onRemoteTaskUpdate?.(latestRemoteTask);
        } catch {
          // 忽略取消同步失败，避免吞掉本地中断结果。
        }
      }
      throw error;
    }
    stopHeartbeat();
    const taskError = createTaskError(currentStage, error);
    if (task.uploadTaskId != null) {
      try {
        latestRemoteTask = await updateUploadTaskStatus(task.uploadTaskId, {
          status: "failed",
          stage: "failed",
          lastErrorStage: toPersistedStage(taskError.stage),
          lastErrorMessage: taskError.message,
        });
        hooks.onRemoteTaskUpdate?.(latestRemoteTask);
      } catch {
        // 失败回写不阻塞原始错误上抛。
      }
    }
    throw taskError;
  } finally {
    clearInterval(stallCheckTimer);
    stopHeartbeat();
    hooks.onAbortController(null);
  }
}
