"use client";

/**
 * 组件名称：ModelAnnotationEditor
 * 组件用途：模型所有者新增/编辑标注的浮层面板（标题、描述、图片媒体、保存视角、删除）。
 * 主要功能：
 *   1. 新建态：填写标题/描述 + 上传图片 → 保存（调用方负责 createModelAnnotation）。
 *   2. 编辑态：修改标题/描述/媒体 + 「重新保存当前视角」→ 更新；可删除标注。
 *   3. 媒体上传复用 ModelAnnotationMediaUploader（V1 仅图片）。
 * 对应文档：模型空间热点标注 V1。
 */

import { useEffect, useState } from "react";
import { Loader2, Save, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  createModelAnnotation,
  deleteModelAnnotation,
  updateModelAnnotation,
} from "@/lib/api/annotations";
import { ApiError } from "@/lib/http";
import type {
  ModelAnnotation,
  ModelLaunchView,
} from "@/lib/types";
import {
  ModelAnnotationMediaUploader,
  AnnotationCloseButton,
} from "./model-annotation-media-uploader";
import {
  annotationCameraSnapshotToLaunchView,
  normalizeAnnotationCameraSnapshotForApi,
} from "./model-annotation-types";

export interface AnnotationDraft {
  /** 新建态时锚点 + 视角来自刚拾取的点；编辑态为 null（沿用已存标注） */
  anchorPosition: [number, number, number];
  anchorNormal?: [number, number, number] | null;
  cameraSnapshot: ModelLaunchView;
}

interface ModelAnnotationEditorProps {
  modelId: number;
  /** 新建态：传入 draft；编辑态：传入现有 annotation（draft 为 null） */
  draft: AnnotationDraft | null;
  annotation: ModelAnnotation | null;
  /** 重新拾取锚点（退出当前编辑，进入选点模式） */
  onRequestRepick?: () => void;
  /** 重新保存当前视角：调用方读取 viewerHandle.getCurrentView() 并回填 */
  onCaptureCurrentView?: () => ModelLaunchView | null;
  /** 保存/删除成功后回传最新标注（或删除后 null） */
  onSaved: (annotation: ModelAnnotation) => void;
  onDeleted: (annotationId: number) => void;
  onClose: () => void;
}

export function ModelAnnotationEditor({
  modelId,
  draft,
  annotation,
  onRequestRepick,
  onCaptureCurrentView,
  onSaved,
  onDeleted,
  onClose,
}: ModelAnnotationEditorProps) {
  const isNew = !annotation;
  const [title, setTitle] = useState(annotation?.title ?? "");
  const [description, setDescription] = useState(annotation?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 编辑态当前视角快照（ModelLaunchView 包装结构，便于「重新保存当前视角」直接覆盖；提交前转扁平） */
  const [currentSnapshot, setCurrentSnapshot] = useState<ModelLaunchView | null>(
    () =>
      annotationCameraSnapshotToLaunchView(
        annotation?.cameraSnapshot ?? draft?.cameraSnapshot ?? null,
      ),
  );

  useEffect(() => {
    setTitle(annotation?.title ?? "");
    setDescription(annotation?.description ?? "");
    setCurrentSnapshot(
      annotationCameraSnapshotToLaunchView(
        annotation?.cameraSnapshot ?? draft?.cameraSnapshot ?? null,
      ),
    );
  }, [annotation, draft]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("请填写标题");
      return;
    }
    if (isNew) {
      if (!draft) {
        toast.error("锚点信息缺失，请重新选点");
        return;
      }
      setSubmitting(true);
      try {
        // cameraSnapshot 提交前转为后端 DTO 要求的扁平结构
        const cameraSnapshot = normalizeAnnotationCameraSnapshotForApi(
          draft.cameraSnapshot,
        );
        const created = await createModelAnnotation(modelId, {
          title: trimmedTitle,
          description: description.trim(),
          anchorPosition: draft.anchorPosition,
          anchorNormal: draft.anchorNormal ?? undefined,
          cameraSnapshot,
        });
        toast.success("标注已创建");
        onSaved(created);
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "创建标注失败，请稍后重试",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!annotation) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        description: description.trim(),
      };
      if (currentSnapshot) {
        // 更新同样转扁平
        payload.cameraSnapshot =
          normalizeAnnotationCameraSnapshotForApi(currentSnapshot);
      }
      const updated = await updateModelAnnotation(
        modelId,
        annotation.id,
        payload,
      );
      toast.success("标注已保存");
      onSaved(updated);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "保存标注失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCaptureView = () => {
    const view = onCaptureCurrentView?.() ?? null;
    if (!view) {
      toast.error("当前视角暂不可用");
      return;
    }
    setCurrentSnapshot(view);
    toast.success("已捕获当前视角，保存后生效");
  };

  const handleDelete = async () => {
    if (!annotation) return;
    if (!window.confirm("确定删除该标注？删除后不可恢复。")) return;
    setDeleting(true);
    try {
      await deleteModelAnnotation(modelId, annotation.id);
      toast.success("标注已删除");
      onDeleted(annotation.id);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "删除标注失败，请稍后重试",
      );
    } finally {
      setDeleting(false);
    }
  };

  const disabled = submitting || deleting || busy;

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-4 z-40 w-[340px] -translate-x-1/2 rounded-2xl border border-white/12 bg-[rgba(10,12,16,0.92)] p-4 text-white shadow-2xl backdrop-blur-md"
      data-annotation-editor="true"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-medium">
          {isNew ? "新增标注" : "编辑标注"}
        </h3>
        <AnnotationCloseButton onClick={onClose} label="关闭编辑" />
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12px] text-gray-400">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="例如：主入口大厅"
            className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/40"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12px] text-gray-400">
            描述（可选）
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="对该位置的说明文字"
            className="w-full resize-none rounded-md border border-white/10 bg-black/50 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/40"
          />
        </div>

        {annotation ? (
          <ModelAnnotationMediaUploader
            modelId={modelId}
            annotationId={annotation.id}
            media={annotation.media}
            onUpdated={(refreshed) => onSaved(refreshed)}
            onBusyChange={setBusy}
          />
        ) : (
          <p className="rounded-md border border-dashed border-white/10 bg-black/30 px-3 py-2 text-[12px] text-gray-500">
            保存标注后可上传图片媒体。
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-cyan-500/90 px-3 py-2 text-[13px] font-medium text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isNew ? "创建标注" : "保存"}
          </button>

          {!isNew && onRequestRepick ? (
            <button
              type="button"
              onClick={onRequestRepick}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              title="重新在模型表面选点"
            >
              重选点
            </button>
          ) : null}

          {!isNew ? (
            <button
              type="button"
              onClick={handleCaptureView}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              title="用当前视角覆盖该标注的保存视角"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              存视角
            </button>
          ) : null}

          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled}
              className="inline-flex items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[12px] text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              title="删除标注"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
