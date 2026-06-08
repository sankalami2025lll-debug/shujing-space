"use client";

interface ModelViewerHelpProps {
  open: boolean;
}

const HELP_ROWS = [
  { key: "W / A / S / D", action: "移动" },
  { key: "Q / E", action: "下降 / 上升" },
  { key: "Shift", action: "加速" },
  { key: "左键拖动", action: "旋转视角" },
  { key: "右键拖动", action: "平移视角" },
  { key: "滚轮", action: "缩放" },
  { key: "R", action: "重置视角" },
  { key: "H", action: "打开 / 关闭帮助" },
  { key: "Esc", action: "关闭帮助" },
] as const;

export function ModelViewerHelp({ open }: ModelViewerHelpProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-20 left-4 z-20 w-[280px] rounded-2xl border border-white/10 bg-[#0b1118]/90 p-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium tracking-[0.24em] text-cyan-100/90">帮助</div>
          <div className="mt-1 text-[11px] text-gray-400">LCC / LCC2 真实操作控制</div>
        </div>
      </div>
      <div className="space-y-2 text-[12px]">
        {HELP_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-gray-100">
              {row.key}
            </span>
            <span className="text-right text-gray-300">{row.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
