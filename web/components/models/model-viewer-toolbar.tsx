"use client";

import {
  Camera,
  Focus,
  Footprints,
  HelpCircle,
  MessageSquare,
  Move,
  MoveVertical,
  Orbit,
  PanelLeftClose,
  Rotate3d,
  Ruler,
  Save,
  ScatterChart,
  Settings,
  SplitSquareHorizontal,
  Wrench,
  X,
  type LucideIcon,
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
  onTogglePointsDisplayMode?: () => boolean;
  canTogglePointsDisplayMode?: boolean;
  onSetEnvironmentEnabled?: (enabled: boolean) => boolean;
  canUseEnvironment?: boolean;
  showSaveLaunchView?: boolean;
  onToggleHelp?: () => void;
  isHelpOpen?: boolean;
  canShowSaveLaunchView?: boolean;
  saveLaunchViewPending?: boolean;
  /** 枢轴 / 第一人称模式切换（LCC viewer） */
  controlMode?: ModelViewerControlMode;
  onToggleControlMode?: () => void;
  canToggleControlMode?: boolean;
}

type ActiveToolbarMenu = "none" | "operation" | "settings";

type ToolbarButtonConfig = {
  key: string;
  name: string;
  icon: LucideIcon;
  action?: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip?: string;
  rotate?: boolean;
  tone?: "default" | "owner";
};

type ToolbarSettings = {
  collision: boolean;
  moveSpeed: number;
  environment: "无" | "环境" | "天空球";
  renderQuality: "性能" | "平衡" | "质量";
  unitSystem: "公制" | "英制";
  lengthUnit: "m" | "mm";
};

const CONTROL_MODE_UI_LABEL: Record<ModelViewerControlMode, string> = {
  walk: "第一人称漫游",
  orbit: "枢轴模式",
};

function getModeIcon(mode: ModelViewerControlMode) {
  return mode === "walk" ? Footprints : Orbit;
}

function getDisabledTooltip(name: string) {
  return `${name}（即将开放）`;
}

function ToolbarTooltip({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded border border-white/10 bg-black/80 px-2 py-1 text-[12px] text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      {label}
    </div>
  );
}

