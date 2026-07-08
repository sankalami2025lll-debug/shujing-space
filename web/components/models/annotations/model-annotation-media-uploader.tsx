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
 * 媒体计数规则：images 列表只来源于后端 annotation.media（已持久化），
 *   不使用本地 File 预览，上传未成功前不计入 1/3，避免「假成功」。
 */

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  presignUpload,
  putFileToPresignedUrl,
  uploadCallback,
  UploadAbortedError,
} from "@/lib/api/uploads";
import {
  createAnnotationMedia,
  deleteAnnotationMedia,
} from "@/lib/api/annotations";
import { ApiError } from "@/lib/http";
import type { FileKind, ModelAnnotation, ModelAnnotationMedia } from "@/lib/types";

// V1.1.1 标注图片：每个标注最多 3 张；允许的扩展名 / MIME；单张大小上限 10MB（与后端 cover MAX_COVER_SIZE_MB 对齐）
const MAX_ANNOTATION_IMAGES = 3;
const ANNOTATION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ANNOTATION_IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;
const ANNOTATION_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// 上传阶段状态：用于按钮文案与状态清理，避免卡在「上传中 100%」
//  - presigning：申请预签名地址（准备上传）
//  - uploading：直传 OSS（上传中 xx%）
//  - registering：上传完成，登记 model_files + 绑定到标注（保存图片信息）
//  - idle：空闲
type UploadStage = "idle" | "presigning" | "uploading" | "registering";

// 各阶段 fetch 超时（毫秒）：避免后端或代理挂起导致 UI 卡死
//  - PUT_TIMEOUT_MS：与 uploads.ts 中 xhr.timeout 保持一致，仅用于诊断输出
//  - XHR PUT 实际超时见 uploads.ts（300s）
const PUT_TIMEOUT_MS = 300_000;
const PRESIGN_TIMEOUT_MS = 30_000;
const CALLBACK_TIMEOUT_MS = 60_000;
const CREATE_MEDIA_TIMEOUT_MS = 30_000;

