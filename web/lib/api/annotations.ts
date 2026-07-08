/**
 * 模块：标注接口封装 api/annotations.ts
 * 用途：封装模型空间热点标注的 CRUD + 媒体绑定接口；统一基于 http.ts。
 * 对应后端：AnnotationsModule
 *   - GET    /api/models/:modelId/annotations
 *   - POST   /api/models/:modelId/annotations
 *   - PATCH  /api/models/:modelId/annotations/:annotationId
 *   - DELETE /api/models/:modelId/annotations/:annotationId
 *   - POST   /api/models/:modelId/annotations/:annotationId/media
 *   - DELETE /api/models/:modelId/annotations/:annotationId/media/:mediaId
 */
import { http } from "../http";
import type {
  CreateAnnotationMediaPayload,
  CreateModelAnnotationPayload,
  ModelAnnotation,
  UpdateModelAnnotationPayload,
} from "../types";

// listModelAnnotations：列出模型空间标注（作者全量；其余仅 active）
export function listModelAnnotations(modelId: number): Promise<ModelAnnotation[]> {
  return http.get<ModelAnnotation[]>(`/models/${modelId}/annotations`);
}

// createModelAnnotation：新增标注（仅模型归属用户）
export function createModelAnnotation(
  modelId: number,
  payload: CreateModelAnnotationPayload,
): Promise<ModelAnnotation> {
  return http.post<ModelAnnotation>(`/models/${modelId}/annotations`, payload);
}

// updateModelAnnotation：更新标注（仅模型归属用户）
export function updateModelAnnotation(
  modelId: number,
  annotationId: number,
  payload: UpdateModelAnnotationPayload,
): Promise<ModelAnnotation> {
  return http.patch<ModelAnnotation>(
    `/models/${modelId}/annotations/${annotationId}`,
    payload,
  );
}

// deleteModelAnnotation：删除标注（仅模型归属用户）
export function deleteModelAnnotation(
  modelId: number,
  annotationId: number,
): Promise<{ id: number; deleted: true }> {
  return http.delete<{ id: number; deleted: true }>(
    `/models/${modelId}/annotations/${annotationId}`,
  );
}

// createAnnotationMedia：为标注新增媒体（仅模型归属用户；V1 仅图片）
export function createAnnotationMedia(
  modelId: number,
  annotationId: number,
  payload: CreateAnnotationMediaPayload,
): Promise<ModelAnnotation> {
  return http.post<ModelAnnotation>(
    `/models/${modelId}/annotations/${annotationId}/media`,
    payload,
  );
}

// deleteAnnotationMedia：删除标注媒体（仅模型归属用户）
export function deleteAnnotationMedia(
  modelId: number,
  annotationId: number,
  mediaId: number,
): Promise<ModelAnnotation> {
  return http.delete<ModelAnnotation>(
    `/models/${modelId}/annotations/${annotationId}/media/${mediaId}`,
  );
}