function ToolbarIconButton({ tool }: { tool: ToolbarButtonConfig }) {
  const Icon = tool.icon;
  const disabled = Boolean(tool.disabled);
  const tooltip = tool.tooltip ?? tool.name;
  const activeClass = tool.active
    ? "bg-cyan-500/20 text-cyan-400"
    : "text-white/80 hover:bg-white/10 hover:text-white";

  return (
    <button
      type="button"
      aria-label={tooltip}
      title={tooltip}
      disabled={disabled}
      onClick={disabled ? undefined : tool.action}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
        disabled
          ? "cursor-not-allowed bg-white/[0.02] text-gray-400/70"
          : activeClass
      }`}
    >
      <Icon className={`h-4 w-4 ${tool.rotate ? "rotate-90" : ""}`} />
      <ToolbarTooltip label={tooltip} />
    </button>
  );
}

function SegmentedOption<T extends string>({
  value,
  current,
  onSelect,
  disabled = false,
  disabledTooltip,
}: {
  value: T;
  current: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
  disabledTooltip?: string;
}) {
  const active = value === current;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      disabled={disabled}
      title={disabled ? disabledTooltip : value}
      className={`flex-1 rounded-md py-1.5 text-[12px] transition-all ${
        disabled
          ? "cursor-not-allowed bg-white/[0.02] text-gray-500"
          : active
          ? "bg-white/20 text-white shadow-sm"
          : "text-gray-400 hover:text-gray-200"
      }`}
    >
      {value}
    </button>
  );
}

function SettingsSegment<T extends string>({
  label,
  options,
  value,
  onSelect,
  disabledOptions = [],
  disabledTooltip,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onSelect: (value: T) => void;
  disabledOptions?: readonly T[];
  disabledTooltip?: string;
}) {
  return (
    <div className="mb-4">
      <span className="mb-2 block text-[12px] text-gray-500">{label}</span>
      <div className="flex rounded-lg border border-white/5 bg-black/50 p-1">
        {options.map((option) => (
          <SegmentedOption
            key={option}
            value={option}
            current={value}
            onSelect={onSelect}
            disabled={disabledOptions.includes(option)}
            disabledTooltip={disabledTooltip}
          />
        ))}
      </div>
    </div>
  );
}

function ToolbarSettingsPanel({
  settings,
  onChange,
  onClose,
  onSetEnvironmentEnabled,
  canUseEnvironment,
}: {
  settings: ToolbarSettings;
  onChange: (updater: (settings: ToolbarSettings) => ToolbarSettings) => void;
  onClose: () => void;
  onSetEnvironmentEnabled?: (enabled: boolean) => boolean;
  canUseEnvironment: boolean;
}) {
  const handleSelectEnvironment = (environment: ToolbarSettings["environment"]) => {
    if (environment === "天空球") {
      onChange((current) => ({ ...current, environment }));
      return;
    }

    if (environment === "环境") {
      const applied = onSetEnvironmentEnabled?.(true) ?? false;
      if (!applied) {
        return;
      }
      onChange((current) => ({ ...current, environment }));
      return;
    }

    onSetEnvironmentEnabled?.(false);
    onChange((current) => ({ ...current, environment }));
  };

  return (
    <div className="absolute bottom-14 left-14 z-30 w-64 rounded-xl border border-white/10 bg-[#1a1a1a]/95 p-4 text-white shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-medium">设置</h3>
        <button
          type="button"
          aria-label="关闭设置"
          title="关闭设置"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] text-gray-300">碰撞开关</span>
        <button
          type="button"
          aria-pressed={settings.collision}
          onClick={() =>
            onChange((current) => ({ ...current, collision: !current.collision }))
          }
          className={`relative h-4 w-8 rounded-full transition-colors ${
            settings.collision ? "bg-cyan-500" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
              settings.collision ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] text-gray-500">漫游移动速度</span>
          <span className="font-mono text-[12px] text-cyan-400">
            {settings.moveSpeed.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={settings.moveSpeed}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              moveSpeed: Number.parseFloat(event.target.value),
            }))
          }
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-black/50 accent-cyan-400"
        />
        <div className="mt-1 flex justify-between text-[10px] text-gray-600">
          <span>极慢</span>
          <span>极快</span>
        </div>
      </div>

      <SettingsSegment
        label="环境选项"
        options={["无", "环境", "天空球"] as const}
        value={settings.environment}
        onSelect={handleSelectEnvironment}
        disabledOptions={canUseEnvironment ? [] : (["环境"] as const)}
        disabledTooltip="当前模型不支持环境"
      />

      <SettingsSegment
        label="渲染选项"
        options={["性能", "平衡", "质量"] as const}
        value={settings.renderQuality}
        onSelect={(renderQuality) =>
          onChange((current) => ({ ...current, renderQuality }))
        }
      />

      <div className="mb-2 flex gap-3">
        <div className="flex-1">
          <SettingsSegment
            label="单位系统"
            options={["公制", "英制"] as const}
            value={settings.unitSystem}
            onSelect={(unitSystem) =>
              onChange((current) => ({ ...current, unitSystem }))
            }
          />
        </div>
        <div className="flex-1">
          <SettingsSegment
            label="长度"
            options={["m", "mm"] as const}
            value={settings.lengthUnit}
            onSelect={(lengthUnit) =>
              onChange((current) => ({ ...current, lengthUnit }))
            }
          />
        </div>
      </div>

      <p className="border-t border-white/5 pt-3 text-[11px] text-gray-500">
        部分设置功能即将开放
      </p>
    </div>
  );
}

