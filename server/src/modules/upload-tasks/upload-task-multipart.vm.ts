import {
  FileKind,
  Prisma,
  type ModelFile,
  type UploadMultipartPart,
  type UploadMultipartSession,
} from '@prisma/client';

type UploadMultipartSessionWithParts = UploadMultipartSession & {
  parts?: UploadMultipartPart[];
  modelFile?: ModelFile | null;
};

export interface UploadMultipartPartVm {
  partNumber: number;
  byteStart: number;
  byteEnd: number;
  partSize: number;
  etag: string | null;
  uploadedAt: Date | null;
  attemptCount: number;
}

export interface UploadMultipartSessionVm {
  sessionId: number;
  uploadTaskId: number;
  kind: FileKind;
  status: UploadMultipartSession['status'];
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
  initiatedAt: Date;
  lastActivityAt: Date | null;
  completedAt: Date | null;
  abortedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  uploadedParts: UploadMultipartPartVm[];
  missingParts: number[];
}

export interface UploadMultipartInitVm extends UploadMultipartSessionVm {}

export interface UploadMultipartPresignedPartVm {
  partNumber: number;
  uploadUrl: string;
  expiresIn: number;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface UploadMultipartPresignPartsVm {
  sessionId: number;
  objectKey: string;
  uploadId: string;
  parts: UploadMultipartPresignedPartVm[];
}

export interface UploadMultipartPartCompleteVm {
  sessionId: number;
  partNumber: number;
  etag: string;
  uploadedBytes: number;
  completedPartsCount: number;
  status: UploadMultipartSession['status'];
}

export interface UploadMultipartCompleteVm {
  sessionId: number;
  fileId: number;
  objectKey: string;
  url: string;
  kind: FileKind;
}

export interface UploadMultipartAbortVm {
  sessionId: number;
  status: UploadMultipartSession['status'];
  abortedAt: Date | null;
}

export interface UploadMultipartVerifyFileVm {
  matched: boolean;
  reason?: 'name_mismatch' | 'size_mismatch' | 'fingerprint_mismatch';
  canResume: boolean;
  session: UploadMultipartSessionVm;
}

export function toUploadMultipartSessionVm(
  session: UploadMultipartSessionWithParts,
  canResume = false,
): UploadMultipartSessionVm {
  const parts = [...(session.parts ?? [])].sort((a, b) => a.partNumber - b.partNumber);
  const uploadedParts = parts
    .filter((part) => part.etag != null)
    .map((part) => ({
      partNumber: part.partNumber,
      byteStart: Number(part.byteStart),
      byteEnd: Number(part.byteEnd),
      partSize: Number(part.partSize),
      etag: part.etag ?? null,
      uploadedAt: part.uploadedAt ?? null,
      attemptCount: part.attemptCount,
    }));
  const missingParts = parts
    .filter((part) => part.etag == null)
    .map((part) => part.partNumber);

  return {
    sessionId: Number(session.id),
    uploadTaskId: Number(session.uploadTaskId),
    kind: session.kind,
    status: session.status,
    objectKey: session.objectKey,
    uploadId: session.ossUploadId,
    fileName: session.originalName,
    originalName: session.originalName,
    mime: session.mime,
    fileSize: Number(session.fileSize),
    partSize: Number(session.partSize),
    totalParts: session.totalParts,
    fingerprintAlgo: session.fingerprintAlgo ?? null,
    fingerprint: session.fingerprint ?? null,
    fileLastModified:
      session.fileLastModified == null ? null : Number(session.fileLastModified),
    uploadedBytes: Number(session.uploadedBytes),
    completedPartsCount: session.completedPartsCount,
    modelFileId: session.modelFileId == null ? null : Number(session.modelFileId),
    canResume,
    isCurrent: session.isCurrent,
    initiatedAt: session.initiatedAt,
    lastActivityAt: session.lastActivityAt ?? null,
    completedAt: session.completedAt ?? null,
    abortedAt: session.abortedAt ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    uploadedParts,
    missingParts,
  };
}
