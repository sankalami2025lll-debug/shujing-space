/**
 * 数据文件：模型社区静态数据 communityData
 * 用途：当前 Figma 原型的静态模型数据，供 ModelCommunity（精选模型）与 ModelLibrary（列表与详情）使用
 * 对应文档：页面功能注释文档/13_模型数据结构_communityData.md
 * 注意：正式开发时应替换为后端接口返回的数据（如 GET /api/models），不要把静态数据长期写死在页面组件中
 */

// CommunityModel：单个模型的数据类型（显式 interface，便于把 viewerUrl 声明为可选字段）
// 每个字段对应未来数据库模型表字段：id→id、title→title、type→type、tags→tags(json)、
// author→user 名称、views→views_count 展示值、likes→likes_count、time→created_at 展示值、color/pattern→封面视觉表现
export interface CommunityModel {
  id: number;
  title: string;
  type: string;
  tags: string[];
  author: string;
  views: string;
  likes: number;
  time: string;
  color: string;
  pattern: string;
  // viewerUrl：模型详情页用 iframe 内嵌的外部三维 Viewer 在线浏览地址（对应后端模型表 model_url 字段）。
  //   可选：缺省（或为空）时，详情页回退到占位 UI。
  //   当前为测试用的公开 Sketchfab 嵌入链接（仅验证 iframe 内嵌可行性），正式开发应替换为后端返回的真实地址。
  viewerUrl?: string;
}

// communityModels：Figma 原型静态模型数据，正式开发应替换为后端接口 GET /api/models 返回的数据
export const communityModels: CommunityModel[] = [
  {
    id: 1,
    title: "古建筑实景三维模型",
    type: "实景三维",
    tags: ["数字文旅", "实景重建", "沉浸展示"],
    author: "数境空间官方",
    views: "2.1k",
    likes: 368,
    time: "2天前",
    color: "from-amber-900/40 to-stone-900/60",
    pattern: "grid",
    // 测试用外部 Viewer 链接（Sketchfab 官方公开 demo 模型），用于验证 iframe 内嵌
    viewerUrl: "https://sketchfab.com/models/722e900559cf41bdbf9acb8df606b3b8/embed?autospin=0.2&ui_theme=dark&ui_infos=0",
  },
  {
    id: 2,
    title: "商业空间云上展示模型",
    type: "实景三维",
    tags: ["商业空间", "云上营销", "在线展示"],
    author: "空间资产用户",
    views: "1.8k",
    likes: 245,
    time: "5天前",
    color: "from-slate-800/60 to-gray-900/60",
    pattern: "lines",
  },
  {
    id: 3,
    title: "园区 BIM 管理模型",
    type: "BIM 模型",
    tags: ["园区", "BIM", "数字孪生"],
    author: "数境空间官方",
    views: "1.6k",
    likes: 210,
    time: "1周前",
    color: "from-cyan-900/30 to-slate-900/60",
    pattern: "dots",
    // 测试用外部 Viewer 链接（Sketchfab 官方公开 demo 模型），用于验证 iframe 内嵌
    viewerUrl: "https://sketchfab.com/models/cc89c1e265514cbab1234eba999683e1/embed?autospin=0.2&ui_theme=dark&ui_infos=0",
  },
  {
    id: 4,
    title: "建筑改造 BIM 模型",
    type: "BIM 模型",
    tags: ["工程改造", "空间复核", "建筑管理"],
    author: "工程模型用户",
    views: "980",
    likes: 126,
    time: "2周前",
    color: "from-gray-800/60 to-zinc-900/60",
    pattern: "grid",
  },
  {
    id: 5,
    title: "建筑构件资产模型",
    type: "构件级模型",
    tags: ["建筑构件", "精细建模", "资产管理"],
    author: "模型创作者",
    views: "760",
    likes: 98,
    time: "3周前",
    color: "from-stone-800/50 to-gray-900/60",
    pattern: "lines",
  },
  {
    id: 6,
    title: "机电设备构件模型",
    type: "构件级模型",
    tags: ["设备对象", "机电构件", "空间部件"],
    author: "BIM 用户",
    views: "650",
    likes: 87,
    time: "1个月前",
    color: "from-zinc-800/50 to-gray-900/60",
    pattern: "dots",
  },
  {
    id: 7,
    title: "室内导航训练场景",
    type: "具身智能机器人训练场景",
    tags: ["室内导航", "机器人训练", "场景理解"],
    author: "数境空间官方",
    views: "1.2k",
    likes: 188,
    time: "3天前",
    color: "from-violet-900/40 to-slate-900/60",
    pattern: "grid",
  },
  {
    id: 8,
    title: "园区巡检训练场景",
    type: "具身智能机器人训练场景",
    tags: ["园区巡检", "路径理解", "空间交互"],
    author: "数境空间官方",
    views: "1.1k",
    likes: 172,
    time: "4天前",
    color: "from-purple-900/40 to-slate-900/60",
    pattern: "lines",
  },
  {
    id: 9,
    title: "影视游戏场景模型",
    type: "实景三维",
    tags: ["游戏影视", "真实场景", "数字资产"],
    author: "场景资产用户",
    views: "890",
    likes: 133,
    time: "2周前",
    color: "from-rose-900/30 to-gray-900/60",
    pattern: "dots",
  },
  {
    id: 10,
    title: "历史建筑数字存档模型",
    type: "实景三维",
    tags: ["数字存档", "历史建筑", "长期保存"],
    author: "文旅模型用户",
    views: "1.4k",
    likes: 216,
    time: "1周前",
    color: "from-emerald-900/30 to-slate-900/60",
    pattern: "grid",
  },
];

// typeTagColor：模型类型对应的视觉标签样式映射；新增模型类型时必须同步补充对应样式
export const typeTagColor: Record<string, string> = {
  "实景三维": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "BIM 模型": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "构件级模型": "bg-slate-500/10 text-slate-300 border-slate-500/20",
  "具身智能机器人训练场景": "bg-violet-500/10 text-violet-400 border-violet-500/20",
};