export function ModelViewerToolbar({
  capabilities,
  onResetView,
  onSaveLaunchView,
  onTogglePointsDisplayMode,
  canTogglePointsDisplayMode = false,
  onSetEnvironmentEnabled,
  canUseEnvironment = false,
  showSaveLaunchView = true,
  onToggleHelp,
  isHelpOpen = false,
  canShowSaveLaunchView = false,
  saveLaunchViewPending = false,
  controlMode = "orbit",
  onToggleControlMode,
  canToggleControlMode = false,
}: ModelViewerToolbarProps) {
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveToolbarMenu>("none");
  const [settings, setSettings] = useState<ToolbarSettings>({
    collision: true,
    moveSpeed: 1,
    environment: "无",
    renderQuality: "平衡",
    unitSystem: "公制",
    lengthUnit: "m",
  });
  const ModeIcon = getModeIcon(controlMode);

  const canUseControlMode = canToggleControlMode && typeof onToggleControlMode === "function";
  const canUseReset = capabilities.resetView && typeof onResetView === "function";
  const canUseHelp = typeof onToggleHelp === "function";
  const canUsePointCloudToggle =
    canTogglePointsDisplayMode && typeof onTogglePointsDisplayMode === "function";
  const canUseEnvironmentToggle =
    canUseEnvironment && typeof onSetEnvironmentEnabled === "function";
  const canUseSaveLaunchView =
    showSaveLaunchView &&
    capabilities.saveView &&
    canShowSaveLaunchView &&
    typeof onSaveLaunchView === "function" &&
    !saveLaunchViewPending;
  const canManageModel = showSaveLaunchView && canShowSaveLaunchView;

  const handleToolbarToggle = () => {
    setIsToolbarOpen((current) => {
      const next = !current;
      if (!next) {
        setActiveMenu("none");
      }
      return next;
    });
  };

  const handleSelectControlMode = (mode: ModelViewerControlMode) => {
    setActiveMenu("none");
    if (!canUseControlMode || mode === controlMode) {
      return;
    }
    onToggleControlMode();
  };

  const guestTools = useMemo<ToolbarButtonConfig[]>(
    () => [
      {
        key: "reset",
        name: "初始视角",
        icon: Focus,
        action: onResetView,
        disabled: !canUseReset,
        tooltip: canUseReset ? "初始视角" : "初始视角（暂不可用）",
      },
      {
        key: "operation",
        name: "操作模式",
        icon: ModeIcon,
        action: () => setActiveMenu((current) => (current === "operation" ? "none" : "operation")),
        active: true,
        disabled: !canUseControlMode,
        tooltip: canUseControlMode ? `操作模式：${CONTROL_MODE_UI_LABEL[controlMode]}` : "操作模式（暂不可用）",
      },
      {
        key: "point-cloud",
        name: "点云切换",
        icon: ScatterChart,
        action: onTogglePointsDisplayMode,
        disabled: !canUsePointCloudToggle,
        tooltip: canUsePointCloudToggle ? "点云切换" : "当前模型不支持",
      },
      { key: "annotation", name: "标注", icon: MessageSquare, disabled: true, tooltip: getDisabledTooltip("标注") },
      { key: "screenshot", name: "拍照", icon: Camera, disabled: true, tooltip: getDisabledTooltip("拍照") },
      { key: "measure", name: "测量", icon: Ruler, disabled: true, tooltip: getDisabledTooltip("测量") },
      {
        key: "section",
        name: "高度剖切",
        icon: SplitSquareHorizontal,
        rotate: true,
        disabled: true,
        tooltip: getDisabledTooltip("高度剖切"),
      },
      {
        key: "settings",
        name: "设置",
        icon: Settings,
        action: () => setActiveMenu((current) => (current === "settings" ? "none" : "settings")),
        active: activeMenu === "settings",
        tooltip: "设置",
      },
      {
        key: "help",
        name: "帮助",
        icon: HelpCircle,
        action: onToggleHelp,
        active: isHelpOpen,
        disabled: !canUseHelp,
        tooltip: canUseHelp ? (isHelpOpen ? "关闭帮助" : "帮助") : "帮助（暂不可用）",
      },
    ],
    [
      ModeIcon,
      activeMenu,
      canUseControlMode,
      canUseHelp,
      canUsePointCloudToggle,
      canUseReset,
      controlMode,
      isHelpOpen,
      onResetView,
      onTogglePointsDisplayMode,
      onToggleHelp,
    ],
  );

  const ownTools = useMemo<ToolbarButtonConfig[]>(
    () => [
      {
        key: "save-launch-view",
        name: "保存初始视角",
        icon: Save,
        action: onSaveLaunchView,
        disabled: !canUseSaveLaunchView,
        tooltip: saveLaunchViewPending
          ? "正在保存初始视角"
          : canUseSaveLaunchView
            ? "保存初始视角"
            : "保存视角暂不可用",
        tone: "owner",
      },
      { key: "model-rotate", name: "模型旋转", icon: Rotate3d, disabled: true, tooltip: getDisabledTooltip("模型旋转"), tone: "owner" },
      { key: "model-height", name: "模型高度", icon: MoveVertical, disabled: true, tooltip: getDisabledTooltip("模型高度"), tone: "owner" },
      { key: "model-move", name: "模型平移", icon: Move, disabled: true, tooltip: getDisabledTooltip("模型平移"), tone: "owner" },
    ],
    [canUseSaveLaunchView, onSaveLaunchView, saveLaunchViewPending],
  );

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        aria-label={isToolbarOpen ? "收起工具栏" : "展开工具栏"}
        aria-expanded={isToolbarOpen}
        title={isToolbarOpen ? "收起工具栏（纯净模式）" : "展开工具栏"}
        onClick={handleToolbarToggle}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-gray-300 shadow-lg backdrop-blur-md transition-all hover:bg-black/70 hover:text-white"
      >
        {isToolbarOpen ? <PanelLeftClose className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
      </button>

      <div
        className={`origin-left rounded-xl border border-white/10 bg-black/50 p-1.5 shadow-lg backdrop-blur-md transition-all duration-300 ${
          isToolbarOpen
            ? "pointer-events-auto translate-x-0 scale-100 opacity-100"
            : "pointer-events-none absolute left-12 -translate-x-4 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-1.5">
          {guestTools.map((tool) => (
            <ToolbarIconButton key={tool.key} tool={tool} />
          ))}

          {canManageModel ? (
            <>
              <div className="mx-1 h-5 w-[1px] bg-white/10" />
              {ownTools.map((tool) => (
                <ToolbarIconButton key={tool.key} tool={tool} />
              ))}
            </>
          ) : null}
        </div>
      </div>

      {activeMenu === "operation" && isToolbarOpen ? (
        <div className="absolute bottom-14 left-14 z-30 w-36 rounded-xl border border-white/10 bg-[#1a1a1a]/90 p-2 text-white shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => handleSelectControlMode("walk")}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-all ${
              controlMode === "walk"
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-gray-300 hover:bg-white/10"
            }`}
          >
            <Footprints className="h-4 w-4" />
            第一人称漫游
          </button>
          <button
            type="button"
            onClick={() => handleSelectControlMode("orbit")}
            className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-all ${
              controlMode === "orbit"
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-gray-300 hover:bg-white/10"
            }`}
          >
            <Orbit className="h-4 w-4" />
            枢轴模式
          </button>
        </div>
      ) : null}

      {activeMenu === "settings" && isToolbarOpen ? (
        <ToolbarSettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setActiveMenu("none")}
          onSetEnvironmentEnabled={onSetEnvironmentEnabled}
          canUseEnvironment={canUseEnvironmentToggle}
        />
      ) : null}
    </div>
  );
}
