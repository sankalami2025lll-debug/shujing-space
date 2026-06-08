/**
 * 视图模型 / 映射：上传任务接口对外字段
 * 用途：把 Prisma UploadTask 实体裁剪为前端恢复任务卡所需字段，并统一 BigInt 转 number。
 */
import { Prisma, type ModelFile, type UploadTask } from '@prisma/client';
import type { ModelDetailVm } from '../models/model.vm';

type UploadTaskWithCover = UploadTask & {
  coverFile?: Pick<ModelFile, 'url'> | null;
};

export interface UploadTaskVm {
  id: number;
  clientToken: string | null;
  title: string;
  type: string;
  scenes: string[];
  description: string;
  visibility: UploadTask['visibility'];
  viewerUrl: string | null;
  status: UploadTask['status'];
  stage: UploadTask['stage'];
  attemptCount: number;
  modelFileId: number | null;
  coverFileId: number | null;
  modelId: number | null;
  coverUrl: string;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  plannedModelName: string | null;
  plannedModelSize: number | null;
  plannedModelMime: string | null;
  plannedCoverName: string | null;
  plannedCoverSize: number | null;
  plannedCoverMime: string | null;
  currentModelObjectKey: string | null;
  currentCoverObjectKey: string | null;
}

export interface UploadTaskPublishVm {
  task: UploadTaskVm;
  model: ModelDetailVm;
}

function toStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function toUploadTaskVm(task: UploadTaskWithCover): UploadTaskVm {
  return {
    id: Number(task.id),
    clientToken: task.clientToken ?? null,
    title: task.title,
    type: task.type,
    scenes: toStringArray(task.scenesJson),
    description: task.description,
    visibility: task.visibility,
    viewerUrl: task.viewerUrl ?? null,
    status: task.status,
    stage: task.stage,
    attemptCount: task.attemptCount,
    modelFileId: task.modelFileId == null ? null : Number(task.modelFileId),
    coverFileId: task.coverFileId == null ? null : Number(task.coverFileId),
    modelId: task.modelId == null ? null : Number(task.modelId),
    coverUrl: task.coverFile?.url ?? '',
    lastErrorMessage: task.lastErrorMessage ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    plannedModelName: task.plannedModelName ?? null,
    plannedModelSize:
      task.plannedModelSize == null ? null : Number(task.plannedModelSize),
    plannedModelMime: task.plannedModelMime ?? null,
    plannedCoverName: task.plannedCoverName ?? null,
    plannedCoverSize:
      task.plannedCoverSize == null ? null : Number(task.plannedCoverSize),
    plannedCoverMime: task.plannedCoverMime ?? null,
    currentModelObjectKey: task.currentModelObjectKey ?? null,
    currentCoverObjectKey: task.currentCoverObjectKey ?? null,
  };
}
