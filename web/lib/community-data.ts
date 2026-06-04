/**
 * 数据文件：模型社区静态展示配置
 * 用途：仅保留模型类型标签样式，模型数据本身全部以 /api/models 为准。
 */

// typeTagColor：模型类型标签样式（与 Vite communityData 一致）
export const typeTagColor: Record<string, string> = {
  实景三维: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "BIM 模型": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  构件级模型: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  具身智能机器人训练场景:
    "bg-violet-500/10 text-violet-400 border-violet-500/20",
};
