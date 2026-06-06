"use client";

export type ModelViewerTabKey = "viewer" | "info" | "structure" | "activity";

interface ModelViewerTabsProps {
  activeTab: ModelViewerTabKey;
  onTabChange: (tab: ModelViewerTabKey) => void;
}

const TAB_OPTIONS: Array<{ key: ModelViewerTabKey; label: string }> = [
  { key: "viewer", label: "模型浏览" },
  { key: "info", label: "模型信息" },
  { key: "structure", label: "文件结构" },
  { key: "activity", label: "操作记录" },
];

export function ModelViewerTabs({ activeTab, onTabChange }: ModelViewerTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TAB_OPTIONS.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-all ${
              active
                ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100"
                : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
