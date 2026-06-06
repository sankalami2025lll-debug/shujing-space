"use client";

import { AlertTriangle, Clock3, Info } from "lucide-react";

type ModelErrorTone = "info" | "warning" | "error";

interface ModelErrorStateProps {
  title: string;
  description: string;
  currentFormat?: string | null;
  tone?: ModelErrorTone;
}

const toneMap: Record<
  ModelErrorTone,
  {
    icon: typeof Info;
    badge: string;
    panel: string;
    iconWrap: string;
    iconColor: string;
  }
> = {
  info: {
    icon: Info,
    badge: "状态提示",
    panel: "border-cyan-400/18 bg-cyan-400/[0.06]",
    iconWrap: "bg-cyan-400/12",
    iconColor: "text-cyan-200",
  },
  warning: {
    icon: Clock3,
    badge: "接入中",
    panel: "border-amber-400/18 bg-amber-400/[0.06]",
    iconWrap: "bg-amber-400/12",
    iconColor: "text-amber-100",
  },
  error: {
    icon: AlertTriangle,
    badge: "暂不可用",
    panel: "border-rose-400/18 bg-rose-400/[0.06]",
    iconWrap: "bg-rose-400/12",
    iconColor: "text-rose-100",
  },
};

export function ModelErrorState({
  title,
  description,
  currentFormat,
  tone = "warning",
}: ModelErrorStateProps) {
  const config = toneMap[tone];
  const Icon = config.icon;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div
        className={`relative w-full max-w-[520px] overflow-hidden rounded-[28px] border px-6 py-7 text-left shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl ${config.panel}`}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${config.iconWrap}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="min-w-0">
            <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-gray-300">
              {config.badge}
            </div>
            <h3 className="mt-3 text-[18px] font-semibold text-white">{title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-gray-300/90">{description}</p>
            {currentFormat && (
              <p className="mt-4 text-[12px] text-gray-400">
                当前格式：<span className="text-gray-200">{currentFormat.toUpperCase()}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
