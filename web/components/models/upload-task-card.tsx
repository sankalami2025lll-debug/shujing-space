"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Grid3X3, Loader2, PauseCircle, XCircle } from "lucide-react";
import { useUploadTaskManager } from "@/components/providers/upload-task-provider";
import {
  isLocalRuntimeUploadTask,
  isPersistedUploadTask,
  type UploadTask,
} from "@/lib/upload-task/types";

function badgeMeta(task: UploadTask) {
  const isParsingFailed = task.status === "failed" && task.error?.stage === "processing";
  if (task.status === "resume_ready") {
    return {
      label: "可继续",
      className: "text-emerald-100 bg-black/55 border-emerald-200/20",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    };
  }
  if (task.status === "interrupted") {
    return {
      label: "已中断",
      className: "text-amber-100 bg-black/55 border-amber-200/20",
      icon: <PauseCircle className="w-3.5 h-3.5" />,
    };
  }
  if (task.status === "failed") {
    return {
      label: isParsingFailed ? "解析失败" : "上传失败",
      className: "text-rose-200 bg-black/55 border-white/10",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    };
  }
  if (task.status === "canceled") {
    return {
      label: "已取消",
      className: "text-gray-200 bg-black/55 border-white/10",
      icon: <XCircle className="w-3.5 h-3.5" />,
    };
  }
  if (task.status === "success" || task.status === "processing") {
    return {
      label: "处理中",
      className: "text-sky-100 bg-black/55 border-sky-200/20",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    };
  }
  return {
    label: "上传中",
    className: "text-sky-100 bg-black/55 border-sky-200/20",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  };
}

function progressLabel(value: number) {
  return `${Math.min(100, Math.max(0, Math.round(value)))}%`;
}

function modelProgressPercent(task: UploadTask) {
  if (task.modelProgress) {
    return Math.min(100, Math.max(0, task.modelProgress.percent));
  }
  if (
    task.stage === "callbacking-model" ||
    task.stage === "callbacking_model" ||
    task.stage === "presigning-cover" ||
    task.stage === "presigning_cover" ||
    task.stage === "uploading-cover" ||
    task.stage === "uploading_cover" ||
    task.stage === "callbacking-cover" ||
    task.stage === "callbacking_cover" ||
    task.stage === "creating-model" ||
    task.stage === "creating_model" ||
    task.stage === "processing" ||
    task.status === "success"
  ) {
    return 100;
  }
  return 0;
}

function coverPreviewUrl(file: File | null | undefined) {
  if (!file) return null;
  return URL.createObjectURL(file);
}

