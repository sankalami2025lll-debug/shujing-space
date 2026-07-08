/**
 * 视图模型 / 映射：标注接口对外字段
 * 用途：把 Prisma ModelAnnotation / ModelAnnotationMedia 实体裁剪为对外视图，BigInt → number。
 */
import {
  AnnotationMediaType,
  AnnotationStatus,
  ModelAnnotation,
  ModelAnnotationMedia,
} from '@prisma/client';
import {
  AnnotationCameraSnapshot,
} from '../models/launch-view.contract';

export interface ModelAnnotationMediaVm {
  id: number;
  annotationId: number;
  mediaType: AnnotationMediaType;
  url: string;
  objectKey: string;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  sortOrder: number;
  createdAt: Date;
}

export interface ModelAnnotationVm {
  id: number;
  modelId: number;
  ownerId: number;
  title: string;
  description: string;
  anchorPosition: number[];
  anchorNormal: number[] | null;
  cameraSnapshot: AnnotationCameraSnapshot;
  displayOffset: Record<string, unknown> | null;
  status: AnnotationStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  media: ModelAnnotationMediaVm[];
}

type AnnotationWithMedia = ModelAnnotation & { media: ModelAnnotationMedia[] };

export function toAnnotationMediaVm(
  m: ModelAnnotationMedia,
): ModelAnnotationMediaVm {
  return {
    id: Number(m.id),
    annotationId: Number(m.annotationId),
    mediaType: m.mediaType,
    url: m.url,
    objectKey: m.objectKey,
    fileName: m.fileName ?? null,
    mimeType: m.mimeType ?? null,
    size: m.size != null ? Number(m.size) : null,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt,
  };
}

export function toAnnotationVm(a: AnnotationWithMedia): ModelAnnotationVm {
  return {
    id: Number(a.id),
    modelId: Number(a.modelId),
    ownerId: Number(a.ownerId),
    title: a.title,
    description: a.description,
    anchorPosition: Array.isArray(a.anchorPosition)
      ? (a.anchorPosition as number[])
      : [],
    anchorNormal: Array.isArray(a.anchorNormal)
      ? (a.anchorNormal as number[])
      : null,
    cameraSnapshot: a.cameraSnapshot as unknown as AnnotationCameraSnapshot,
    displayOffset: (a.displayOffset as Record<string, unknown> | null) ?? null,
    status: a.status,
    sortOrder: a.sortOrder,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    media: a.media
      .slice()
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map(toAnnotationMediaVm),
  };
}
