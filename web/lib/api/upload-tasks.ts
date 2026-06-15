"use client";

import { http } from "@/lib/http";
import { getToken } from "@/lib/token";
import type {
  PersistedUploadTaskRecord,
  PersistedUploadTaskStage,
  PersistedUploadTaskStatus,
} from "@/lib/upload-task/types";
import type { ModelDetail, ModelVisibility } from "@/lib/types";

export type MyUploadTaskFilter = "incomplete" | "all";
export type UploadTaskFileKind = "model" | "cover";
export type UploadMultipartStatus =
  | "initiated"
  | "uploading"
  | "paused"
  | "failed"
  | "completed"
  | "aborted";

export interface GetMyUploadTasksParams {
  status?: MyUploadTaskFilter;
}

export interface CreateUploadTaskPayload {
  clientToken?: string;
  title: string;
  type: string;
  scenes?: string[];
  description?: string;
  visibility: ModelVisibility;
  viewerUrl?: string;
  plannedModelName?: string;
  plannedModelSize?: number;
  plannedModelMime?: string;
  plannedCoverName?: string;
  plannedCoverSize?: number;
  plannedCoverMime?: string;
}

export interface UpdateUploadTaskStatusPayload {
  status?: PersistedUploadTaskStatus;
  stage?: PersistedUploadTaskStage;
  lastErrorStage?: PersistedUploadTaskStage;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  currentModelObjectKey?: string;
  currentCoverObjectKey?: string;
}

export interface BindUploadTaskFilePayload {
  kind: UploadTaskFileKind;
  fileId: number;
}

export interface InitMultipartUploadTaskPayload {
  kind: UploadTaskFileKind;
  fileName: string;
  mime: string;
  size: number;
  fingerprintAlgo?: string;
  fingerprint?: string;
  lastModified?: number;
}

export interface UploadMultipartPartRecord {
  partNumber: number;
  byteStart: number;
  byteEnd: number;
  partSize: number;
  etag: string | null;
  uploadedAt: string | null;
  attemptCount: number;
}

export interface UploadMultipartSessionRecord {
  sessionId: number;
  uploadTaskId: number;
  kind: UploadTaskFileKind;
  status: UploadMultipartStatus;
  objectKey: string;
  uploadId: string;
  fileName: string;
  originalName: string;
  mime: string;
  fileSize: number;
  partSize: number;
  totalParts: number;
  fingerprintAlgo: string | null;
  fingerprint: string | null;
  fileLastModified: number | null;
  uploadedBytes: number;
  completedPartsCount: number;
  modelFileId: number | null;
  canResume: boolean;
  isCurrent: boolean;
  initiatedAt: string;
  lastActivityAt: string | null;
  completedAt: string | null;
  abortedAt: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedParts: UploadMultipartPartRecord[];
  missingParts: number[];
}

export interface PresignMultipartPartsPayload {
  partNumbers: number[];
}

export interface PresignedMultipartPart {
  partNumber: number;
  uploadUrl: string;
  expiresIn: number;
  method: "PUT";
  headers: Record<string, string>;
}

export interface PresignMultipartPartsResult {
  sessionId: number;
  objectKey: string;
  uploadId: string;
  parts: PresignedMultipartPart[];
}

export interface CompleteMultipartPartPayload {
  etag: string;
  partSize: number;
}

export interface CompleteMultipartPartResult {
  sessionId: number;
  partNumber: number;
  etag: string;
  uploadedBytes: number;
  completedPartsCount: number;
  status: UploadMultipartStatus;
}

export interface CompleteMultipartUploadResult {
  sessionId: number;
  fileId: number;
  objectKey: string;
  url: string;
  kind: UploadTaskFileKind;
}

export interface AbortMultipartUploadResult {
  sessionId: number;
  status: UploadMultipartStatus;
  abortedAt: string | null;
}

export type UploadMultipartVerifyReason =
  | "name_mismatch"
  | "size_mismatch"
  | "fingerprint_mismatch";

export interface VerifyMultipartFilePayload {
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  fingerprintAlgo: string;
  fingerprint: string;
}

export interface VerifyMultipartFileResult {
  matched: boolean;
  reason?: UploadMultipartVerifyReason;
  canResume: boolean;
  session: UploadMultipartSessionRecord;
}

export interface PublishUploadTaskResult {
  task: PersistedUploadTaskRecord;
  model: ModelDetail;
}