// withTimeout：给 fetch 类调用加超时保护；超时后抛 ApiError，UI 可恢复。
// 注意：此方式不会真正中止底层 fetch，但能保证前端状态不永久挂起。
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new ApiError(`${label}超时，请检查网络后重试`, -1, 0)),
        ms,
      );
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

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
  // 上传阶段：区分 presigning / uploading / registering，便于按钮文案与失败定位
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");

  const images = media.filter((m) => m.mediaType === "image");
  const reachedLimit = images.length >= MAX_ANNOTATION_IMAGES;

  const handlePick = () => {
    if (uploading || reachedLimit) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // 重置 input value 允许重复选择同一文件
    event.target.value = "";
    if (!file) return;

    // V1.1 仅支持 jpg / png / webp：扩展名与 MIME 双重校验，拒绝 gif/pdf 等
    const lowerName = file.name.toLowerCase();
    const extOk = ANNOTATION_IMAGE_EXT_RE.test(lowerName);
    const mimeOk =
      file.type !== "" && ANNOTATION_IMAGE_MIMES.has(file.type.toLowerCase());
    if (!extOk || !mimeOk) {
      toast.error("V1 仅支持 jpg / png / webp 图片");
      return;
    }

    // 10MB 大小校验（与后端 cover 上限对齐）
    if (file.size > ANNOTATION_IMAGE_MAX_BYTES) {
      toast.error("图片超过 10MB 上限");
      return;
    }

    // 二次保护：到达 3 张上限时拒绝（避免并发选择）
    if (images.length >= MAX_ANNOTATION_IMAGES) {
      toast.error(`每个标注最多 ${MAX_ANNOTATION_IMAGES} 张图片`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadStage("presigning");
    onBusyChange?.(true);
    // 同步记录当前阶段，用于 catch 中给出阶段化错误文案（避免闭包读到异步 state）
    let stage: UploadStage = "presigning";
    const coverKind: FileKind = "cover";
    const mime = file.type || "application/octet-stream";
    try {
      // 1) presign：申请预签名 PUT 地址（含服务端扩展名/大小校验）
      stage = "presigning";
      const presigned = await withTimeout(
        presignUpload({
          kind: coverKind,
          fileName: file.name,
          mime,
          size: file.size,
        }),
        PRESIGN_TIMEOUT_MS,
        "准备上传",
      );

      // 2) PUT 直传 OSS：onProgress 回调更新百分比；XHR 含 120s 超时（见 uploads.ts）
      //    注意：upload.onprogress=100% 只代表字节已发送，必须等 xhr.onload 才算成功
      stage = "uploading";
      setUploadStage("uploading");
      await putFileToPresignedUrl(
        presigned.uploadUrl,
        file,
        presigned.requiredHeaders,
        {
          onProgress: (p) => setProgress(p.percent),
        },
      );

      // 3) callback：登记 model_files（后端会 HeadObject 确认对象存在），拿到 fileId
      //    此阶段切换为 registering，UI 显示「保存图片信息」，避免误显示「上传中 100%」
      stage = "registering";
      setUploadStage("registering");
      const uploaded = await withTimeout(
        uploadCallback({
          kind: coverKind,
          r2Key: presigned.r2Key,
          originalName: file.name,
          mime,
          size: file.size,
        }),
        CALLBACK_TIMEOUT_MS,
        "保存图片信息",
      );

      // 4) 绑定到标注：仅当此步成功后才 onUpdated，media 计数才 +1
      //    任何前置失败都不会调用 onUpdated，因此 media 列表只含后端已持久化的图片
      const refreshed = await withTimeout(
        createAnnotationMedia(modelId, annotationId, {
          fileId: uploaded.fileId,
          mediaType: "image",
          fileName: file.name,
          mimeType: file.type || undefined,
          size: file.size,
          sortOrder: images.length,
        }),
        CREATE_MEDIA_TIMEOUT_MS,
        "保存图片信息",
      );
      onUpdated(refreshed);
      toast.success("图片已添加");
    } catch (error) {
      // 阶段化错误文案：明确告诉用户失败在哪一步，便于定位 OSS PUT / callback / media create
      const stageLabel =
        stage === "presigning"
          ? "准备上传失败"
          : stage === "uploading"
            ? "上传到对象存储失败"
            : "图片已上传，但保存信息失败";
      if (error instanceof UploadAbortedError) {
        toast.info("已取消上传");
      } else if (error instanceof ApiError) {
        toast.error(`${stageLabel}：${error.message}`);
        // 控制台输出诊断信息：阶段 + code + status + fileSize + isCorsLikely + timeoutMs
        // 便于排查 CORS（status=0）/ 403 SignatureDoesNotMatch / 超时 / 后端 500
        const isCorsLikely =
          stage === "uploading" && error.status === 0 && error.code === -1;
        console.error("[annotation-media] upload failed", {
          stage,
          code: error.code,
          status: error.status,
          message: error.message,
          fileSize: file.size,
          contentType: mime,
          isCorsLikely,
          putTimeoutMs: PUT_TIMEOUT_MS,
        });
      } else {
        toast.error(`${stageLabel}，请稍后重试`);
        console.error("[annotation-media] upload failed (unknown)", stage, error);
      }
    } finally {
      // 无论成功/失败/取消/超时，必须清理上传状态，避免按钮卡在「上传中 100%」
      setUploading(false);
      setProgress(0);
      setUploadStage("idle");
      onBusyChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        <span className="text-[12px] text-gray-400">
          图片媒体（{images.length}/{MAX_ANNOTATION_IMAGES}）
        </span>
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading || reachedLimit}
          title={reachedLimit ? "每个标注最多 3 张图片" : undefined}
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[12px] text-white transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          {uploading
            ? uploadStage === "presigning"
              ? "准备上传"
              : uploadStage === "registering"
                ? "保存图片信息"
                : `上传中 ${progress}%`
            : reachedLimit
              ? "已满 3 张"
              : "添加图片"}
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
