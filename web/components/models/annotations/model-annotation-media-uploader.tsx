"use client";

/**
 * 组件名称：ModelAnnotationMediaUploader
 * 组件用途：模型所有者为某个标注上传/删除图片媒体。
 * 主要功能：
 *   1. 选择图片 → 走 /uploads/presign+callback（kind=cover）直传 OSS → 拿到 fileId。
 *   2. 调用 POST /annotations/:annotationId/media 绑定媒体（mediaType=image）。
 *   3. 列出已绑定媒体，支持删除。
 * 对应文档：模型空间热点标注 V1。
 * 红线：媒体只走 OSS，不落本地；V1 仅图片。
 */

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadFileToOss, UploadAbortedError } from "@/lib/api/uploads";
import {
  createAnnotationMedia,
  deleteAnnotationMedia,
} from "@/lib/api/annotations";
import { ApiError } from "@/lib/http";
import type { ModelAnnotation, ModelAnnotationMedia } from "@/lib/types";

interface ModelAnnotationMediaUploaderProps {
  modelId: number;
  annotationId: number;
  media: ModelAnnotationMedia[];
  /** 媒体变更后回传最新标注（后端返回整条标注） */
  onUpdated: (annotation: ModelAnnotation) => void;
  /** 删除中/上传中态变化，便于外层禁用提交 */
  onBusyChange?: (busy: boolean) => void;
}

export function ModelAnnotationMediaUploader({
  modelId,
  annotationId,
  media,
  onUpdated,
  onBusyChange,
}: ModelAnnotationMediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const images = media.filter((m) => m.mediaType === "image");

  const handlePick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // 重置 input value 允许重复选择同一文件
    event.target.value = "";
    if (!file) return;

    // V1 仅支持图片，前端兜底校验扩展名/MIME
    const lowerName = file.name.toLowerCase();
    const isImage =
      /\.(jpe?g|png|webp)$/.test(lowerName) ||
      file.type.startsWith("image/");
    if (!isImage) {
      toast.error("V1 仅支持 jpg / png / webp 图片");
      return;
    }

    setUploading(true);
    setProgress(0);
    onBusyChange?.(true);
    try {
      // 1) 直传 OSS（复用 cover 链路），拿到 fileId
      const uploaded = await uploadFileToOss("cover", file, {
        onProgress: (p) => setProgress(p.percent),
      });
      // 2) 绑定到标注
      const refreshed = await createAnnotationMedia(modelId, annotationId, {
        fileId: uploaded.fileId,
        mediaType: "image",
        fileName: file.name,
        mimeType: file.type || undefined,
        size: file.size,
      });
      onUpdated(refreshed);
      toast.success("图片已添加");
    } catch (error) {
      if (error instanceof UploadAbortedError) {
        toast.info("已取消上传");
      } else if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("图片上传失败，请稍后重试");
      }
    } finally {
      setUploading(false);
      setProgress(0);
      onBusyChange?.(false);
    }
  };

  const handleDelete = async (mediaId: number) => {
    if (deletingId !== null) return;
    setDeletingId(mediaId);
    onBusyChange?.(true);
    try {
      const refreshed = await deleteAnnotationMedia(
        modelId,
        annotationId,
        mediaId,
      );
      onUpdated(refreshed);
      toast.success("已删除图片");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("删除失败，请稍后重试");
      }
    } finally {
      setDeletingId(null);
      onBusyChange?.(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-400">图片媒体</span>
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[12px] text-white transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          {uploading ? `上传中 ${progress}%` : "添加图片"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-white/10 bg-black/30 px-3 py-3 text-[12px] text-gray-500">
          暂无图片，点击「添加图片」上传（V1 仅支持图片）。
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-white/10 bg-black/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.fileName ?? "标注图片"}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="删除图片"
                title="删除图片"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white/90 opacity-0 transition-opacity hover:bg-red-500/80 disabled:opacity-50 group-hover:opacity-100"
              >
                {deletingId === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 关闭按钮（X 图标）供卡片/编辑器复用 */
export function AnnotationCloseButton({
  onClick,
  label = "关闭",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
