"use client";

/**
 * 组件名称：MobileLccHelpOverlay
 * 组件用途：分享 iframe mobile=1 场景下的触屏操作帮助面板
 * 主要功能：第一人称 / 枢轴双 tab 触屏说明；tab 仅改帮助文案，不改真实 controlMode
 * 对应路由：/viewer/lcc/[id]?mobile=1
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ModelViewerControlMode } from "@/components/models/viewers/types";

type HelpTab = "walk" | "orbit";

/** 手机端第一人称触屏操作说明项 */
const MOBILE_WALK_HELP_ITEMS = [
  { label: "左侧按住并滑动", description: "前后左右移动" },
  { label: "右侧滑动", description: "转动视角" },
  { label: "双指捏合", description: "拉近 / 拉远" },
  { label: "双指拖动", description: "平移视角" },
  { label: "升 / 降", description: "垂直移动" },
  { label: "重置", description: "回到初始视角" },
] as const;

/** 手机端枢轴触屏操作说明项 */
const MOBILE_ORBIT_HELP_ITEMS = [
  { label: "单指拖动", description: "围绕模型旋转" },
  { label: "双指捏合", description: "缩放模型" },
  { label: "双指拖动", description: "平移视图" },
  { label: "重置", description: "回到初始视角" },
] as const;

const MODE_TABS: Array<{ mode: HelpTab; label: string }> = [
  { mode: "walk", label: "第一人称" },
  { mode: "orbit", label: "枢轴" },
];

export interface MobileLccHelpOverlayProps {
  /** 是否显示帮助浮层 */
  open: boolean;
  /** 关闭帮助（遮罩、关闭按钮、Esc） */
  onClose: () => void;
  /** 当前 viewer 控制模式，用于打开时默认 tab */
  controlMode: ModelViewerControlMode;
}

export function MobileLccHelpOverlay({ open, onClose, controlMode }: MobileLccHelpOverlayProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>(controlMode === "walk" ? "walk" : "orbit");

  useEffect(() => {
    if (open) {
      setActiveTab(controlMode === "walk" ? "walk" : "orbit");
    }
  }, [open, controlMode]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const noSelectStyle: React.CSSProperties = {
    touchAction: "manipulation",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  const helpItems = activeTab === "walk" ? MOBILE_WALK_HELP_ITEMS : MOBILE_ORBIT_HELP_ITEMS;
  const footerHint =
    activeTab === "walk"
      ? "建议双手横屏操作，左手移动，右手调整视角。"
      : "枢轴模式适合围绕模型整体查看。";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-lcc-help-title"
      style={noSelectStyle}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[calc(100dvh-48px)] w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141414]/95 shadow-[0_12px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={noSelectStyle}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          aria-label="关闭帮助"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-gray-300 transition-colors hover:border-cyan-400/30 hover:text-white"
          style={noSelectStyle}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="overflow-y-auto px-6 pb-6 pt-8">
          <header className="mb-4 pr-8">
            <h2
              id="mobile-lcc-help-title"
              className="text-[18px] font-semibold tracking-wide text-white"
            >
              操作帮助
            </h2>
            <p className="mt-1.5 text-[13px] text-gray-400">手机横屏浏览手势说明</p>
          </header>

          {/* tab 仅切换帮助文案，不修改 viewer controlMode */}
          <div className="mb-4 flex gap-2">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.mode}
                type="button"
                className={`rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  activeTab === tab.mode
                    ? "border-cyan-400/45 bg-cyan-950/55 text-cyan-50"
                    : "border-white/10 bg-black/30 text-gray-300 hover:border-white/20"
                }`}
                style={noSelectStyle}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setActiveTab(tab.mode);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <ul className="space-y-3">
            {helpItems.map((item) => (
              <li
                key={item.label}
                className="flex items-start justify-between gap-4 rounded-lg border border-white/8 bg-black/25 px-4 py-3"
              >
                <span className="shrink-0 text-[14px] font-medium text-cyan-100/90">
                  {item.label}
                </span>
                <span className="text-right text-[13px] leading-relaxed text-gray-300">
                  {item.description}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-5 border-t border-white/8 pt-4 text-[12px] leading-relaxed text-gray-500">
            {footerHint}
          </p>
        </div>
      </div>
    </div>
  );
}
