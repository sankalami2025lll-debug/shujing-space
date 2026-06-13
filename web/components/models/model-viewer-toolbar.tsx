"use client";

import {
  Camera,
  Expand,
  Home,
  Info,
  Layers3,
  Map,
  Maximize,
  Move3D,
  PenSquare,
  RefreshCcw,
  Ruler,
  ScanSearch,
  Save,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ModelViewerCapabilities,
  ModelViewerControlMode,
} from "@/components/models/viewers/types";

interface ModelViewerToolbarProps {
  capabilities: ModelViewerCapabilities;
  onResetView?: () => void;
  onFitView?: () => void;
  onToggleFullscreen?: () => void;
  onTakeScreenshot?: () => void;
  onSaveLaunchView?: () => void;
  showSaveLaunchView?: boolean;
  onToggleHelp?: () => void;
  isHelpOpen?: boolean;
  canShowSaveLaunchView?: boolean;
  saveLaunchViewPending?: boolean;
  /** 观察 / 漫游模式切换（LCC viewer） */
  controlMode?: ModelViewerControlMode;
  onToggleControlMode?: () => void;
  canToggleControlMode?: boolean;
}

const TOOL_ITEMS = [
  { key: "reset", label: "回到初始视角", icon: Home, enabledBy: "resetView" },
  { key: "saveLaunchView", label: "保存启动视图", icon: Save, enabledBy: "saveView" },
  { key: "fullscreen", label: "全屏", icon: Expand, enabledBy: "fullscreen" },
  { key: "screenshot", label: "截图", icon: Camera, enabledBy: "screenshot" },
  { key: "orbit", label: "旋转 / 环绕", icon: Move3D, enabledBy: "orbit" },
  { key: "pan", label: "平移", icon: Maximize, enabledBy: "pan" },
  { key: "zoom", label: "缩放", icon: ScanSearch, enabledBy: "zoom" },
  { key: "walk", label: "漫游模式", icon: Map, enabledBy: "walk" },
  { key: "measure", label: "测量", icon: Ruler, enabledBy: "measure" },
  { key: "annotation", label: "标注", icon: PenSquare, enabledBy: "annotation" },
  { key: "layer", label: "图层", icon: Layers3, enabledBy: "layer" },
  { key: "info", label: "信息", icon: Info, enabledBy: "section" },
] as const satisfies Array<{
  key: string;
  label: string;
  icon: typeof RefreshCcw;
  enabledBy: keyof ModelViewerCapabilities;
}>;

