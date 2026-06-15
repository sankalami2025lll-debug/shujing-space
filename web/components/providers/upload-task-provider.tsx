"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import {
  cancelUploadTask as cancelUploadTaskRequest,
  createUploadTask,
  getMultipartSession,
  getMyUploadTasks,
  heartbeatUploadTask,
  markUploadTaskInterruptedKeepalive,
  publishUploadTask,
  updateUploadTaskStatus,
  verifyMultipartFile,
} from "@/lib/api/upload-tasks";
import { UploadAbortedError } from "@/lib/api/uploads";
import { ApiError } from "@/lib/http";
import { createUploadFileFingerprint } from "@/lib/upload-task/fingerprint";
import { resumeMultipartUploadTask } from "@/lib/upload-task/multipart-runner";
import { runUploadTask } from "@/lib/upload-task/task-runner";
import type {
  LocalUploadTaskStage,
  LocalRuntimeUploadTask,
  PersistedUploadTask,
  PersistedUploadTaskRecord,
  UploadTask,
  UploadTaskCallbacks,
  UploadTaskDraft,
  UploadTaskError,
  UploadTaskResumeInfo,
  UploadTaskResumeSession,
} from "@/lib/upload-task/types";
import { isLocalRuntimeUploadTask, isPersistedUploadTask, toPersistedStage } from "@/lib/upload-task/types";

const HEARTBEAT_INTERVAL_MS = 15_000;

interface UploadTaskContextValue {
  tasks: UploadTask[];
  localTasks: LocalRuntimeUploadTask[];
  persistedTasks: PersistedUploadTask[];
  createTask: (
    draft: UploadTaskDraft,
    callbacks?: UploadTaskCallbacks,
  ) => Promise<LocalRuntimeUploadTask>;
  startTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  prepareResumeTask: (taskId: string, file: File) => Promise<void>;
  resumeTask: (taskId: string, file: File) => Promise<void>;
  dismissTask: (taskId: string) => void;
  getTask: (taskId: string) => UploadTask | undefined;
}

const UploadTaskContext = createContext<UploadTaskContextValue | null>(null);

