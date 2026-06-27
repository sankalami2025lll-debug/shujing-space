"use client";

import { X } from "lucide-react";
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

const MODE_TABS: Array<{ mode: HelpPanelMode; label: string }> = [
  { mode: "walk", label: "第一人称漫游" },
  { mode: "orbit", label: "枢轴模式" },
];

const WALK_SHORTCUTS = [
  { key: "R", text: "重置视角" },
  { key: "H", text: "打开 / 关闭帮助" },
  { key: "Esc", text: "关闭帮助 / 退出全屏" },
] as const;

const ORBIT_SHORTCUTS = [
  { key: "R", text: "重置视角" },
  { key: "H", text: "打开 / 关闭帮助" },
  { key: "Esc", text: "关闭帮助 / 退出全屏" },
] as const;

function KeyCap({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex h-11 items-center justify-center rounded-[10px] border border-white/10 bg-gradient-to-b from-[#444] to-[#2a2a2a] font-mono font-bold text-white shadow-[0_4px_0_#111,0_6px_8px_rgba(0,0,0,0.6)] ${
        wide ? "w-24 px-4 text-sm" : "w-11 text-lg"
      }`}
    >
      {children}
    </div>
  );
}

function ShortcutPill({ shortcut }: { shortcut: { key: string; text: string } }) {
  return (
    <div className="inline-flex items-center gap-2 text-[12px] text-gray-400">
      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-gray-200">
        {shortcut.key}
      </span>
      <span>{shortcut.text}</span>
    </div>
  );
}

function MouseControl({
  active,
}: {
  active: "left" | "right" | "wheel";
}) {
  return (
    <div
      className="relative flex h-24 w-14 justify-center overflow-hidden rounded-[28px] border-[2px] border-[#444] bg-gradient-to-b from-[#333] to-[#1a1a1a] pt-3 shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
      aria-hidden="true"
    >
      <div className="absolute bottom-1/2 top-0 w-[2px] bg-[#111]" />
      <div className="absolute left-0 right-0 top-[45%] h-[2px] bg-[#111]" />
      {active === "left" ? (
        <div className="absolute bottom-[55%] left-0 right-1/2 top-0 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.65)]" />
      ) : null}
      {active === "right" ? (
        <div className="absolute bottom-[55%] left-1/2 right-0 top-0 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.65)]" />
      ) : null}
      <div
        className={`absolute top-3 z-10 h-6 w-2.5 rounded-full border border-[#333] ${
          active === "wheel"
            ? "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,1)]"
            : "bg-[#111]"
        }`}
      />
    </div>
  );
}

function HelpRow({
  visual,
  title,
  caption,
}: {
  visual: ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex w-[160px] shrink-0 justify-center">{visual}</div>
      <div>
        <div className="text-[16px] font-medium tracking-wide text-gray-100">{title}</div>
        <div className="mt-1 text-[12px] text-gray-500">{caption}</div>
      </div>
    </div>
  );
}

function WasdControl() {
  return (
    <div className="flex flex-col items-center gap-2">
      <KeyCap>W</KeyCap>
      <div className="flex gap-2">
        <KeyCap>A</KeyCap>
        <KeyCap>S</KeyCap>
        <KeyCap>D</KeyCap>
      </div>
    </div>
  );
}

function QeControl() {
  return (
    <div className="flex gap-2">
      <KeyCap>Q</KeyCap>
      <KeyCap>E</KeyCap>
    </div>
  );
}

function WalkHelpContent() {
  return (
    <div className="flex w-full flex-col items-center gap-10 md:flex-row md:items-start md:justify-center md:gap-20">
      <div className="flex flex-col gap-8 md:gap-12">
        <HelpRow
          visual={<MouseControl active="left" />}
          title="环顾四周"
          caption="鼠标左键拖动"
        />
        <HelpRow
          visual={<MouseControl active="right" />}
          title="平移画面"
          caption="鼠标右键拖动"
        />
        <HelpRow
          visual={<MouseControl active="wheel" />}
          title="沿视线前后移动"
          caption="鼠标滚轮"
        />
      </div>

      <div className="flex flex-col gap-8">
        <HelpRow visual={<WasdControl />} title="水平移动" caption="W / A / S / D" />
        <HelpRow visual={<QeControl />} title="垂直升降" caption="Q / E" />
        <HelpRow visual={<KeyCap wide>Shift</KeyCap>} title="加速移动" caption="按住 Shift" />
      </div>
    </div>
  );
}

function OrbitHelpContent() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-10 md:flex-row md:gap-16">
      <HelpRow
        visual={<MouseControl active="left" />}
        title="旋转模型"
        caption="鼠标左键拖动"
      />
      <HelpRow
        visual={<MouseControl active="right" />}
        title="平移画面"
        caption="鼠标右键拖动"
      />
      <HelpRow
        visual={<MouseControl active="wheel" />}
        title="缩放模型"
        caption="鼠标滚轮"
      />
    </div>
  );
}

/**
 * LCC/LCC2 模型帮助浮层：参考新工具栏设计，展示第一人称 / 枢轴两种真实操作说明。
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

  const shortcuts = helpTab === "walk" ? WALK_SHORTCUTS : ORBIT_SHORTCUTS;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 text-white backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-viewer-help-title"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="关闭帮助"
        title="关闭帮助"
        onClick={onClose}
        className="absolute right-6 top-6 z-10 rounded-full bg-white/5 p-3 text-white/50 transition-all hover:bg-white/10 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>

      <div
        className="flex w-full max-w-[980px] flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="model-viewer-help-title" className="sr-only">
          模型浏览帮助
        </h2>

        <div className="mb-12 flex rounded-full border border-white/10 bg-black/40 p-1 shadow-2xl md:mb-16">
          {MODE_TABS.map(({ mode, label }) => {
            const active = helpTab === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => setHelpTab(mode)}
                className={`rounded-full px-6 py-2.5 text-[14px] transition-all sm:px-8 sm:py-3 sm:text-[15px] ${
                  active
                    ? "bg-white/15 font-medium text-cyan-400 shadow-md"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {helpTab === "walk" ? <WalkHelpContent /> : <OrbitHelpContent />}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t border-white/10 pt-5 md:mt-16">
          {shortcuts.map((shortcut) => (
            <ShortcutPill key={shortcut.key} shortcut={shortcut} />
          ))}
        </div>
      </div>
    </div>
  );
}
