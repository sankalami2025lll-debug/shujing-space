/**
 * 模块：首页静态内容数据
 * 用途：业务平台 / 业务场景卡片与 VideoModal 弹窗数据（与 Vite App.tsx 一致）
 * 对应文档：页面功能注释文档/02_首页_Home.md
 */
import {
  Building2,
  Camera,
  Mountain,
  Archive,
  Home,
  Brain,
  Cloud,
  Network,
} from "lucide-react";
import type { ReactNode } from "react";

// ModalItem：业务平台 / 场景卡片点击后传入 VideoModal 的数据结构
export interface ModalItem {
  category: string;
  title: string;
  videoTitle: string;
  desc: string;
  tags: string[];
  isEmbodied?: boolean;
  gradientFrom: string;
  gradientTo: string;
  icon: ReactNode;
  // media：弹窗左侧展示的素材配置
  media?: {
    type: "video" | "image";
    src: string;
  };
}

// platformCards：业务平台三张卡片数据
export const platformCards: ModalItem[] = [
  {
    category: "业务平台",
    title: "云端轻量化平台",
    videoTitle: "三维空间模型云端展示演示",
    desc: "支持大规模三维空间模型在线加载、浏览、分享与展示，让复杂空间数据可以在云端快速访问，适用于项目汇报、客户演示、远程查看与多端展示。",
    tags: ["云端展示", "在线浏览", "轻量化加载"],
    isEmbodied: false,
    gradientFrom: "from-cyan-900/40",
    gradientTo: "to-slate-900/60",
    icon: <Cloud className="w-6 h-6" />,
    media: { type: "video", src: "/首页_业务平台/云端轻量化平台.mp4" },
  },
  {
    category: "业务平台",
    title: "数字孪生管理平台",
    videoTitle: "数字孪生空间管理演示",
    desc: "融合实景三维、BIM 与业务数据，构建面向园区、楼宇、工程与运维场景的可视化管理平台，实现空间资产管理、状态查看与业务协同。",
    tags: ["数字孪生", "BIM 融合", "可视化管理"],
    isEmbodied: false,
    gradientFrom: "from-blue-900/40",
    gradientTo: "to-slate-900/60",
    icon: <Network className="w-6 h-6" />,
    media: { type: "video", src: "https://shujingspace.oss-cn-shenzhen.aliyuncs.com/shujing-space/media/%E9%A6%96%E9%A1%B5_%E4%B8%9A%E5%8A%A1%E5%B9%B3%E5%8F%B0/%E6%95%B0%E5%AD%97%E5%AD%AA%E7%94%9F%E7%AE%A1%E7%90%86%E5%B9%B3%E5%8F%B0.mp4" },
  },
  {
    category: "业务平台",
    title: "具身智能空间训练平台",
    videoTitle: "机器人空间训练场景演示",
    desc: "基于真实三维空间数据构建训练场景，为机器人感知、导航、交互、任务理解与空间推理提供场景数据基础，服务具身智能训练应用。",
    tags: ["具身智能", "空间训练", "场景理解"],
    isEmbodied: true,
    gradientFrom: "from-violet-900/40",
    gradientTo: "to-slate-900/60",
    icon: <Brain className="w-6 h-6" />,
    media: { type: "image", src: "/首页_业务平台/具身智能空间训练平台.png" },
  },
];

// scenarioCards：业务场景弹窗完整数据（含渐变与 videoTitle）
const SCENE_MEDIA_BASE = "/首页_业务模块的封面/弹窗模块素材";