export function UploadTaskCard({ task }: { task: UploadTask }) {
  const { cancelTask, retryTask, prepareResumeTask, dismissTask } = useUploadTaskManager();
  const isLocalTask = isLocalRuntimeUploadTask(task);
  const isPersistedTask = isPersistedUploadTask(task);
  const badge = badgeMeta(task);
  const title = task.draft.title || "未命名模型";
  const [imgFailed, setImgFailed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const showCoverImage = Boolean(previewUrl) && !imgFailed;
  const progress = modelProgressPercent(task);
  const progressText = progressLabel(progress);
  const isParsingFailed = task.status === "failed" && task.error?.stage === "processing";
  const showProcessing = task.status === "success" || task.status === "processing";
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const canResume = Boolean(task.resume?.canResume) && (
    task.status === "interrupted" ||
    task.status === "failed" ||
    task.status === "resume_ready"
  );
  const isResumeReady = task.status === "resume_ready" || task.resume?.state === "ready";
  const isResumeUploading = task.status === "running" && task.resume?.state === "uploading";

  useEffect(() => {
    setImgFailed(false);

    if (!task.draft.coverFile) {
      setPreviewUrl(task.coverUrl || null);
      return;
    }

    const objectUrl = coverPreviewUrl(task.draft.coverFile);
    setPreviewUrl(objectUrl);

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [task.coverUrl, task.draft.coverFile]);

  return (
    <div
      data-testid="upload-task-card"
      className="group relative h-[232.5px] w-full self-start overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all hover:border-white/20"
    >
      <div className="relative h-28 overflow-hidden bg-[linear-gradient(135deg,rgba(8,10,15,0.98),rgba(18,24,38,0.92),rgba(5,7,12,0.98))]">
        {showCoverImage ? (
          <>
            <img
              src={previewUrl ?? undefined}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.18),transparent_45%),linear-gradient(135deg,rgba(8,10,15,0.98),rgba(18,24,38,0.92),rgba(5,7,12,0.98))]" />
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Grid3X3 className="h-6 w-6 text-white/20" />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          </>
        )}
        <div className="absolute left-2.5 top-2.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] leading-none backdrop-blur-sm ${badge.className}`}
          >
            {badge.icon}
            {badge.label}
          </span>
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-4 text-center pointer-events-none">
          {task.status === "failed" ? (
            <p className="text-[14px] font-medium tracking-[0.02em] text-white/92">
              {isParsingFailed ? "解析失败" : "上传失败"}
            </p>
          ) : isResumeReady ? (
            <p className="text-[14px] font-medium tracking-[0.02em] text-emerald-100">文件校验通过</p>
          ) : task.status === "interrupted" ? (
            <p className="text-[14px] font-medium tracking-[0.02em] text-white/92">上传中断</p>
          ) : task.status === "canceled" ? (
            <p className="text-[14px] font-medium tracking-[0.02em] text-white/92">已取消</p>
          ) : showProcessing ? (
            <p className="text-[14px] font-medium tracking-[0.02em] text-white/92">处理中</p>
          ) : (
            <div className="w-full max-w-[72px]">
              <p className="text-[20px] font-medium leading-none tracking-[-0.03em] text-white/95 tabular-nums">
                {progressText}
              </p>
              <div className="mx-auto mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-sky-300/85 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-[120.5px] flex-col overflow-hidden p-3">
        <p className="text-[13px] font-medium line-clamp-1">{title}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-500 truncate">
            {task.draft.modelType}
          </span>
          {showProcessing && (
            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
              后台解析中
            </span>
          )}
        </div>
        {(task.status === "interrupted" || task.status === "failed") && canResume && (
          <p className="mt-1 text-[11px] text-amber-200/80 truncate">
            需要重新选择文件
          </p>
        )}
        {isResumeUploading && task.resume?.hint && (
          <p className="mt-1 text-[11px] text-sky-200/80 truncate">
            {task.resume.hint}
          </p>
        )}
        {isResumeReady && (
          <p className="mt-1 text-[11px] text-emerald-200/80 truncate">
            文件校验通过，可继续上传
          </p>
        )}

        <div className="mt-auto pt-3">
          {canResume && (
            <>
              <input
                ref={resumeInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  void prepareResumeTask(task.id, file);
                }}
              />
              <button
                type="button"
                onClick={() => resumeInputRef.current?.click()}
                disabled={task.resume?.state === "verifying"}
                className="mb-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gray-200 transition-all hover:border-white/20 hover:bg-white/8 disabled:cursor-default disabled:text-gray-200/70"
              >
                {task.resume?.state === "verifying" ? "校验中…" : "继续上传"}
              </button>
            </>
          )}

          {isLocalTask && (task.status === "queued" || task.status === "running") && (
            <button
              type="button"
              onClick={() => cancelTask(task.id)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gray-200 transition-all hover:border-white/20 hover:bg-white/8"
            >
              取消上传
            </button>
          )}

          {((isLocalTask && (task.status === "failed" || task.status === "interrupted")) ||
            (isPersistedTask && (task.status === "failed" || task.status === "interrupted"))) &&
            !canResume && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => retryTask(task.id)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[12px] text-gray-200 transition-all hover:border-white/20 hover:bg-white/8"
              >
                重试
              </button>
              {isLocalTask ? (
                <button
                  type="button"
                  onClick={() => dismissTask(task.id)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[12px] text-gray-200 transition-all hover:border-white/20 hover:bg-white/8"
                >
                  移除
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="刷新后本地文件已丢失，需要重新选择文件。"
                  className="w-full cursor-default rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[12px] text-gray-200/80"
                >
                  需重新选择文件
                </button>
              )}
            </div>
          )}

          {isLocalTask && task.status === "canceled" && (
            <button
              type="button"
              onClick={() => dismissTask(task.id)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gray-200 transition-all hover:border-white/20 hover:bg-white/8"
            >
              移除
            </button>
          )}

          {showProcessing && (
            <button
              type="button"
              disabled
              className="w-full cursor-default rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gray-200/80"
            >
              处理中
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