function createTaskId() {
  return `upload-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createClientToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `upload-task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createInitialTask(
  draft: UploadTaskDraft,
  record: PersistedUploadTaskRecord,
): LocalRuntimeUploadTask {
  return {
    id: createTaskId(),
    kind: "local",
    clientToken: record.clientToken,
    uploadTaskId: record.id,
    status: "queued",
    stage: "queued",
    draft,
    modelProgress: draft.modelFile
      ? { loaded: 0, total: draft.modelFile.size, percent: 0 }
      : null,
    coverProgress: draft.coverFile
      ? { loaded: 0, total: draft.coverFile.size, percent: 0 }
      : null,
    error: null,
    createdModelId: null,
    abortController: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    coverUrl: record.coverUrl || undefined,
    resume: null,
  };
}

function createInitialProgress(file?: File | null) {
  return file ? { loaded: 0, total: file.size, percent: 0 } : null;
}

function toInterruptedError(message?: string | null): UploadTaskError {
  return {
    message: message?.trim() || "上传已中断，需要重新选择文件。",
    stage: "interrupted",
  };
}

function toLocalStage(stage: PersistedUploadTaskRecord["stage"]): LocalRuntimeUploadTask["stage"] {
  switch (stage) {
    case "presigning_model":
      return "presigning-model";
    case "uploading_model":
      return "uploading-model";
    case "callbacking_model":
      return "callbacking-model";
    case "presigning_cover":
      return "presigning-cover";
    case "uploading_cover":
      return "uploading-cover";
    case "callbacking_cover":
      return "callbacking-cover";
    case "creating_model":
      return "creating-model";
    case "published":
      return "processing";
    default:
      return stage;
  }
}

function patchFromPersistedTask(record: PersistedUploadTaskRecord): Partial<LocalRuntimeUploadTask> {
  const patch: Partial<LocalRuntimeUploadTask> = {
    clientToken: record.clientToken,
    uploadTaskId: record.id,
    createdModelId: record.modelId,
    coverUrl: record.coverUrl || undefined,
    updatedAt: record.updatedAt,
  };

  if (record.status === "failed") {
    patch.status = "failed";
    patch.stage = "failed";
    patch.error = record.lastErrorMessage
      ? { message: record.lastErrorMessage, stage: toLocalStage(record.stage) }
      : null;
  } else if (record.status === "canceled") {
    patch.status = "canceled";
    patch.stage = "canceled";
    patch.error = null;
  } else if (record.status === "interrupted") {
    patch.status = "interrupted";
    patch.stage = "interrupted";
    patch.error = toInterruptedError(record.lastErrorMessage);
  } else if (record.status === "processing" || record.status === "published") {
    patch.status = "success";
    patch.stage = "processing";
    patch.error = null;
  }

  return patch;
}

function buildCreateUploadTaskPayload(draft: UploadTaskDraft, clientToken: string) {
  return {
    clientToken,
    title: draft.title,
    type: draft.modelType,
    scenes: draft.scenes,
    description: draft.description?.trim() || undefined,
    visibility: draft.visibility,
    viewerUrl: draft.viewerUrl?.trim() || undefined,
    plannedModelName: draft.modelFile?.name,
    plannedModelSize: draft.modelFile?.size,
    plannedModelMime: draft.modelFile?.type || undefined,
    plannedCoverName: draft.coverFile?.name,
    plannedCoverSize: draft.coverFile?.size,
    plannedCoverMime: draft.coverFile?.type || undefined,
  };
}

function hydratePersistedTask(record: PersistedUploadTaskRecord): PersistedUploadTask {
  const shouldRenderInterrupted = record.modelId == null && (
    record.status === "queued" || record.status === "running"
  );
  const status: PersistedUploadTask["status"] = shouldRenderInterrupted
    ? "interrupted"
    : record.status;
  const stage: PersistedUploadTask["stage"] = shouldRenderInterrupted
    ? "interrupted"
    : record.stage;
  const error =
    status === "interrupted"
      ? toInterruptedError(record.lastErrorMessage)
      : record.lastErrorMessage
        ? {
            message: record.lastErrorMessage,
            stage,
          }
        : null;

  return {
    id: `persisted-${record.id}`,
    kind: "persisted",
    clientToken: record.clientToken,
    uploadTaskId: record.id,
    status,
    stage,
    draft: {
      title: record.title,
      modelType: record.type,
      scenes: record.scenes,
      description: record.description || undefined,
      visibility: record.visibility,
      viewerUrl: record.viewerUrl ?? undefined,
      modelFile: null,
      coverFile: null,
    },
    modelProgress: null,
    coverProgress: null,
    error,
    createdModelId: record.modelId,
    abortController: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    coverUrl: record.coverUrl,
    resume: null,
    attemptCount: record.attemptCount,
    modelFileId: record.modelFileId,
    coverFileId: record.coverFileId,
    currentModelObjectKey: record.currentModelObjectKey,
    currentCoverObjectKey: record.currentCoverObjectKey,
  };
}

function toResumeSession(session: Awaited<ReturnType<typeof getMultipartSession>>): UploadTaskResumeSession {
  return {
    sessionId: session.sessionId,
    status: session.status,
    objectKey: session.objectKey,
    fileName: session.fileName,
    originalName: session.originalName,
    fileSize: session.fileSize,
    fileLastModified: session.fileLastModified,
    fingerprintAlgo: session.fingerprintAlgo,
    fingerprint: session.fingerprint,
    partSize: session.partSize,
    totalParts: session.totalParts,
    uploadedBytes: session.uploadedBytes,
    completedPartsCount: session.completedPartsCount,
    uploadedParts: session.uploadedParts,
    missingParts: session.missingParts,
    canResume: session.canResume,
  };
}

function createResumeInfo(
  session: Awaited<ReturnType<typeof getMultipartSession>>,
  overrides: Partial<UploadTaskResumeInfo> = {},
): UploadTaskResumeInfo {
  return createResumeInfoFromSession(toResumeSession(session), overrides);
}

function createResumeInfoFromSession(
  session: UploadTaskResumeSession,
  overrides: Partial<UploadTaskResumeInfo> = {},
): UploadTaskResumeInfo {
  return {
    canResume: session.canResume,
    state: "idle",
    hint: session.canResume ? "需要重新选择原始文件" : null,
    verifyReason: null,
    session,
    verifiedFileName: null,
    verifiedFileSize: null,
    verifiedFingerprintAlgo: null,
    verifiedFingerprint: null,
    ...overrides,
  };
}

function copyResumeVerificationFields(resume: UploadTaskResumeInfo | null) {
  return {
    verifiedFileName: resume?.verifiedFileName ?? null,
    verifiedFileSize: resume?.verifiedFileSize ?? null,
    verifiedFingerprintAlgo: resume?.verifiedFingerprintAlgo ?? null,
    verifiedFingerprint: resume?.verifiedFingerprint ?? null,
  };
}

function buildResumeUploadingHint(session: UploadTaskResumeSession): string {
  if (session.totalParts <= 0) {
    return "继续上传中";
  }
  if (session.missingParts.length === 0) {
    return `继续上传中 · 已完成 ${session.completedPartsCount}/${session.totalParts} 分片`;
  }
  return `继续上传中 · 已完成 ${session.completedPartsCount}/${session.totalParts} 分片`;
}

function createResumeUploadingInfo(
  session: UploadTaskResumeSession,
  resume: UploadTaskResumeInfo | null,
  hint = buildResumeUploadingHint(session),
): UploadTaskResumeInfo {
  return createResumeInfoFromSession(session, {
    state: "uploading",
    hint,
    verifyReason: null,
    ...copyResumeVerificationFields(resume),
  });
}

function toResumeFailureMessage(error: unknown): string {
  const rawMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "";

  if (
    (error instanceof ApiError && (error.status === 404 || error.status === 409)) ||
    /NoSuchUpload|uploadId|multipart 会话不存在|会话已失效|当前任务无法继续/i.test(rawMessage)
  ) {
    return "上传会话已失效，请重新发布";
  }

  if (rawMessage.trim()) {
    return rawMessage;
  }

  return "继续上传失败，请稍后重试。";
}

function mergePersistedTask(
  record: PersistedUploadTaskRecord,
  resume: UploadTaskResumeInfo | null,
): PersistedUploadTask {
  return {
    ...hydratePersistedTask(record),
    resume,
  };
}

function shouldFetchResumeSession(record: PersistedUploadTaskRecord): boolean {
  return (
    record.modelId == null &&
    (record.status === "interrupted" ||
      record.status === "failed" ||
      record.status === "running")
  );
}

function createResumeReadyTask(task: UploadTask, file: File, resume: UploadTaskResumeInfo): LocalRuntimeUploadTask {
  const loaded = resume.session?.uploadedBytes ?? 0;
  const total = file.size;
  const percent = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
  return {
    id: `resume-${task.uploadTaskId ?? task.id}`,
    kind: "local",
    clientToken: task.clientToken,
    uploadTaskId: task.uploadTaskId,
    status: "resume_ready",
    stage: "resume_ready",
    draft: {
      ...task.draft,
      modelFile: file,
      coverFile: null,
    },
    modelProgress: { loaded, total, percent },
    coverProgress: null,
    error: null,
    createdModelId: task.createdModelId,
    abortController: null,
    createdAt: task.createdAt,
    updatedAt: new Date().toISOString(),
    coverUrl: task.coverUrl,
    resume,
  };
}

function mergeVisibleTasks(
  localTasks: LocalRuntimeUploadTask[],
  persistedTasks: PersistedUploadTask[],
): UploadTask[] {
  const takenUploadTaskIds = new Set<number>();
  const takenClientTokens = new Set<string>();

  for (const task of localTasks) {
    if (task.uploadTaskId != null) takenUploadTaskIds.add(task.uploadTaskId);
    if (task.clientToken) takenClientTokens.add(task.clientToken);
  }

  return [...localTasks, ...persistedTasks.filter((task) => {
    if (takenUploadTaskIds.has(task.uploadTaskId)) return false;
    if (task.clientToken && takenClientTokens.has(task.clientToken)) return false;
    return true;
  })].sort((a, b) => {
    const updated = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (updated !== 0) return updated;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function UploadTaskProvider({ children }: { children: ReactNode }) {
  const { isAuthed, bootstrapping } = useAuth();
  const [localTasks, setLocalTasks] = useState<LocalRuntimeUploadTask[]>([]);
  const [persistedTasks, setPersistedTasks] = useState<PersistedUploadTask[]>([]);
  const localTasksRef = useRef<LocalRuntimeUploadTask[]>([]);
  const persistedTasksRef = useRef<PersistedUploadTask[]>([]);
  const callbacksRef = useRef<Map<string, UploadTaskCallbacks>>(new Map());
  const preparingResumeTaskIdsRef = useRef<Set<number>>(new Set());
  const runningResumeTaskIdsRef = useRef<Set<number>>(new Set());

  const syncLocalTasks = useCallback(
    (
      updater:
        | LocalRuntimeUploadTask[]
        | ((current: LocalRuntimeUploadTask[]) => LocalRuntimeUploadTask[]),
    ) => {
      const next =
        typeof updater === "function"
          ? updater(localTasksRef.current)
          : updater;
      localTasksRef.current = next;
      setLocalTasks(next);
      return next;
    },
    [],
  );

  const syncPersistedTasks = useCallback((next: PersistedUploadTask[]) => {
    persistedTasksRef.current = next;
    setPersistedTasks(next);
  }, []);

  const upsertPersistedTaskRecord = useCallback(
    (
      record: PersistedUploadTaskRecord,
      resume?: UploadTaskResumeInfo | null,
    ) => {
      let matched = false;
      const next = persistedTasksRef.current.map((item) => {
        if (item.uploadTaskId !== record.id) {
          return item;
        }
        matched = true;
        return mergePersistedTask(
          record,
          resume === undefined ? item.resume : resume,
        );
      });

      if (!matched) {
        next.push(mergePersistedTask(record, resume ?? null));
      }

      syncPersistedTasks(next);
    },
    [syncPersistedTasks],
  );

  const tasks = useMemo(
    () => mergeVisibleTasks(localTasks, persistedTasks),
    [localTasks, persistedTasks],
  );

  const getTask = useCallback((taskId: string) => {
    return mergeVisibleTasks(localTasksRef.current, persistedTasksRef.current).find(
      (task) => task.id === taskId,
    );
  }, []);

  const getLocalTask = useCallback((taskId: string) => {
    return localTasksRef.current.find((task) => task.id === taskId);
  }, []);

  const getPersistedTask = useCallback((taskId: string) => {
    return persistedTasksRef.current.find((task) => task.id === taskId);
  }, []);

  const refreshPersistedTasks = useCallback(() => {
    return getMyUploadTasks()
      .then(async (records) => {
        // 对于 status=running + modelId=null 的任务（数据库中的卡死任务），
        // 刷新页面后 File 对象已丢失，若没有 multipart session 则无法恢复，
        // 标记为 interrupted 并提示用户重新选择文件。
        // 即使有 currentModelObjectKey（文件已上传到 OSS），但 model_file_id 为 null
        // 说明文件上传/callback 未完成，本地没有 File 对象就无法继续。
        const recordsWithInterruptedFallback = records.map((record) => {
          if (
            (record.status === "running" || record.status === "processing") &&
            record.modelId == null &&
            record.modelFileId == null
          ) {
            // 如果本地有对应 uploadTaskId 且正在运行的任务，不转为 interrupted
            const localOwned = localTasksRef.current.some(
              (t) => t.uploadTaskId === record.id && t.status === "running",
            );
            if (localOwned) return record;
            return {
              ...record,
              status: "interrupted" as const,
              lastErrorMessage: record.lastErrorMessage ||
                "浏览器无法恢复本地文件，请重新选择文件上传。",
            };
          }
          return record;
        });
        const hydratedFallback = recordsWithInterruptedFallback.map(hydratePersistedTask);

        syncPersistedTasks(hydratedFallback);
        const resumed = await Promise.all(
          hydratedFallback.map(async (task, index) => {
            const record = recordsWithInterruptedFallback[index];
            if (!shouldFetchResumeSession(record)) {
              return task;
            }
            try {
              const session = await getMultipartSession(record.id, "model");
              return {
                ...task,
                resume: createResumeInfo(session),
              };
            } catch {
              return task;
            }
          }),
        );
        syncPersistedTasks(resumed);
        return recordsWithInterruptedFallback;
      })
      .catch(() => {
        syncPersistedTasks([]);
        return [];
      });
  }, [syncPersistedTasks]);

  const patchTask = useCallback(
    (taskId: string, patch: Partial<LocalRuntimeUploadTask>) => {
      syncLocalTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? { ...task, ...patch, updatedAt: new Date().toISOString() }
            : task,
        ),
      );
    },
    [syncLocalTasks],
  );

  const createTask = useCallback(
    async (draft: UploadTaskDraft, callbacks?: UploadTaskCallbacks) => {
      const clientToken = createClientToken();
      const remoteTask = await createUploadTask(buildCreateUploadTaskPayload(draft, clientToken));
      const task = createInitialTask(draft, remoteTask);
      if (callbacks) callbacksRef.current.set(task.id, callbacks);
      syncLocalTasks((current) => [...current, task]);
      syncPersistedTasks(
        persistedTasksRef.current.filter((item) => item.uploadTaskId !== remoteTask.id),
      );
      return task;
    },
    [syncLocalTasks, syncPersistedTasks],
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      const task = getLocalTask(taskId);
      if (!task || (task.status !== "queued" && task.status !== "running")) return;

      patchTask(taskId, {
        status: "canceled",
        stage: "canceled",
        abortController: null,
        error: null,
      });

      if (task.uploadTaskId != null) {
        void cancelUploadTaskRequest(task.uploadTaskId)
          .then((record) => {
            patchTask(taskId, patchFromPersistedTask(record));
          })
          .catch(() => undefined);
      }
      task.abortController?.abort();
    },
    [getLocalTask, patchTask],
  );

  const dismissTask = useCallback(
    (taskId: string) => {
      const task = getLocalTask(taskId) ?? getPersistedTask(taskId);
      if (
        !task ||
        (task.status !== "failed" &&
          task.status !== "canceled" &&
          task.status !== "success" &&
          task.status !== "interrupted" &&
          task.status !== "processing")
      ) {
        return;
      }

      callbacksRef.current.delete(taskId);
      syncLocalTasks((current) => current.filter((item) => item.id !== taskId));

      if (isPersistedUploadTask(task) && task.uploadTaskId != null) {
        void cancelUploadTaskRequest(task.uploadTaskId).catch(() => undefined);
      }
    },
    [getLocalTask, getPersistedTask, syncLocalTasks],
  );

  const startTask = useCallback(
    (taskId: string) => {
      const task = getLocalTask(taskId);
      if (!task || !isLocalRuntimeUploadTask(task) || task.status !== "queued") return;

      patchTask(taskId, {
        status: "running",
        stage: "queued",
        error: null,
      });

      const callbacks = callbacksRef.current.get(taskId);
      let currentStage: LocalUploadTaskStage = "queued";

      void runUploadTask(task, {
        onAbortController: (controller) => {
          patchTask(taskId, { abortController: controller });
        },
        onRemoteTaskUpdate: (record) => {
          patchTask(taskId, patchFromPersistedTask(record));
        },
        onStageChange: (stage) => {
          const nextStage = stage as LocalUploadTaskStage;
          currentStage = nextStage;
          patchTask(taskId, {
            status: "running",
            stage: nextStage,
          });
        },
        onModelProgress: (progress) => {
          currentStage = "uploading-model";
          patchTask(taskId, {
            status: "running",
            stage: "uploading-model",
            modelProgress: progress,
          });
        },
        onCoverProgress: (progress) => {
          currentStage = "uploading-cover";
          patchTask(taskId, {
            status: "running",
            stage: "uploading-cover",
            coverProgress: progress,
          });
        },
      })
        .then((result) => {
          patchTask(taskId, {
            status: "success",
            stage: "processing",
            createdModelId: result.task.modelId ?? result.model.id,
            error: null,
            abortController: null,
          });
          toast.success("发布成功，模型正在后台解析中");
          callbacks?.onSuccess?.(result.model);
        })
        .catch((error: unknown) => {
          if (error instanceof UploadAbortedError) {
            patchTask(taskId, {
              status: "canceled",
              stage: "canceled",
              abortController: null,
              error: null,
            });
            return;
          }

          const taskError: UploadTaskError =
            typeof error === "object" &&
            error !== null &&
            "message" in error &&
            "stage" in error
              ? (error as UploadTaskError)
              : {
                  message: "发布失败，请稍后重试。",
                  stage: currentStage === "queued" ? "failed" : currentStage,
                };

          patchTask(taskId, {
            status: "failed",
            stage: "failed",
            error: taskError,
            abortController: null,
          });
          toast.error(taskError.message);
          callbacks?.onError?.(taskError);
        });
    },
    [getLocalTask, patchTask],
  );

  const retryTask = useCallback(
    (taskId: string) => {
      const task = getTask(taskId);
      if (
        !task ||
        (task.status !== "failed" && task.status !== "interrupted")
      ) {
        return;
      }

      if (isPersistedUploadTask(task) || (!task.draft.modelFile && !task.draft.viewerUrl?.trim())) {
        toast.info("当前任务缺少本地文件，需要重新选择文件后重新发布。");
        return;
      }

      syncLocalTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status: "queued",
                stage: "queued",
                modelProgress: createInitialProgress(item.draft.modelFile),
                coverProgress: createInitialProgress(item.draft.coverFile),
                error: null,
                createdModelId: null,
                abortController: null,
              }
            : item,
        ),
      );

      startTask(taskId);
    },
    [getTask, startTask, syncLocalTasks],
  );

  const resumeTask = useCallback(
    async (taskId: string, file: File) => {
      const task = getTask(taskId);
      if (!task || task.uploadTaskId == null) return;
      const uploadTaskId = task.uploadTaskId;
      if (runningResumeTaskIdsRef.current.has(uploadTaskId)) {
        return;
      }
      if (task.status === "canceled") {
        toast.error("已取消任务不能继续上传");
        return;
      }

      runningResumeTaskIdsRef.current.add(uploadTaskId);
      const total = file.size;
      const createProgressFromLoaded = (loaded: number) => ({
        loaded,
        total,
        percent: total > 0 ? Math.min(100, (loaded / total) * 100) : 0,
      });
      let latestResumeSession: UploadTaskResumeSession | null = null;
      let currentStage: LocalUploadTaskStage = "uploading-model";
      let baseResume: UploadTaskResumeInfo | null = task.resume;
      let heartbeatTimer: number | null = null;
      const stopHeartbeat = () => {
        if (heartbeatTimer != null) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      };
      let patchRuntimeTask: (
        patch: Partial<LocalRuntimeUploadTask>,
        resume?: UploadTaskResumeInfo | null,
      ) => void = () => undefined;
      let patchPersistedResume: (resume: UploadTaskResumeInfo | null) => void = () => undefined;

      try {
        const sessionRecord = await getMultipartSession(uploadTaskId, "model");
        const initialSession = toResumeSession(sessionRecord);
        if (!initialSession.canResume) {
          toast.error("当前任务暂不支持继续上传");
          return;
        }

        const runtimeTaskId = isLocalRuntimeUploadTask(task)
          ? task.id
          : `resume-${task.uploadTaskId}`;
        baseResume =
          task.resume ??
          createResumeInfoFromSession(initialSession, copyResumeVerificationFields(task.resume));
        const runtimeTask = isLocalRuntimeUploadTask(task)
          ? task
          : createResumeReadyTask(task, file, baseResume);
        patchRuntimeTask = (
          patch: Partial<LocalRuntimeUploadTask>,
          resume?: UploadTaskResumeInfo | null,
        ) => {
          syncLocalTasks((current) => {
            let matched = false;
            const next = current.map((item) => {
              if (item.id !== runtimeTaskId) {
                return item;
              }
              matched = true;
              return {
                ...item,
                ...patch,
                resume: resume === undefined ? item.resume : resume,
                updatedAt: new Date().toISOString(),
              };
            });

            if (!matched) {
              next.push({
                ...runtimeTask,
                ...patch,
                id: runtimeTaskId,
                draft: {
                  ...runtimeTask.draft,
                  modelFile: file,
                  coverFile: null,
                },
                resume: resume === undefined ? runtimeTask.resume : resume,
                updatedAt: new Date().toISOString(),
              });
            }

            return next;
          });
        };
        patchPersistedResume = (resume: UploadTaskResumeInfo | null) => {
          syncPersistedTasks(
            persistedTasksRef.current.map((item) =>
              item.uploadTaskId === task.uploadTaskId
                ? {
                    ...item,
                    resume,
                  }
                : item,
            ),
          );
        };

        latestResumeSession = initialSession;
        currentStage =
          initialSession.missingParts.length > 0 ? "uploading-model" : "callbacking-model";
        const pushHeartbeat = async () => {
          const record = await heartbeatUploadTask(uploadTaskId);
          upsertPersistedTaskRecord(
            record,
            createResumeUploadingInfo(latestResumeSession ?? initialSession, baseResume),
          );
        };
        const startHeartbeat = () => {
          stopHeartbeat();
          heartbeatTimer = window.setInterval(() => {
            void pushHeartbeat().catch(() => undefined);
          }, HEARTBEAT_INTERVAL_MS);
        };

        const abortController = new AbortController();
        const uploadingResume = createResumeUploadingInfo(initialSession, baseResume);
        patchRuntimeTask(
          {
            status: "running",
            stage: currentStage,
            draft: {
              ...runtimeTask.draft,
              modelFile: file,
              coverFile: null,
            },
            modelProgress: createProgressFromLoaded(initialSession.uploadedBytes),
            coverProgress: null,
            error: null,
            abortController,
          },
          uploadingResume,
        );
        patchPersistedResume(uploadingResume);

        const runningRecord = await updateUploadTaskStatus(uploadTaskId, {
          status: "running",
          stage:
            initialSession.missingParts.length > 0
              ? "uploading_model"
              : "callbacking_model",
          currentModelObjectKey: initialSession.objectKey,
        });
        upsertPersistedTaskRecord(runningRecord, uploadingResume);
        await pushHeartbeat().catch(() => undefined);
        startHeartbeat();

        const multipartResult = await resumeMultipartUploadTask({
          taskId: uploadTaskId,
          kind: "model",
          file,
          signal: abortController.signal,
          session: sessionRecord,
          onProgress: (progress) => {
            patchRuntimeTask(
              {
                status: "running",
                stage: currentStage,
                modelProgress: progress,
                abortController,
              },
              createResumeUploadingInfo(latestResumeSession ?? initialSession, baseResume),
            );
          },
          onSessionUpdate: (session) => {
            latestResumeSession = toResumeSession(session);
            currentStage =
              session.missingParts.length > 0 ? "uploading-model" : "callbacking-model";
            const nextResume = createResumeUploadingInfo(latestResumeSession, baseResume);
            patchRuntimeTask(
              {
                status: "running",
                stage: currentStage,
                modelProgress: createProgressFromLoaded(session.uploadedBytes),
                abortController,
              },
              nextResume,
            );
            patchPersistedResume(nextResume);
          },
        });

        latestResumeSession = {
          ...latestResumeSession,
          status: "completed",
          uploadedBytes: file.size,
          completedPartsCount: latestResumeSession.totalParts,
          missingParts: [],
        };
        currentStage = "callbacking-model";
        patchRuntimeTask(
          {
            status: "running",
            stage: "callbacking-model",
            modelProgress: createProgressFromLoaded(file.size),
            abortController,
          },
          createResumeUploadingInfo(
            latestResumeSession,
            baseResume,
            "分片上传完成，正在发布模型…",
          ),
        );

        currentStage = "creating-model";
        const creatingRecord = await updateUploadTaskStatus(uploadTaskId, {
          status: "running",
          stage: "creating_model",
          currentModelObjectKey: multipartResult.objectKey,
        });
        upsertPersistedTaskRecord(
          creatingRecord,
          createResumeUploadingInfo(
            latestResumeSession,
            baseResume,
            "分片上传完成，正在发布模型…",
          ),
        );

        stopHeartbeat();
        const published = await publishUploadTask(uploadTaskId);
        upsertPersistedTaskRecord(published.task, null);
        patchRuntimeTask(
          {
            status: "success",
            stage: "processing",
            modelProgress: createProgressFromLoaded(file.size),
            createdModelId: published.task.modelId ?? published.model.id,
            abortController: null,
            error: null,
          },
          createResumeInfoFromSession(latestResumeSession, {
            state: "ready",
            hint: "恢复上传完成，模型正在后台解析中",
            verifyReason: null,
            ...copyResumeVerificationFields(baseResume),
          }),
        );
        void refreshPersistedTasks();
        toast.success("继续上传成功，模型正在后台解析中");
      } catch (error) {
        stopHeartbeat();

        if (error instanceof UploadAbortedError) {
          patchRuntimeTask({ abortController: null });
          return;
        }

        const message = toResumeFailureMessage(error);

        try {
          const failedSession = await getMultipartSession(uploadTaskId, "model");
          latestResumeSession = toResumeSession(failedSession);
        } catch {
          // 使用本地最新快照兜底，避免覆盖原始错误。
        }

        const fallbackSession =
          latestResumeSession ??
          task.resume?.session ?? {
            sessionId: 0,
            status: "failed",
            objectKey: "",
            fileName: file.name,
            originalName: file.name,
            fileSize: file.size,
            fileLastModified: file.lastModified,
            fingerprintAlgo: null,
            fingerprint: null,
            partSize: 0,
            totalParts: 0,
            uploadedBytes: 0,
            completedPartsCount: 0,
            uploadedParts: [],
            missingParts: [],
            canResume: true,
          };
        const failedResume = createResumeInfoFromSession(fallbackSession, {
          state: "ready",
          hint: "恢复失败，可重新选择文件继续上传",
          verifyReason: null,
          ...copyResumeVerificationFields(baseResume),
        });
        patchRuntimeTask(
          {
            status: "failed",
            stage: "failed",
            abortController: null,
            error: {
              message,
              stage: currentStage,
            },
          },
          failedResume,
        );

        try {
          const failedRecord = await updateUploadTaskStatus(uploadTaskId, {
            status: "failed",
            stage: "failed",
            lastErrorStage: toPersistedStage(currentStage),
            lastErrorMessage: message,
          });
          upsertPersistedTaskRecord(failedRecord, failedResume);
        } catch {
          patchPersistedResume(failedResume);
        }

        toast.error(message);
      } finally {
        stopHeartbeat();
        runningResumeTaskIdsRef.current.delete(uploadTaskId);
      }
    },
    [
      getTask,
      refreshPersistedTasks,
      syncLocalTasks,
      syncPersistedTasks,
      upsertPersistedTaskRecord,
    ],
  );

  const prepareResumeTask = useCallback(
    async (taskId: string, file: File) => {
      const task = getTask(taskId);
      if (!task || task.uploadTaskId == null) return;
      if (preparingResumeTaskIdsRef.current.has(task.uploadTaskId)) {
        return;
      }
      preparingResumeTaskIdsRef.current.add(task.uploadTaskId);
      let initialSession: UploadTaskResumeSession | null = null;

      try {
        const existingResume = task.resume;
        initialSession =
          existingResume?.session != null
            ? existingResume.session
            : toResumeSession(await getMultipartSession(task.uploadTaskId, "model"));

        if (!initialSession.canResume) {
          toast.error("当前任务暂不支持继续上传");
          return;
        }

        const verifyingResume: UploadTaskResumeInfo = {
          canResume: true,
          state: "verifying",
          hint: "正在校验文件…",
          verifyReason: null,
          session: initialSession,
          verifiedFileName: null,
          verifiedFileSize: null,
          verifiedFingerprintAlgo: null,
          verifiedFingerprint: null,
        };

        syncPersistedTasks(
          persistedTasksRef.current.map((item) =>
            item.id === taskId
              ? {
                  ...item,
                  resume: verifyingResume,
                }
              : item,
          ),
        );

        const fingerprint = await createUploadFileFingerprint(file);
        const verify = await verifyMultipartFile(task.uploadTaskId, "model", {
          fileName: file.name,
          fileSize: file.size,
          fileLastModified: file.lastModified,
          fingerprintAlgo: fingerprint.fingerprintAlgo,
          fingerprint: fingerprint.fingerprint,
        });

        if (!verify.matched || !verify.canResume) {
          syncPersistedTasks(
            persistedTasksRef.current.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    resume: createResumeInfo(verify.session, {
                      state: "idle",
                      hint: "需要重新选择原始文件",
                      verifyReason: verify.reason ?? "fingerprint_mismatch",
                    }),
                  }
                : item,
            ),
          );
          toast.error("请选择原始模型文件继续上传");
          return;
        }

        const readyResume = createResumeInfo(verify.session, {
          state: "ready",
          hint: "文件校验通过，可继续上传",
          verifyReason: null,
          verifiedFileName: file.name,
          verifiedFileSize: file.size,
          verifiedFingerprintAlgo: fingerprint.fingerprintAlgo,
          verifiedFingerprint: fingerprint.fingerprint,
        });

        const readyTask = createResumeReadyTask(task, file, readyResume);
        syncLocalTasks((current) => {
          const existingIndex = current.findIndex(
            (item) => item.uploadTaskId === readyTask.uploadTaskId,
          );
          if (existingIndex === -1) {
            return [...current, readyTask];
          }
          const next = [...current];
          next[existingIndex] = readyTask;
          return next;
        });
        syncPersistedTasks(
          persistedTasksRef.current.map((item) =>
            item.uploadTaskId === task.uploadTaskId
              ? {
                  ...item,
                  resume: readyResume,
                }
              : item,
          ),
        );
        toast.success("文件校验通过，开始继续上传");
        await resumeTask(readyTask.id, file);
      } catch {
        const fallbackSession: UploadTaskResumeSession =
          initialSession ??
          task.resume?.session ??
          {
            sessionId: 0,
            status: "failed",
            objectKey: "",
            fileName: file.name,
            originalName: file.name,
            fileSize: file.size,
            fileLastModified: file.lastModified,
            fingerprintAlgo: null,
            fingerprint: null,
            partSize: 0,
            totalParts: 0,
            uploadedBytes: 0,
            completedPartsCount: 0,
            uploadedParts: [],
            missingParts: [],
            canResume: true,
          };
        syncPersistedTasks(
          persistedTasksRef.current.map((item) =>
            item.id === taskId
              ? {
                  ...item,
                  resume: createResumeInfoFromSession(fallbackSession, {
                    state: "idle",
                    hint: "需要重新选择原始文件",
                    verifyReason: "fingerprint_mismatch",
                  }),
                }
              : item,
          ),
        );
        toast.error("请选择原始模型文件继续上传");
      } finally {
        preparingResumeTaskIdsRef.current.delete(task.uploadTaskId);
      }
    },
    [getTask, resumeTask, syncLocalTasks, syncPersistedTasks],
  );

  useEffect(() => {
    const callbackStore = callbacksRef.current;
    return () => {
      localTasksRef.current.forEach((task) => task.abortController?.abort());
      callbackStore.clear();
    };
  }, []);

  useEffect(() => {
    const markRunningTasksInterrupted = () => {
      for (const task of localTasksRef.current) {
        if (task.status !== "running" || task.uploadTaskId == null) continue;
        markUploadTaskInterruptedKeepalive(task.uploadTaskId);
      }
    };

    window.addEventListener("pagehide", markRunningTasksInterrupted);
    window.addEventListener("beforeunload", markRunningTasksInterrupted);
    return () => {
      window.removeEventListener("pagehide", markRunningTasksInterrupted);
      window.removeEventListener("beforeunload", markRunningTasksInterrupted);
    };
  }, []);

  useEffect(() => {
    if (bootstrapping) return;
    if (!isAuthed) {
      syncPersistedTasks([]);
      return;
    }

    void refreshPersistedTasks();
  }, [bootstrapping, isAuthed, refreshPersistedTasks, syncPersistedTasks]);

  // 上传中监听 beforeunload，提醒用户离开将丢失本地文件
  useEffect(() => {
    const hasRunningLocalUpload = localTasksRef.current.some(
      (t) => t.status === "running" || t.status === "queued",
    );
    if (!hasRunningLocalUpload) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [localTasks]);

  const value: UploadTaskContextValue = {
    tasks,
    localTasks,
    persistedTasks,
    createTask,
    startTask,
    cancelTask,
    retryTask,
    prepareResumeTask,
    resumeTask,
    dismissTask,
    getTask,
  };

  return (
    <UploadTaskContext.Provider value={value}>
      {children}
    </UploadTaskContext.Provider>
  );
}

export function useUploadTaskManager(): UploadTaskContextValue {
  const context = useContext(UploadTaskContext);
  if (!context) {
    throw new Error("useUploadTaskManager 必须在 <UploadTaskProvider> 内部使用");
  }
  return context;
}
