"use client";

/**
 * 组件名称：UploadModal
 * 组件用途：模型发布弹窗，供登录用户上传/外链发布三维模型
 * 主要功能：采集发布表单并创建后台上传任务；或仅 viewerUrl iframe 发布
 * 对应文档：页面功能注释文档/07_模型发布弹窗_UploadModal.md
 */
import { useEffect, useRef, useState } from "react";
import { X, Upload, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  MODEL_TYPES,
  SCENE_OPTIONS,
  VISIBILITY_OPTIONS,
  VISIBILITY_MAP,
} from "@/lib/model-library-constants";
import { useUploadTaskManager } from "@/components/providers/upload-task-provider";

interface UploadModalProps {
  onClose: () => void;
  /** 发布成功后刷新模型列表（父组件 loadModels） */
  onPublished: () => void;
}

export function UploadModal({ onClose, onPublished }: UploadModalProps) {
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const { createTask, startTask } = useUploadTaskManager();

  // selectedScenes：应用场景多选，对应 models.scenes
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  // visibility：发布权限中文单选，提交时映射为 ModelVisibility
  const [visibility, setVisibility] = useState("公开发布");
  // title：模型名称（必填，对应 models.title）
  const [title, setTitle] = useState("");
  // modelType：模型分类（必填，对应 models.type）
  const [modelType, setModelType] = useState<string>(MODEL_TYPES[1]);
  // description：模型简介（可选）
  const [description, setDescription] = useState("");
  // viewerUrl：在线查看链接（https，与模型文件二选一）
  const [viewerUrl, setViewerUrl] = useState("");
  // modelFile / coverFile：待上传的模型文件与封面（可选）
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // submitting：创建后台任务中，避免重复点击
  const [submitting, setSubmitting] = useState(false);
  const closeLocked = submitting;

  const toggleScene = (s: string) =>
    setSelectedScenes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const handleModalClose = () => {
    if (closeLocked) return;
    onClose();
  };

  const handleOverlayClick = () => {
    if (closeLocked) return;
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !closeLocked) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [closeLocked]);

  // handleSubmit：校验并创建后台上传任务，任务由全局 UploadTaskManager 执行。
  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      toast.error("请填写模型名称");
      return;
    }
    if (!modelType) {
      toast.error("请选择模型分类");
      return;
    }

    const url = viewerUrl.trim();
    const hasUrl = url.length > 0;
    const hasModelFile = !!modelFile;

    if (!hasModelFile && !hasUrl) {
      toast.error("请上传模型文件或填写在线查看链接");
      return;
    }
    if (hasUrl && !/^https:\/\/.+/i.test(url)) {
      toast.error("在线查看链接须为 https 地址");
      return;
    }

    setSubmitting(true);
    try {
      const task = await createTask(
        {
          title: title.trim(),
          modelType,
          scenes: selectedScenes,
          description: description.trim() || undefined,
          visibility: VISIBILITY_MAP[visibility] ?? "public",
          viewerUrl: hasUrl ? url : undefined,
          modelFile,
          coverFile,
        },
        {
          onSuccess: () => {
            onPublished();
          },
        },
      );
      startTask(task.id);
      toast.success("已开始后台上传");
      onClose();
    } catch {
      toast.error("创建上传任务失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#111] border-b border-white/10 flex items-center justify-between px-5 py-4 z-10">
          <div>
            <h2 className="text-[17px] font-semibold">发布你的三维空间模型</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              上传模型文件，填写模型信息，发布到数境空间模型社区。
            </p>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            disabled={closeLocked}
            title={closeLocked ? "上传中不可关闭弹窗" : "关闭"}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 模型文件：点击触发隐藏 input；选中后展示文件名；直传 R2（presign/callback） */}
          <input
            ref={modelFileInputRef}
            type="file"
            className="hidden"
            accept=".glb,.gltf,.ifc,.las,.laz,.ply,.zip,.json"
            disabled={submitting}
            onChange={(e) => {
              const nextFile = e.target.files?.[0] ?? null;
              setModelFile(nextFile);
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (submitting) return;
              modelFileInputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) modelFileInputRef.current?.click();
            }}
            aria-disabled={submitting}
            className={`border-2 border-dashed border-white/10 rounded-xl p-8 text-center transition-all ${
              submitting ? "cursor-not-allowed opacity-60" : "hover:border-white/20 cursor-pointer"
            }`}
          >
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-[14px] text-gray-300">
              {modelFile ? modelFile.name : "拖拽模型文件到这里，或点击上传"}
            </p>
            <p className="text-[12px] text-gray-500 mt-1">
              支持 glb / gltf / ifc / 点云等；也可在下方仅填写在线查看链接
            </p>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">模型名称</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
              placeholder="请输入模型名称"
            />
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">模型分类</label>
            <div className="relative">
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                disabled={submitting}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-gray-300 focus:outline-none appearance-none focus:border-white/20 transition-all"
              >
                {MODEL_TYPES.slice(1).map((t) => (
                  <option key={t} value={t} className="bg-[#111]">
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">
              应用场景（可多选）
            </label>
            <div className="flex flex-wrap gap-2">
              {SCENE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleScene(s)}
                  disabled={submitting}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${
                    selectedScenes.includes(s)
                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">模型简介</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none resize-none focus:border-white/20 transition-all"
              placeholder="请简单介绍模型内容、适用场景或空间特点"
            />
          </div>

          {/* 在线查看链接：不选文件时填 https 链接即可发布（viewerType=iframe） */}
          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">
              在线查看链接（选填）
            </label>
            <input
              value={viewerUrl}
              onChange={(e) => setViewerUrl(e.target.value)}
              disabled={submitting}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
              placeholder="https:// 外部三维查看器地址，与模型文件二选一"
            />
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">封面图片</label>
            <input
              ref={coverFileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp"
              disabled={submitting}
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setCoverFile(nextFile);
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (submitting) return;
                coverFileInputRef.current?.click();
              }}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[13px] text-gray-300 hover:bg-white/8 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {coverFile ? coverFile.name : "上传封面"}
            </button>
          </div>

          <div>
            <label className="text-[13px] text-gray-400 block mb-1.5">发布权限</label>
            <div className="flex flex-wrap gap-2">
              {VISIBILITY_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  disabled={submitting}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${
                    visibility === v
                      ? "bg-white/10 border-white/25 text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[14px] text-gray-300 hover:bg-white/8 transition-all disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "正在创建任务…" : "发布模型"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
