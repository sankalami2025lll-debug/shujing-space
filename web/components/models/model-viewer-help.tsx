"use client";

import {
  ArrowUpDown,
  Keyboard,
  Map,
  Mouse,
  Move3D,
  MousePointer2,
  RotateCcw,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ModelViewerControlMode } from "@/components/models/viewers/types";

/** 帮助面板展示的模式（仅 walk / orbit，不含数字人） */
type HelpPanelMode = "walk" | "orbit";

interface ModelViewerHelpProps {
  /** 是否显示帮助浮层 */
  open: boolean;
  /** 关闭帮助（遮罩点击、关闭按钮） */
  onClose: () => void;
  /** 当前 viewer 控制模式，用于打开面板时默认高亮对应 tab */
  controlMode: ModelViewerControlMode;
}

interface HelpActionItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
}

const WALK_ACTIONS: HelpActionItem[] = [
  {
    id: "wasd",
    label: "W / A / S / D",
    description: "移动",
    icon: <Keyboard className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    id: "qe",
    label: "Q / E",
    description: "上升 / 下降",
    icon: <ArrowUpDown className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    id: "wheel",
    label: "鼠标滚轮",
    description: "滚轮缩放",
    icon: <Mouse className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    id: "shift",
    label: "Shift",
    description: "加速移动",
    icon: <Zap className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    id: "lmb",
    label: "鼠标左键拖动",
    description: "左键旋转视角",
    icon: <MousePointer2 className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    id: "rmb",
    label: "鼠标右键拖动",
    description: "右键平移视角",
    icon: (
      <MousePointer2 className="h-6 w-6 rotate-12" strokeWidth={1.5} />
    ),
  },
];

const ORBIT_ACTIONS: HelpActionItem[] = [
  {
    id: "lmb",
    label: "鼠标左键拖动",
    description: "左键旋转视角",
    icon: <MousePointer2 className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    id: "wheel",
    label: "鼠标滚轮",
    description: "滚轮缩放",
    icon: <Mouse className="h-6 w-6" strokeWidth={1.5} />,
  },
  {
    id: "rmb",
    label: "鼠标右键拖动",
    description: "右键平移视角",
    icon: (
      <MousePointer2 className="h-6 w-6 rotate-12" strokeWidth={1.5} />
    ),
  },
  {
    id: "reset",
    label: "R",
    description: "重置视角",
    icon: <RotateCcw className="h-6 w-6" strokeWidth={1.5} />,
  },
];

const WALK_SHORTCUTS = [
  { key: "R", text: "重置视角" },
  { key: "H", text: "打开 / 关闭帮助" },
  { key: "Esc", text: "关闭帮助 / 退出全屏" },
] as const;

const ORBIT_SHORTCUTS = [
  { key: "H", text: "打开 / 关闭帮助" },
  { key: "Esc", text: "关闭帮助 / 退出全屏" },
] as const;

const MODE_TABS: Array<{ mode: HelpPanelMode; label: string; icon: typeof Map }> = [
  { mode: "walk", label: "第一人称", icon: Map },
  { mode: "orbit", label: "枢轴", icon: Move3D },
];

function HelpActionCard({ item }: { item: HelpActionItem }) {
  return (
    <div className="flex min-w-[96px] max-w-[140px] flex-1 flex-col items-center gap-2 px-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-100">
        {item.icon}
      </div>
      <div className="space-y-0.5">
        <div className="text-[11px] font-medium leading-snug text-gray-200">{item.label}</div>
        <div className="text-[10px] leading-snug text-gray-500">{item.description}</div>
      </div>
    </div>
  );
}

/**
 * LCC/LCC2 模型帮助浮层：居中展示第一人称 / 枢轴两种操作说明。
 * tab 切换仅影响帮助内容，不修改 viewer 真实 controlMode。
 */
export function ModelViewerHelp({ open, onClose, controlMode }: ModelViewerHelpProps) {
  const [helpTab, setHelpTab] = useState<HelpPanelMode>(
    controlMode === "walk" ? "walk" : "orbit",
  );

  useEffect(() => {
    if (open) {
      setHelpTab(controlMode === "walk" ? "walk" : "orbit");
    }
  }, [open, controlMode]);

  if (!open) {
    return null;
  }

  const actions = helpTab === "walk" ? WALK_ACTIONS : ORBIT_ACTIONS;
  const shortcuts = helpTab === "walk" ? WALK_SHORTCUTS : ORBIT_SHORTCUTS;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-viewer-help-title"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-[720px] rounded-2xl border border-white/[0.08] bg-[#101820]/92 px-6 pb-5 pt-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 顶部标题区 */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="model-viewer-help-title"
              className="text-[15px] font-medium tracking-wide text-white"
            >
              帮助
            </h2>
            <p className="mt-1 text-[12px] text-gray-400">查看当前模型操作指南</p>
          </div>
          <button
            type="button"
            aria-label="关闭帮助"
            title="关闭帮助"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-400 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 模式切换 tab */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
            {MODE_TABS.map(({ mode, label, icon: Icon }) => {
              const active = helpTab === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setHelpTab(mode)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] transition-all ${
                    active
                      ? "bg-cyan-500/20 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35)]"
                      : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 操作项：walk 6 项（桌面一行，不足时 3+3）；orbit 4 项居中一行 */}
        <div
          className={
            helpTab === "walk"
              ? "mx-auto grid max-w-[640px] grid-cols-3 gap-x-1 gap-y-5 sm:max-w-none lg:grid-cols-6"
              : "mx-auto grid max-w-[480px] grid-cols-2 gap-x-1 gap-y-5 sm:grid-cols-4"
          }
        >
          {actions.map((item) => (
            <HelpActionCard key={item.id} item={item} />
          ))}
        </div>

        {/* 底部快捷键提示 */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-4">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="inline-flex items-center gap-2 text-[11px] text-gray-500"
            >
              <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
                {shortcut.key}
              </span>
              <span>{shortcut.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
