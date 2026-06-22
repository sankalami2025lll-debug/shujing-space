"use client";

/**
 * 组件名称：MobileLccViewerChrome
 * 组件用途：分享 iframe mobile=1 场景下的右上角工具按钮组（默认收起）
 * 主要功能：「工具」展开/收起；第一人称与枢轴切换；真实全屏；重置视角；打开帮助面板
 * 对应路由：/viewer/lcc/[id]?mobile=1
 */

import { useState } from "react";
import type { ModelViewerControlMode } from "@/components/models/viewers/types";

export interface MobileLccViewerChromeProps {
  /** 当前 viewer 控制模式 */
  controlMode: ModelViewerControlMode;
  /** 切换第一人称 / 枢轴 */
  onControlModeChange: (mode: ModelViewerControlMode) => void;
  /** 切换真实浏览器全屏（Fullscreen API） */
  onToggleFullscreen?: () => void;
  /** 当前 viewer 根容器是否处于全屏 */
  isFullscreen?: boolean;
  /** 当前环境是否支持 Fullscreen API */
  fullscreenSupported?: boolean;
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

/** 阻止触控事件冒泡到 canvas / OrbitControls */
function stopChromePointerEvent(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function MobileLccViewerChrome({
  controlMode,
  onControlModeChange,
  onToggleFullscreen,
  isFullscreen = false,
  fullscreenSupported = true,
  onResetView,
  onOpenHelp,
}: MobileLccViewerChromeProps) {
  /** 控制右上角按钮组展开 / 收起；默认收起仅显示「工具」 */
  const [isExpanded, setIsExpanded] = useState(false);

  const collapse = () => setIsExpanded(false);

  const handleToggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  const handleModeChange = (mode: ModelViewerControlMode) => {
    onControlModeChange(mode);
    collapse();
  };

  const handleToggleFullscreen = () => {
    if (!fullscreenSupported || !onToggleFullscreen) return;
    onToggleFullscreen();
    collapse();
  };

  const handleResetView = () => {
    onResetView();
    collapse();
  };

  const handleOpenHelp = () => {
    onOpenHelp();
    collapse();
  };

  return (
    <div
      className="pointer-events-auto absolute right-4 top-4 z-40 flex flex-col items-end gap-2"
      data-mobile-lcc-chrome="true"
      data-mobile-lcc-chrome-expanded={isExpanded ? "true" : "false"}
      style={chromeButtonStyle}
    >
      <ChromeButton
        label="工具"
        active={isExpanded}
        onClick={handleToggleExpand}
      />

      {isExpanded && (
        <>
          <ChromeButton
            label="第一人称"
            active={controlMode === "walk"}
            onClick={() => handleModeChange("walk")}
          />
          <ChromeButton
            label="枢轴"
            active={controlMode === "orbit"}
            onClick={() => handleModeChange("orbit")}
          />
          <ChromeButton
            label={
              !fullscreenSupported
                ? "全屏不可用"
                : isFullscreen
                  ? "退出全屏"
                  : "全屏"
            }
            disabled={!fullscreenSupported}
            onClick={handleToggleFullscreen}
          />
          <ChromeButton label="重置" onClick={handleResetView} />
          <ChromeButton label="帮助" onClick={handleOpenHelp} />
        </>
      )}
    </div>
  );
}

function ChromeButton({
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`min-w-[4.5rem] rounded-lg border px-3 py-1.5 text-[12px] font-medium backdrop-blur-sm transition-colors ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-black/35 text-white/45 opacity-40"
          : active
            ? "border-cyan-400/45 bg-cyan-950/55 text-cyan-50"
            : "border-white/15 bg-black/50 text-white hover:border-cyan-400/25 hover:bg-black/60"
      }`}
      style={chromeButtonStyle}
      onPointerDown={stopChromePointerEvent}
      onClick={(event) => {
        stopChromePointerEvent(event);
        if (disabled) return;
        onClick();
      }}
    >
      {label}
    </button>
  );
}