export function ModelViewerToolbar({
  capabilities,
  onResetView,
  onFitView,
  onToggleFullscreen,
  onTakeScreenshot,
  onSaveLaunchView,
  showSaveLaunchView = true,
  onToggleHelp,
  isHelpOpen = false,
  canShowSaveLaunchView = false,
  saveLaunchViewPending = false,
  controlMode = "orbit",
  onToggleControlMode,
  canToggleControlMode = false,
}: ModelViewerToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLccToolbar = canToggleControlMode && typeof onToggleControlMode === "function";
  const toolActions = useMemo(
    () => ({
      reset: onResetView,
      fitView: onFitView,
      saveLaunchView: onSaveLaunchView,
      fullscreen: onToggleFullscreen,
      screenshot: onTakeScreenshot,
    }),
    [onResetView, onFitView, onSaveLaunchView, onTakeScreenshot, onToggleFullscreen],
  );
  const orderedTools = useMemo(() => {
    const hiddenKeys = new Set<string>();
    if (isLccToolbar) {
      hiddenKeys.add("fullscreen");
      hiddenKeys.add("zoom");
    }

    const preferredOrder = isLccToolbar
      ? ["reset", "saveLaunchView", "screenshot"]
      : [];
    const preferredSet = new Set(preferredOrder);
    const visibleItems = TOOL_ITEMS.filter(
      (tool) => tool.key !== "walk" && !hiddenKeys.has(tool.key),
    );

    if (!isLccToolbar) {
      return visibleItems;
    }

    return [
      ...visibleItems.filter((tool) => preferredSet.has(tool.key)),
      ...visibleItems.filter((tool) => !preferredSet.has(tool.key)),
    ];
  }, [isLccToolbar]);

  return (
    <div className="flex items-end gap-2">
      <button
        type="button"
        aria-label={isExpanded ? "收起工具栏" : "展开工具栏"}
        aria-expanded={isExpanded}
        title={isExpanded ? "收起工具栏" : "展开工具栏"}
        onClick={() => setIsExpanded((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#0b1118]/85 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:border-cyan-300/30 hover:bg-[#0f1722]/90"
      >
        <Wrench className="h-4 w-4 text-cyan-100" />
      </button>

      <div
        className={`flex items-center gap-2 overflow-hidden transition-all duration-200 ${
          isExpanded
            ? "pointer-events-auto max-w-[720px] translate-x-0 opacity-100"
            : "pointer-events-none max-w-0 -translate-x-3 opacity-0"
        }`}
      >
        {isLccToolbar ? (
          <button
            type="button"
            aria-label={controlMode === "walk" ? "当前：漫游模式，点击切换观察" : "当前：观察模式，点击切换漫游"}
            title={controlMode === "walk" ? "漫游模式（WASD + 左键转头）" : "观察模式（轨道旋转）"}
            onClick={onToggleControlMode}
            className={`inline-flex h-11 items-center gap-1.5 rounded-2xl border px-3 backdrop-blur-md transition-all ${
              controlMode === "walk"
                ? "border-cyan-300/40 bg-cyan-950/50 text-cyan-100 shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
                : "border-white/10 bg-[#0b1118]/85 text-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.28)] hover:border-cyan-300/30 hover:bg-[#0f1722]/90"
            }`}
          >
            {controlMode === "walk" ? (
              <Map className="h-4 w-4" />
            ) : (
              <Move3D className="h-4 w-4" />
            )}
            <span className="text-[11px]">{controlMode === "walk" ? "漫游" : "观察"}</span>
          </button>
        ) : null}
        {orderedTools.map((tool) => {
          if (tool.key === "saveLaunchView" && !showSaveLaunchView) {
            return null;
          }
          const enabled =
            tool.key === "saveLaunchView"
              ? capabilities[tool.enabledBy] && canShowSaveLaunchView
              : capabilities[tool.enabledBy];
          const Icon = tool.icon;
          const onClick = toolActions[tool.key as keyof typeof toolActions];
          const actionable =
            enabled &&
            typeof onClick === "function" &&
            !(tool.key === "saveLaunchView" && saveLaunchViewPending);
          const title =
            tool.key === "saveLaunchView" && saveLaunchViewPending
              ? "正在保存启动视图"
              : tool.key === "saveLaunchView" && !canShowSaveLaunchView
                ? "保存启动视图（暂不可用）"
              : actionable
                ? tool.label
                : `${tool.label}（暂未接入）`;

          return (
            <button
              key={tool.key}
              type="button"
              aria-label={title}
              title={title}
              disabled={!actionable}
              onClick={onClick}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-md transition-all ${
                actionable
                  ? "border-white/10 bg-[#0b1118]/85 text-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.28)] hover:border-cyan-300/30 hover:bg-[#0f1722]/90"
                  : "cursor-not-allowed border-white/[0.08] bg-[#0b1118]/60 text-gray-500 opacity-70"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        {!isLccToolbar && canToggleControlMode && typeof onToggleControlMode === "function" ? (
          <button
            type="button"
            aria-label={controlMode === "walk" ? "当前：漫游模式，点击切换观察" : "当前：观察模式，点击切换漫游"}
            title={controlMode === "walk" ? "漫游模式（WASD + 左键转头）" : "观察模式（轨道旋转）"}
            onClick={onToggleControlMode}
            className={`inline-flex h-11 items-center gap-1.5 rounded-2xl border px-3 backdrop-blur-md transition-all ${
              controlMode === "walk"
                ? "border-cyan-300/40 bg-cyan-950/50 text-cyan-100 shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
                : "border-white/10 bg-[#0b1118]/85 text-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.28)] hover:border-cyan-300/30 hover:bg-[#0f1722]/90"
            }`}
          >
            {controlMode === "walk" ? (
              <Map className="h-4 w-4" />
            ) : (
              <Move3D className="h-4 w-4" />
            )}
            <span className="text-[11px]">{controlMode === "walk" ? "漫游" : "观察"}</span>
          </button>
        ) : null}
        {!isLccToolbar ? (
          <button
            type="button"
            aria-label={isHelpOpen ? "关闭帮助" : "打开帮助"}
            title={isHelpOpen ? "关闭帮助" : "打开帮助"}
            onClick={onToggleHelp}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-md transition-all ${
              typeof onToggleHelp === "function"
                ? "border-white/10 bg-[#0b1118]/85 text-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.28)] hover:border-cyan-300/30 hover:bg-[#0f1722]/90"
                : "cursor-not-allowed border-white/[0.08] bg-[#0b1118]/60 text-gray-500 opacity-70"
            }`}
            disabled={typeof onToggleHelp !== "function"}
          >
            <Info className={`h-4 w-4 ${isHelpOpen ? "text-cyan-200" : ""}`} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