function buildQuery(params: GetMyUploadTasksParams = {}): string {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function getMyUploadTasks(
  params: GetMyUploadTasksParams = {},
): Promise<PersistedUploadTaskRecord[]> {
  return http.get<PersistedUploadTaskRecord[]>(
    `/upload-tasks/me${buildQuery(params)}`,
  );
}

export function createUploadTask(
  payload: CreateUploadTaskPayload,
): Promise<PersistedUploadTaskRecord> {
  return http.post<PersistedUploadTaskRecord>("/upload-tasks", payload);
}

export function updateUploadTaskStatus(
  taskId: number,
  payload: UpdateUploadTaskStatusPayload,
): Promise<PersistedUploadTaskRecord> {
  return http.post<PersistedUploadTaskRecord>(`/upload-tasks/${taskId}/status`, payload);
}

export function heartbeatUploadTask(taskId: number): Promise<PersistedUploadTaskRecord> {
  return http.post<PersistedUploadTaskRecord>(`/upload-tasks/${taskId}/heartbeat`);
}

export function bindUploadTaskFile(
  taskId: number,
  payload: BindUploadTaskFilePayload,
): Promise<PersistedUploadTaskRecord> {
  return http.post<PersistedUploadTaskRecord>(`/upload-tasks/${taskId}/files`, payload);
}

export function initMultipartUploadTask(
  taskId: number,
  payload: InitMultipartUploadTaskPayload,
  options?: { signal?: AbortSignal },
): Promise<UploadMultipartSessionRecord> {
  return http.post<UploadMultipartSessionRecord>(
    `/upload-tasks/${taskId}/multipart/init`,
    payload,
    options,
  );
}

export function getMultipartSession(
  taskId: number,
  kind: UploadTaskFileKind,
): Promise<UploadMultipartSessionRecord> {
  return http.get<UploadMultipartSessionRecord>(
    `/upload-tasks/${taskId}/multipart/${kind}`,
  );
}

export function presignMultipartParts(
  taskId: number,
  kind: UploadTaskFileKind,
  payload: PresignMultipartPartsPayload,
): Promise<PresignMultipartPartsResult> {
  return http.post<PresignMultipartPartsResult>(
    `/upload-tasks/${taskId}/multipart/${kind}/parts/presign`,
    payload,
  );
}

export function completeMultipartPart(
  taskId: number,
  kind: UploadTaskFileKind,
  partNumber: number,
  payload: CompleteMultipartPartPayload,
): Promise<CompleteMultipartPartResult> {
  return http.post<CompleteMultipartPartResult>(
    `/upload-tasks/${taskId}/multipart/${kind}/parts/${partNumber}/complete`,
    payload,
  );
}

export function completeMultipartUpload(
  taskId: number,
  kind: UploadTaskFileKind,
): Promise<CompleteMultipartUploadResult> {
  return http.post<CompleteMultipartUploadResult>(
    `/upload-tasks/${taskId}/multipart/${kind}/complete`,
  );
}

export function abortMultipartUpload(
  taskId: number,
  kind: UploadTaskFileKind,
): Promise<AbortMultipartUploadResult> {
  return http.post<AbortMultipartUploadResult>(
    `/upload-tasks/${taskId}/multipart/${kind}/abort`,
  );
}

export function verifyMultipartFile(
  taskId: number,
  kind: UploadTaskFileKind,
  payload: VerifyMultipartFilePayload,
): Promise<VerifyMultipartFileResult> {
  return http.post<VerifyMultipartFileResult>(
    `/upload-tasks/${taskId}/multipart/${kind}/verify-file`,
    payload,
  );
}

export function publishUploadTask(taskId: number): Promise<PublishUploadTaskResult> {
  return http.post<PublishUploadTaskResult>(`/upload-tasks/${taskId}/publish`);
}

export function cancelUploadTask(taskId: number): Promise<PersistedUploadTaskRecord> {
  return http.post<PersistedUploadTaskRecord>(`/upload-tasks/${taskId}/cancel`);
}

export function markUploadTaskInterrupted(taskId: number): Promise<PersistedUploadTaskRecord> {
  return http.post<PersistedUploadTaskRecord>(`/upload-tasks/${taskId}/interrupted`);
}

export function markUploadTaskInterruptedKeepalive(taskId: number): void {
  if (typeof window === "undefined") return;

  const token = getToken();
  if (!token) return;

  void fetch(`/api/upload-tasks/${taskId}/interrupted`, {
    method: "POST",
    keepalive: true,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);
}
