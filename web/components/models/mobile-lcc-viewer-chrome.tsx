"use client";

/**
 * 组件名称：MobileLccViewerChrome
 * 组件用途：分享 iframe mobile=1 场景下的常驻顶栏（模式切换 / 重置 / 帮助）
 * 主要功能：第一人称与枢轴切换；重置视角；打开帮助面板
 * 对应路由：/viewer/lcc/[id]?mobile=1
 */

import type { ModelViewerControlMode } from "@/components/models/viewers/types";

export interface MobileLccViewerChromeProps {
  /** 当前 viewer 控制模式 */
  controlMode: ModelViewerControlMode;
  /** 切换第一人称 / 枢轴 */
  onControlModeChange: (mode: ModelViewerControlMode) => void;
  /** 重置视角（会先清零移动输入） */
  onResetView: () => void;
  /** 打开帮助面板 */
  onOpenHelp: () => void;
}

const chromeButtonStyle: React.CSSProperties = {
  touchAction: "manipulation",
  userSelect: "none",
  WebkitUserSelect: "none",
};

export function MobileLccViewerChrome({
  controlMode,
  onControlModeChange,
  onResetView,
  onOpenHelp,
}: MobileLccViewerChromeProps) {
  return (
    <div
      className="pointer-events-auto absolute right-6 top-5 z-40 flex flex-wrap items-center justify-end gap-2"
      data-mobile-lcc-chrome="true"
      style={chromeButtonStyle}
    >
      <ChromeButton
        label="第一人称"
        active={controlMode === "walk"}
        onClick={() => onControlModeChange("walk")}
      />
      <ChromeButton
        label="枢轴"
        active={controlMode === "orbit"}
        onClick={() => onControlModeChange("orbit")}
      />
      <ChromeButton label="重置" onClick={onResetView} />
      <ChromeButton label="帮助" onClick={onOpenHelp} />
    </div>
  );
}

function ChromeButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-lg border px-3.5 py-2 text-[13px] font-medium backdrop-blur-sm transition-colors ${
        active
          ? "border-cyan-400/45 bg-cyan-950/55 text-cyan-50"
          : "border-white/15 bg-black/45 text-white hover:border-white/25 hover:bg-black/55"
      }`}
      style={chromeButtonStyle}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}
