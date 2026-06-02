/**
 * 模块：展示层格式化工具 format.ts
 * 用途：把后端数值/时间适配为原型 UI 展示形态；按 type 推导封面 color/pattern。
 * 说明：自 Vite src/lib/format.ts 平移，供模型社区精选卡片等复用。
 */

// formatViews：浏览量 → 展示字符串（1000 以上用 k）
export function formatViews(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count < 1000) return String(Math.floor(count));
  const k = count / 1000;
  const text = k.toFixed(1).replace(/\.0$/, "");
  return `${text}k`;
}

export type ModelPattern = "grid" | "lines" | "dots";

export interface CoverStyle {
  color: string;
  pattern: ModelPattern;
}

const TYPE_COVER_COLOR: Record<string, string> = {
  实景三维: "from-cyan-900/30 to-slate-900/60",
  "BIM 模型": "from-blue-900/40 to-slate-900/60",
  构件级模型: "from-slate-800/60 to-gray-900/60",
  具身智能机器人训练场景: "from-violet-900/40 to-slate-900/60",
};

const PATTERNS: ModelPattern[] = ["grid", "lines", "dots"];

// coverStyleByType：按模型 type 推导封面视觉（后端不返回 color/pattern）
export function coverStyleByType(type: string, seed = 0): CoverStyle {
  const color = TYPE_COVER_COLOR[type] ?? "from-slate-800/60 to-gray-900/60";
  const pattern = PATTERNS[Math.abs(Math.floor(seed)) % PATTERNS.length];
  return { color, pattern };
}

// formatRelativeTime：ISO 时间 → 相对时间（与 Vite 列表卡「2天前」一致）
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 60) return "刚刚";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分钟前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}天前`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffDay < 30) return `${diffWeek}周前`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}个月前`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}年前`;
}
