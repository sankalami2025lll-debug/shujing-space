"use client";

import { ModelErrorState } from "@/components/models/model-error-state";

interface ViewerPlaceholderProps {
  formatLabel: string;
  title?: string;
  description?: string;
}

export function ViewerPlaceholder({
  formatLabel,
  title,
  description,
}: ViewerPlaceholderProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.14),transparent_32%),linear-gradient(135deg,#07111a_0%,#071826_45%,#04070c_100%)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/10 to-transparent" />
      <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-cyan-400/35" />
      <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-cyan-400/35" />
      <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b border-l border-cyan-400/35" />
      <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b border-r border-cyan-400/35" />
      <ModelErrorState
        tone="warning"
        currentFormat={formatLabel}
        title={title ?? `${formatLabel.toUpperCase()} 在线预览引擎接入中`}
        description={
          description ?? `当前格式为 ${formatLabel.toUpperCase()}，该格式在线预览引擎正在接入中。`
        }
      />
    </div>
  );
}
