"use client";

/**
 * 组件名称：ModelScreenshotDialog
 * 组件用途：拍照保存对话框，供用户输入文件名并确认保存当前视角截图。
 * 主要功能：
 *   1. 显示默认文件名（shujing-model-{modelId}-{yyyyMMdd-HHmmss}.png），可自定义。
 *   2. 取消 / 保存图片 两个操作；保存中禁用按钮并显示 loading。
 *   3. Esc 关闭、点击遮罩关闭、点击取消关闭。
 *   4. 仅收集文件名，实际截图与保存由外层（viewer page）调用 viewerHandle.captureScreenshot 完成。
 * 对应文档：模型浏览器工具面板「拍照」功能 V1。
 * 红线：不上传 OSS、不写数据库；仅本地保存。
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Camera } from "lucide-react";

interface ModelScreenshotDialogProps {
  open: boolean;
  defaultFileName: string;
  /** 保存中态：禁用按钮并显示 loading */
  pending?: boolean;
  onCancel: () => void;
  /** 用户确认保存：回传文件名（外层负责截图 + 保存到本地） */
  onConfirm: (fileName: string) => void;
}

export function ModelScreenshotDialog({
  open,
  defaultFileName,
  pending = false,
  onCancel,
  onConfirm,
}: ModelScreenshotDialogProps) {
  const [fileName, setFileName] = useState(defaultFileName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 打开时重置为默认文件名并自动聚焦选中（便于直接覆盖输入）
  useEffect(() => {
    if (open) {
      setFileName(defaultFileName);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [open, defaultFileName]);

  // Esc 关闭（保存中时不响应，避免中断）
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, pending, onCancel]);

  if (!open) return null;

  const handleConfirm = () => {
    if (pending) return;
    onConfirm(fileName);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        className="w-[380px] max-w-[calc(100vw-32px)] rounded-2xl border border-white/12 bg-[rgba(10,12,16,0.95)] p-4 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-cyan-300" />
          <h3 className="text-[14px] font-medium">保存当前视角图片</h3>
        </div>

        <div className="space-y-2">
          <label className="block text-[12px] text-gray-400">图片文件名</label>
          <input
            ref={inputRef}
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            maxLength={120}
            spellCheck={false}
            className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/40"
          />
          <p className="text-[11px] text-gray-500">
            默认 PNG 格式；保存时将自动补 .png 后缀并清理非法字符。
          </p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-cyan-500/90 px-3 py-2 text-[13px] font-medium text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            保存图片
          </button>
        </div>
      </div>
    </div>
  );
}
