"use client";

import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { X, Loader2, ImageUp, Check } from "lucide-react";
import { toast } from "sonner";
import { updateModel, type ModelEditPayload } from "@/lib/api/models";
import { presignUpload } from "@/lib/api/uploads";
import { putFileToPresignedUrl } from "@/lib/api/uploads";
import type { ModelDetail } from "@/lib/types";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;
const COVER_MAX_BYTES = 5 * 1024 * 1024;

interface EditModelModalProps {
  open: boolean;
  model: ModelDetail;
  onClose: () => void;
  onSaved: (updated: ModelDetail) => void;
}

export default function EditModelModal({
  open,
  model,
  onClose,
  onSaved,
}: EditModelModalProps) {
  const [title, setTitle] = useState(model.title);
  const [description, setDescription] = useState(model.description ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const hasCoverChanged = coverFile !== null;

  const handleCoverSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("只支持图片格式");
      return;
    }

    if (file.size > COVER_MAX_BYTES) {
      toast.error("封面图片大小不能超过 5MB");
      return;
    }

    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("模型名称不能为空");
      return;
    }

    if (trimmedTitle.length > TITLE_MAX) {
      toast.error(`模型名称不能超过 ${TITLE_MAX} 个字符`);
      return;
    }

    setSaving(true);

    try {
      let coverUrl = model.coverUrl || "";

      if (hasCoverChanged && coverFile) {
        setCoverUploading(true);
        const presign = await presignUpload({
          kind: "cover",
          fileName: coverFile.name,
          mime: coverFile.type || "image/png",
          size: coverFile.size,
        });
        await putFileToPresignedUrl(
          presign.uploadUrl,
          coverFile,
          presign.requiredHeaders,
        );
        coverUrl = presign.publicUrl;
        setCoverUploading(false);
      }

      const payload: ModelEditPayload = {};
      if (trimmedTitle !== model.title) payload.title = trimmedTitle;
      if (description !== (model.description ?? "")) payload.description = description;
      if (hasCoverChanged) payload.coverUrl = coverUrl;

      if (Object.keys(payload).length === 0) {
        toast.info("没有需要保存的修改");
        setSaving(false);
        return;
      }

      const updated = await updateModel(model.id, payload);
      onSaved(updated);
      onClose();
      toast.success("模型信息已保存");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "保存失败，请稍后重试";
      toast.error(msg);
    } finally {
      setSaving(false);
      setCoverUploading(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    onClose();
  };

  const currentCoverDisplay = coverPreviewUrl || model.coverUrl || null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/78 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[480px] overflow-hidden rounded-[24px] border border-white/10 bg-[#101010]/95 shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <h3 className="text-[20px] font-semibold leading-tight">编辑模型信息</h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            aria-label="关闭编辑弹窗"
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 pb-6">
          <div>
            <label className="block text-[13px] text-gray-400 mb-1.5">
              模型名称 <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TITLE_MAX}
              placeholder="输入模型名称"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] text-white/92 placeholder:text-gray-500 outline-none transition-all focus:border-cyan-400/40 focus:bg-white/8"
            />
            <p className="mt-1 text-right text-[11px] text-gray-500">
              {title.length}/{TITLE_MAX}
            </p>
          </div>

          <div>
            <label className="block text-[13px] text-gray-400 mb-1.5">
              模型简介
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              placeholder="输入模型简介"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] text-white/92 placeholder:text-gray-500 outline-none transition-all focus:border-cyan-400/40 focus:bg-white/8"
            />
            <p className="mt-1 text-right text-[11px] text-gray-500">
              {description.length}/{DESCRIPTION_MAX}
            </p>
          </div>

          <div>
            <label className="block text-[13px] text-gray-400 mb-1.5">
              封面图片
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-full overflow-hidden rounded-xl border border-dashed border-white/12 bg-white/[0.02] transition-all hover:border-white/20"
              style={{ aspectRatio: "16 / 9" }}
            >
              {currentCoverDisplay ? (
                <img
                  src={currentCoverDisplay}
                  alt="封面预览"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-500">
                  <ImageUp className="h-8 w-8" />
                  <span className="text-[13px]">点击选择封面图片</span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-[13px] text-white">更换封面</span>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverSelect}
            />
            {hasCoverChanged && (
              <p className="mt-1 text-[11px] text-cyan-400/80 flex items-center gap-1">
                <Check className="h-3 w-3" />
                已选择新封面
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 rounded-full border border-white/14 bg-white/5 px-5 py-3 text-[14px] text-gray-200 transition-all hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-cyan-400/16 bg-cyan-500/12 px-5 py-3 text-[14px] text-cyan-200 transition-all hover:bg-cyan-500/18 hover:border-cyan-400/24 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving
                ? coverUploading
                  ? "上传封面中…"
                  : "保存中…"
                : "保存修改"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