export const scenarioCards: ModalItem[] = [
  {
    category: "业务场景",
    title: "工程改造",
    videoTitle: "工程改造三维空间应用演示",
    desc: "用于建筑复核、空间测量、改造预演与工程数据管理，帮助工程团队更直观地理解现场空间关系，提升方案沟通与项目管理效率。",
    tags: ["工程复核", "改造预演", "BIM 接入"],
    isEmbodied: false,
    gradientFrom: "from-stone-800/60",
    gradientTo: "to-gray-900/60",
    icon: <Building2 className="w-6 h-6" />,
    media: { type: "image", src: `${SCENE_MEDIA_BASE}/工程改造.png` },
  },
  {
    category: "业务场景",
    title: "数字文旅",
    videoTitle: "数字文旅沉浸式展示演示",
    desc: "用于景区数字化、线上导览、沉浸式展示与文化空间传播，让文旅空间以更直观、更沉浸的方式进行线上展示和传播。",
    tags: ["线上导览", "沉浸展示", "文旅数字化"],
    isEmbodied: false,
    gradientFrom: "from-emerald-900/40",
    gradientTo: "to-slate-900/60",
    icon: <Mountain className="w-6 h-6" />,
    media: { type: "image", src: `${SCENE_MEDIA_BASE}/数字文旅.png` },
  },
  {
    category: "业务场景",
    title: "游戏影视",
    videoTitle: "真实场景数字资产演示",
    desc: "为虚拟制作、影视场景与游戏资产提供真实空间数据基础，帮助内容团队快速获取真实场景参考与三维空间资产。",
    tags: ["真实场景", "虚拟制作", "数字资产"],
    isEmbodied: false,
    gradientFrom: "from-rose-900/30",
    gradientTo: "to-gray-900/60",
    icon: <Camera className="w-6 h-6" />,
    media: { type: "video", src: `${SCENE_MEDIA_BASE}/影视游戏.mp4` },
  },
  {
    category: "业务场景",
    title: "数字存档",
    videoTitle: "历史空间数字化存档演示",
    desc: "用于历史建筑、工业遗产、城市空间与重要场景的长期数字化保存，形成可查看、可管理、可拓展的三维空间数据资产。",
    tags: ["历史建筑", "空间存档", "实景重建"],
    isEmbodied: false,
    gradientFrom: "from-amber-900/30",
    gradientTo: "to-slate-900/60",
    icon: <Archive className="w-6 h-6" />,
    media: { type: "image", src: `${SCENE_MEDIA_BASE}/数字存档.png` },
  },
  {
    category: "业务场景",
    title: "云上营销",
    videoTitle: "商业空间云上展示演示",
    desc: "用于商业空间在线展示、远程看房、招商演示与空间价值表达，让客户无需到场即可直观了解空间结构、场景氛围与商业价值。",
    tags: ["线上展示", "招商演示", "商业空间"],
    isEmbodied: false,
    gradientFrom: "from-slate-800/60",
    gradientTo: "to-gray-900/60",
    icon: <Home className="w-6 h-6" />,
    media: { type: "video", src: "https://shujingspace.oss-cn-shenzhen.aliyuncs.com/shujing-space/media/%E9%A6%96%E9%A1%B5_%E4%B8%9A%E5%8A%A1%E6%A8%A1%E5%9D%97%E7%9A%84%E5%B0%81%E9%9D%A2/%E5%BC%B9%E7%AA%97%E6%A8%A1%E5%9D%97%E7%B4%A0%E6%9D%90/%E4%BA%91%E4%B8%8A%E8%90%A5%E9%94%80.mp4" },
  },
  {
    category: "业务场景",
    title: "具身智能空间训练场景",
    videoTitle: "具身智能训练场景演示",
    desc: "基于真实三维空间构建训练场景，为机器人感知、导航、交互、任务理解与空间推理提供空间数据支持。",
    tags: ["机器人训练", "场景理解", "空间智能"],
    isEmbodied: true,
    gradientFrom: "from-violet-900/40",
    gradientTo: "to-slate-900/60",
    icon: <Brain className="w-6 h-6" />,
    media: { type: "image", src: `${SCENE_MEDIA_BASE}/具身智能空间训练平台.png` },
  },
];

// scenarios：业务场景列表区展示数据（点击时按 title 匹配 scenarioCards 打开弹窗）
export const scenarios = [
  {
    icon: <Building2 className="w-5 h-5" />,
    title: "工程改造",
    desc: "用于建筑复核、空间测量、改造预演与工程数据管理。",
    tags: ["工程复核", "改造预演", "BIM 接入"],
  },
  {
    icon: <Mountain className="w-5 h-5" />,
    title: "数字文旅",
    desc: "用于景区数字化、线上导览、沉浸式展示与文化空间传播。",
    tags: ["线上导览", "沉浸展示", "文旅数字化"],
  },
  {
    icon: <Camera className="w-5 h-5" />,
    title: "游戏影视",
    desc: "为虚拟制作、影视场景与游戏资产提供真实空间数据基础。",
    tags: ["真实场景", "虚拟制作", "数字资产"],
  },
  {
    icon: <Archive className="w-5 h-5" />,
    title: "数字存档",
    desc: "用于历史建筑、工业遗产、城市空间与重要场景的长期数字化保存。",
    tags: ["历史建筑", "空间存档", "实景重建"],
  },
  {
    icon: <Home className="w-5 h-5" />,
    title: "云上营销",
    desc: "用于商业空间在线展示、远程看房、招商演示与空间价值表达。",
    tags: ["线上展示", "招商演示", "商业空间"],
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: "具身智能空间训练场景",
    desc: "基于真实三维空间构建训练场景，为机器人感知、导航、交互与任务理解提供空间数据支持。",
    tags: ["机器人训练", "场景理解", "空间智能"],
  },
];
