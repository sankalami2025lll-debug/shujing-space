"use client";

import type { ModelDetail } from "@/lib/types";

interface ModelInfoPanelProps {
  model: ModelDetail;
}

function formatDateTime(value?: string | null) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function processingStatusLabel(status: ModelDetail["processingStatus"]) {
  switch (status) {
    case "uploaded":
      return "已上传";
    case "processing":
      return "解析中";
    case "failed":
      return "解析失败";
    case "ready":
      return "可浏览";
    default:
      return "未知";
  }
}

function renderValue(value?: string | null) {
  if (!value || !value.trim()) return "暂无";
  return value;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] py-3 text-[13px] last:border-b-0">
      <span className="text-gray-500">{label}</span>
      <span className="max-w-[68%] text-right text-gray-200">{value}</span>
    </div>
  );
}

export function ModelInfoPanel({ model }: ModelInfoPanelProps) {
  const isDev = process.env.NODE_ENV !== "production";
  const sceneText = model.scenes?.length ? model.scenes.join("、") : model.tags?.join("、") || "暂无";

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="rounded-[24px] border border-white/10 bg-[#0e1117]/88 p-5 shadow-[0_16px_60px_rgba(2,6,23,0.3)]">
        <h3 className="text-[18px] font-semibold text-white">模型信息</h3>
        <p className="mt-2 text-[12px] leading-6 text-gray-400">
          当前阶段由统一外壳承接基础元信息展示，避免把技术字段堆进具体 Viewer。
        </p>

        <div className="mt-5">
          <InfoRow label="模型名称" value={model.title} />
          <InfoRow label="模型格式" value={renderValue(model.fileFormat)?.toUpperCase()} />
          <InfoRow label="Viewer 类型" value={renderValue(model.viewerType)} />
          <InfoRow label="处理状态" value={processingStatusLabel(model.processingStatus)} />
          <InfoRow label="上传时间" value={formatDateTime(model.createdAt)} />
          <InfoRow label="发布时间" value={formatDateTime(model.processedAt ?? model.createdAt)} />
          <InfoRow label="模型分类" value={model.category?.name ?? "暂无"} />
          <InfoRow label="适用场景" value={sceneText} />
          <InfoRow label="模型描述" value={renderValue(model.description)} />
        </div>

        {isDev && (
          <details className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <summary className="cursor-pointer text-[12px] text-gray-300">开发调试信息</summary>
            <div className="mt-3 space-y-2 text-[12px] text-gray-400">
              <p>viewerUrl：{renderValue(model.viewerUrl)}</p>
              <p>allowIframe：{String(model.allowIframe)}</p>
              <p>processingError：{renderValue(model.processingError)}</p>
              <p>status：{renderValue(model.status ?? null)}</p>
              <p>visibility：{renderValue(model.visibility ?? null)}</p>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
