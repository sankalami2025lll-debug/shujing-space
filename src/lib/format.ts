/**
 * 模块：展示层格式化工具 format.ts
 * 用途：把后端返回的数值/时间/分类适配为当前 Figma 原型 UI 期望的展示形态，保证接口接入后卡片视觉不回归。
 * 背景：
 *   - 后端列表返回数值 viewsCount(int) 与 ISO createdAt，而原型 UI 用「2.1k」「2天前」这类字符串。
 *   - 后端不返回封面视觉字段 color/pattern（纯前端视觉），需按模型 type 确定性推导，复用 communityData 的渐变规则。
 */

// formatViews：浏览量/数值 → 展示字符串（与原型一致，1000 以上用 k）。
//   980 → "980"；2100 → "2.1k"；10000 → "10k"。
export function formatViews(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count < 1000) return String(Math.floor(count));
  const k = count / 1000;
  // 保留一位小数并去掉多余的 .0（如 2.0k → 2k）。
  const text = k.toFixed(1).replace(/\.0$/, "");
  return `${text}k`;
}

// formatRelativeTime：ISO 时间字符串 → 相对时间展示（与原型「N天前 / N周前 / N个月前」一致）。
//   非法时间返回空字符串，避免渲染 NaN。
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

// ModelPattern：封面装饰纹理类型（与 communityData.pattern 取值一致）。
export type ModelPattern = "grid" | "lines" | "dots";

// CoverStyle：封面视觉描述（Tailwind 渐变 class + 纹理）。
export interface CoverStyle {
  color: string;
  pattern: ModelPattern;
}

// TYPE_COVER_COLOR：模型类型 → 封面渐变色映射；与 typeTagColor 的配色基调保持一致。
const TYPE_COVER_COLOR: Record<string, string> = {
  实景三维: "from-cyan-900/30 to-slate-900/60",
  "BIM 模型": "from-blue-900/40 to-slate-900/60",
  构件级模型: "from-slate-800/60 to-gray-900/60",
  具身智能机器人训练场景: "from-violet-900/40 to-slate-900/60",
};

// PATTERNS：三种纹理，按种子确定性轮换，制造与原型一致的视觉差异。
const PATTERNS: ModelPattern[] = ["grid", "lines", "dots"];

/**
 * coverStyleByType：按模型 type 推导封面视觉；可选 seed（如模型 id）让同类型卡片纹理有稳定差异。
 * 用于替代后端缺失的 color/pattern 字段，保持原型卡片观感。
 */
export function coverStyleByType(type: string, seed = 0): CoverStyle {
  const color = TYPE_COVER_COLOR[type] ?? "from-slate-800/60 to-gray-900/60";
  const pattern = PATTERNS[Math.abs(Math.floor(seed)) % PATTERNS.length];
  return { color, pattern };
}
