"use client";

import type { UploadProgress } from "@/lib/api/uploads";
import type { ModelDetail, ModelVisibility } from "@/lib/types";

export type LocalUploadTaskStatus =
  | "queued"
  | "running"
  | "resume_ready"
  | "success"
  | "failed"
  | "canceled"
  | "interrupted";

export type PersistedUploadTaskStatus =
  | "queued"
  | "running"
  | "processing"
  | "published"
  | "failed"
  | "canceled"
  | "interrupted";

export type UploadTaskStatus = LocalUploadTaskStatus | PersistedUploadTaskStatus;

export type LocalUploadTaskStage =
  | "queued"
  | "presigning-model"
  | "uploading-model"
  | "callbacking-model"
  | "presigning-cover"
  | "uploading-cover"
  | "callbacking-cover"
  | "creating-model"
  | "resume_ready"
  | "processing"
  | "failed"
  | "canceled"
  | "interrupted";

export type PersistedUploadTaskStage =
  | "queued"
  | "presigning_model"
  | "uploading_model"
  | "callbacking_model"
  | "presigning_cover"
  | "uploading_cover"
  | "callbacking_cover"
  | "creating_model"
  | "processing"
  | "published"
  | "failed"
  | "canceled"
  | "interrupted";

export type UploadTaskStage = LocalUploadTaskStage | PersistedUploadTaskStage;

export type UploadTaskSource = "local" | "persisted";

export interface UploadTaskDraft {
  title: string;
  modelType: string;
  scenes: string[];
  description?: string;
  visibility: ModelVisibility;
  viewerUrl?: string;
  modelFile?: File | null;
  coverFile?: File | null;
}

export interface UploadTaskError {
  message: string;
  stage: UploadTaskStage;
}

export type UploadResumeVerifyReason =
  | "name_mismatch"
  | "size_mismatch"
  | "fingerprint_mismatch";

export type UploadResumeState = "idle" | "verifying" | "ready" | "uploading";

export interface UploadMultipartUploadedPartSnapshot {
  partNumber: number;
  byteStart: number;
  byteEnd: number;
  partSize: number;
  etag: string | null;
  uploadedAt: string | null;
  attemptCount: number;
}

export interface UploadTaskResumeSession {
  sessionId: number;
  status: "initiated" | "uploading" | "paused" | "failed" | "completed" | "aborted";
  objectKey: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileLastModified: number | null;
  fingerprintAlgo: string | null;
  fingerprint: string | null;
  partSize: number;
  totalParts: number;
  uploadedBytes: number;
  completedPartsCount: number;
  uploadedParts: UploadMultipartUploadedPartSnapshot[];
  missingParts: number[];
  canResume: boolean;
}

export interface UploadTaskResumeInfo {
  canResume: boolean;
  state: UploadResumeState;
  hint: string | null;
  verifyReason: UploadResumeVerifyReason | null;
  session: UploadTaskResumeSession | null;
  verifiedFileName: string | null;
  verifiedFileSize: number | null;
  verifiedFingerprintAlgo: string | null;
  verifiedFingerprint: string | null;
}

export interface PersistedUploadTaskRecord {
  id: number;
  clientToken: string | null;
  title: string;
  type: string;
  scenes: string[];
  description: string;
  visibility: ModelVisibility;
  viewerUrl: string | null;
  status: PersistedUploadTaskStatus;
  stage: PersistedUploadTaskStage;
  attemptCount: number;
  modelFileId: number | null;
  coverFileId: number | null;
  modelId: number | null;
  coverUrl: string;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  plannedModelName: string | null;
  plannedModelSize: number | null;
  plannedModelMime: string | null;
  plannedCoverName: string | null;
  plannedCoverSize: number | null;
  plannedCoverMime: string | null;
  currentModelObjectKey: string | null;
  currentCoverObjectKey: string | null;
}

interface BaseUploadTask {
  id: string;
  kind: UploadTaskSource;
  clientToken: string | null;
  uploadTaskId: number | null;
  status: UploadTaskStatus;
  stage: UploadTaskStage;
  draft: UploadTaskDraft;
  modelProgress: UploadProgress | null;
  coverProgress: UploadProgress | null;
  error: UploadTaskError | null;
  createdModelId: number | null;
  abortController: AbortController | null;
  createdAt: string;
  updatedAt: string;
  coverUrl?: string;
  resume: UploadTaskResumeInfo | null;
}

export interface LocalRuntimeUploadTask extends BaseUploadTask {
  kind: "local";
  status: LocalUploadTaskStatus;
  stage: LocalUploadTaskStage;
}

export interface PersistedUploadTask extends BaseUploadTask {
  kind: "persisted";
  uploadTaskId: number;
  status: PersistedUploadTaskStatus;
  stage: PersistedUploadTaskStage;
  modelProgress: null;
  coverProgress: null;
  abortController: null;
  coverUrl: string;
  attemptCount: number;
  modelFileId: number | null;
  coverFileId: number | null;
  currentModelObjectKey: string | null;
  currentCoverObjectKey: string | null;
}

export type MergedUploadTaskView = LocalRuntimeUploadTask | PersistedUploadTask;
export type UploadTask = MergedUploadTaskView;

export function isLocalRuntimeUploadTask(task: UploadTask): task is LocalRuntimeUploadTask {
  return task.kind === "local";
}

export function isPersistedUploadTask(task: UploadTask): task is PersistedUploadTask {
  return task.kind === "persisted";
}

export interface UploadTaskCallbacks {
  onSuccess?: (model: ModelDetail) => void;
  onError?: (error: UploadTaskError) => void;
}

export function toPersistedStage(stage: UploadTaskStage): PersistedUploadTaskStage {
  switch (stage) {
    case "presigning-model":
      return "presigning_model";
    case "uploading-model":
      return "uploading_model";
    case "callbacking-model":
      return "callbacking_model";
    case "presigning-cover":
      return "presigning_cover";
    case "uploading-cover":
      return "uploading_cover";
    case "callbacking-cover":
      return "callbacking_cover";
    case "creating-model":
      return "creating_model";
    case "resume_ready":
      return "interrupted";
    default:
      return stage;
  }
}
