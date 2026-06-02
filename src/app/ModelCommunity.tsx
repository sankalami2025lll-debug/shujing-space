/**
 * 页面名称：模型社区入口页 ModelCommunity
 * 页面用途：模型社区的宣传入口页（非完整模型库），解释社区定位、展示数据资产类型与精选模型，引导进入模型库与联系数据服务
 * 主要功能：Hero 定位、数据类型展示、精选模型（前 6 个）点击进详情、服务能力展示、CTA 转化、Footer
 * 对应文档：页面功能注释文档/04_模型社区入口页_ModelCommunity.md、页面功能注释文档/13_模型数据结构_communityData.md
 */
import {
  ArrowRight,
  Layers,
  Globe,
  Box,
  Brain,
  Network,
  Scan,
  Eye,
  Heart,
  User,
  Cpu,
} from "lucide-react";
import { useEffect, useState } from "react";
import NavBar from "./NavBar";
import heroBg from "../imports/____.png";
import logoSrc from "../imports/____logo_1_.png";
import { communityModels, typeTagColor } from "./communityData";
import { useSiteConfig } from "./SiteConfigContext";
import { getModels } from "../lib/api/models";
import { coverStyleByType, formatViews } from "../lib/format";
import type { ModelListItem } from "../lib/types";

interface ModelCommunityProps {
  onNavigateHome: () => void;
  onNavigateAbout?: () => void;
  onNavigateModels?: (modelId?: number) => void;
  onNavigateContact?: () => void;
  onNavigateAuth?: () => void;
}

// FeaturedCard：精选模型卡片的统一展示结构，兼容后端 ModelListItem 与本地 communityData 兜底数据。
//   color/pattern 为封面视觉（后端不返回，按 type 推导）；views 为展示文案；likes 为点赞数。
interface FeaturedCard {
  id: number;
  title: string;
  type: string;
  tags: string[];
  author: string;
  color: string;
  pattern: string;
  views: string;
  likes: number;
}

// FALLBACK_FEATURED：接口异常 / 后端无数据时的兜底精选模型（取自本地静态 communityData 前 6 个，作验收基准）
const FALLBACK_FEATURED: FeaturedCard[] = communityModels.slice(0, 6).map((m) => ({
  id: m.id,
  title: m.title,
  type: m.type,
  tags: m.tags,
  author: m.author,
  color: m.color,
  pattern: m.pattern,
  views: m.views,
  likes: m.likes,
}));

// mapModelToFeatured：后端模型列表项 → 精选卡片；补回后端不返回的封面视觉与浏览量展示格式。
function mapModelToFeatured(m: ModelListItem): FeaturedCard {
  const cover = coverStyleByType(m.type, m.id);
  return {
    id: m.id,
    title: m.title,
    type: m.type,
    tags: Array.isArray(m.tags) ? m.tags : [],
    author: m.author,
    color: cover.color,
    pattern: cover.pattern,
    views: formatViews(m.viewsCount),
    likes: m.likesCount,
  };
}

// dataTypes：社区支持的真实空间数据类型展示配置（实景三维 / BIM / 构件级 / 具身智能空间训练）
const dataTypes = [
  {
    icon: <Globe className="w-5 h-5" />,
    title: "实景三维模型",
    desc: "基于真实空间重建生成高真实感三维场景，适用于线上展示、数字文旅、云上营销与空间存档。",
    tags: ["实景空间", "在线展示", "沉浸浏览"],
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: "BIM 模型",
    desc: "承载建筑、结构、机电等工程信息，适用于工程改造、空间管理、运维接入与数字孪生平台建设。",
    tags: ["建筑数据", "工程管理", "运维接入"],
  },
  {
    icon: <Box className="w-5 h-5" />,
    title: "构件级模型",
    desc: "面向建筑构件、空间部件与设备对象，提供更细颗粒度的三维模型数据，支持资产管理与场景搭建。",
    tags: ["构件资产", "设备对象", "精细建模"],
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: "具身智能空间训练模型",
    desc: "基于真实世界空间结构构建训练场景，为机器人感知、导航、交互与任务理解提供三维数据基础。",
    tags: ["空间训练", "机器人感知", "场景理解"],
  },
];


// services：围绕模型数据的服务能力展示配置（正式开发可对应 /api/community/services）
const services = [
  {
    icon: <Scan className="w-4 h-4" />,
    title: "实景重建",
    desc: "结合 3DGS、倾斜摄影、实景 VR 等技术路线，构建高真实感三维空间表达。",
    tags: ["3DGS", "倾斜摄影", "实景 VR"],
  },
  {
    icon: <Layers className="w-4 h-4" />,
    title: "BIM 模型处理",
    desc: "支持建筑、结构、机电等工程模型处理，服务工程改造、空间管理与运维应用。",
    tags: ["BIM", "工程模型", "运维接入"],
  },
  {
    icon: <Cpu className="w-4 h-4" />,
    title: "构件级模型处理",
    desc: "面向建筑构件、空间部件与设备对象，提供精细化模型处理与资产组织能力。",
    tags: ["构件资产", "设备对象", "精细建模"],
  },
  {
    icon: <Network className="w-4 h-4" />,
    title: "数字孪生平台接入",
    desc: "支持三维空间数据接入数字孪生管理系统，服务业务管理、空间运维与场景可视化。",
    tags: ["数字孪生", "平台接入", "可视化管理"],
  },
  {
    icon: <Brain className="w-4 h-4" />,
    title: "具身智能空间训练数据处理",
    desc: "围绕真实空间结构、环境布局与交互对象，构建可用于具身智能训练的空间场景数据。",
    tags: ["空间训练", "机器人感知", "场景理解"],
  },
];


// SpaceVisual：服务区左侧的三维空间装饰图（纯视觉 SVG，无交互）
function SpaceVisual() {
  return (
    <div className="relative w-full h-full min-h-[420px] rounded-[22px] border border-white/10 overflow-hidden bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-950">
      <div className="absolute inset-0 opacity-[0.14]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 38%, rgba(96,165,250,0.09) 0%, transparent 65%)" }} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 460" fill="none" preserveAspectRatio="xMidYMid meet">
        <g stroke="rgba(255,255,255,0.15)" strokeWidth="0.7">
          <rect x="90" y="140" width="70" height="155" />
          <line x1="90" y1="140" x2="72" y2="124" />
          <line x1="160" y1="140" x2="142" y2="124" />
          <line x1="160" y1="295" x2="142" y2="279" />
          <line x1="90" y1="295" x2="72" y2="279" />
          <rect x="72" y="124" width="70" height="155" />
          <rect x="200" y="90" width="70" height="205" />
          <line x1="200" y1="90" x2="182" y2="74" />
          <line x1="270" y1="90" x2="252" y2="74" />
          <rect x="182" y="74" width="70" height="205" />
        </g>
        <g stroke="rgba(96,165,250,0.45)" strokeWidth="0.9">
          <line x1="72" y1="124" x2="182" y2="74" />
          <line x1="142" y1="124" x2="252" y2="74" />
        </g>
        <g stroke="rgba(96,165,250,0.35)" strokeWidth="0.8" strokeDasharray="4 4">
          <line x1="72" y1="279" x2="182" y2="279" />
          <line x1="72" y1="279" x2="72" y2="295" />
        </g>
        <circle cx="182" cy="74" r="2.5" fill="rgba(96,165,250,0.6)" />
        <circle cx="252" cy="74" r="2.5" fill="rgba(96,165,250,0.6)" />
        <circle cx="142" cy="124" r="2" fill="rgba(255,255,255,0.3)" />
        <g stroke="rgba(96,165,250,0.25)" strokeWidth="0.6">
          <polyline points="30,400 75,385 125,389 175,380 225,383 275,376 320,380 348,373" />
        </g>
        <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.5">
          <line x1="30" y1="360" x2="330" y2="360" />
          <line x1="30" y1="380" x2="330" y2="380" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
        <span className="text-[11px] text-gray-600 tracking-wider">三维空间数字化</span>
        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-px rounded-full" style={{
              width: `${14 + i * 5}px`,
              background: i < 3 ? "rgba(96,165,250,0.45)" : "rgba(255,255,255,0.08)",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ServiceCard：服务卡片，移动端单列与桌面端网格共用
function ServiceCard({ svc }: { svc: typeof services[0] }) {
  return (
    <div className="group flex flex-col gap-3 p-5 rounded-[16px] border border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] transition-all duration-200 h-full">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-cyan-400/60 group-hover:text-cyan-400/90 transition-colors">
          {svc.icon}
        </div>
        <h4 className="text-[14px] font-semibold text-white leading-tight">{svc.title}</h4>
      </div>
      <p className="text-[13px] text-gray-500 leading-relaxed">{svc.desc}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {svc.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-gray-500">{tag}</span>
        ))}
      </div>
    </div>
  );
}

export default function ModelCommunity({ onNavigateHome, onNavigateAbout, onNavigateModels, onNavigateContact, onNavigateAuth }: ModelCommunityProps) {
  // 站点配置：Footer 联系方式 / 公司名 / 版权 / 备案号来自后端（默认值兜底）
  const { config } = useSiteConfig();

  // featured：精选模型列表，初始用本地兜底数据，挂载后从 GET /api/models 替换为真实数据
  const [featured, setFeatured] = useState<FeaturedCard[]>(FALLBACK_FEATURED);

  // 精选模型加载：调用 GET /api/models?page=1&pageSize=6&sort=recommended；
  //   成功且有数据则替换，异常 / 空数据静默保留本地兜底，不打断页面、不弹错。
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getModels({ page: 1, pageSize: 6, sort: "recommended" });
        if (active && res?.list?.length) {
          setFeatured(res.list.map(mapModelToFeatured));
        }
      } catch {
        // 接口异常时回退本地静态精选数据（FALLBACK_FEATURED），保证社区页可正常展示
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

      <NavBar
        activePage="community"
        onNavigateHome={onNavigateHome}
        onNavigateCommunity={() => {}}
        onNavigateAbout={onNavigateAbout ?? (() => {})}
        onNavigateContact={onNavigateContact}
        onNavigateAuth={onNavigateAuth}
      />

      {/* Hero：模型社区入口页首屏，重点解释真实三维空间数据资产库定位 */}
      <section className="relative h-screen flex items-center overflow-hidden pt-16 md:pt-[72px]">
        <div className="absolute inset-0">
          <img src={heroBg} alt="模型社区" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/50" />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
        </div>
        <div className="relative max-w-[1440px] mx-auto px-5 md:px-24 w-full py-14 md:py-24">
          <div className="max-w-[600px]">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 text-[13px] text-gray-300 mb-6 md:mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              模型社区
            </div>
            <h1 className="text-[36px] md:text-[64px] font-bold leading-[1.15] md:leading-[1.1] mb-4 md:mb-5 tracking-tight">
              真实三维空间<br />数据资产库
            </h1>
            <p className="text-[16px] md:text-[18px] font-medium text-gray-200 mb-3 md:mb-4 leading-snug">
              汇聚实景三维、BIM、构件级模型等多类型空间数据资源
            </p>
            <p className="text-[14px] md:text-[16px] text-gray-400 leading-relaxed mb-8 md:mb-10 max-w-[520px]">
              面向数字孪生、工程改造、数字文旅、游戏影视、数字存档、云上营销与具身智能空间训练等场景，提供高质量三维空间数据服务。
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              {/* 浏览模型：不带 modelId 进入模型库列表页（用箭头函数避免把鼠标事件当作 modelId 传入） */}
              <button onClick={() => onNavigateModels?.()} className="px-8 py-3.5 rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-2">
                浏览模型
                <ArrowRight className="w-4 h-4" />
              </button>
              {/* 联系数据服务：跳转联系页 */}
              <button onClick={onNavigateContact} className="px-8 py-3.5 rounded-full border border-white/25 text-white text-[15px] hover:bg-white/5 transition-all text-center">
                联系数据服务
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Data Types：展示社区支持的模型数据类型 */}
      <section className="relative py-16 md:py-32 bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-[26px] md:text-[40px] font-bold mb-3 md:mb-4">真实空间数据资产</h2>
            <p className="text-[14px] md:text-[16px] text-gray-400 max-w-2xl mx-auto leading-relaxed">
              覆盖多类型三维空间数据，为模型展示、平台接入、数字孪生与具身智能训练提供数据基础
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {dataTypes.map((item) => (
              <div key={item.title} className="group relative bg-white/[0.03] backdrop-blur-sm rounded-[22px] border border-white/10 p-6 md:p-7 hover:border-cyan-500/25 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-cyan-400/80 mb-4 md:mb-5">
                  {item.icon}
                </div>
                <h3 className="text-[16px] md:text-[17px] font-semibold mb-2 md:mb-3">{item.title}</h3>
                <p className="text-[13px] md:text-[14px] text-gray-400 leading-relaxed mb-4 md:mb-5">{item.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-white/5 text-[11px] md:text-[12px] text-gray-400 border border-white/[0.08]">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Model Gallery：展示精选模型，点击卡片或「查看全部」进入模型库 */}
      <section className="relative py-10 md:py-14 bg-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="flex items-end justify-between mb-5 md:mb-6">
            <div>
              <h2 className="text-[22px] md:text-[32px] font-bold mb-1">精选模型</h2>
              <p className="text-[13px] md:text-[14px] text-gray-400">
                来自模型社区的真实三维空间数据
              </p>
            </div>
            {/* 查看全部：不带 modelId 进入模型库列表页 */}
            <button
              onClick={() => onNavigateModels?.()}
              className="flex-shrink-0 flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-white transition-colors"
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 模型卡片：与模型库卡片风格保持一致；数据来自 GET /api/models（异常回退本地）；点击携带 model.id 跳转，由模型库直接打开对应详情 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {featured.map((model) => (
              <button
                key={model.id}
                onClick={() => onNavigateModels?.(model.id)}
                className="group relative bg-white/[0.03] rounded-[16px] border border-white/10 overflow-hidden hover:border-white/20 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.10)] transition-all duration-300 text-left"
              >
                {/* Cover */}
                <div className={`relative h-[140px] md:aspect-[16/7] md:h-auto bg-gradient-to-br ${model.color} overflow-hidden`}>
                  {model.pattern === "grid" && (
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
                      backgroundSize: "28px 28px",
                    }} />
                  )}
                  {model.pattern === "lines" && (
                    <div className="absolute inset-0 opacity-15" style={{
                      backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 1px, transparent 0, transparent 50%)",
                      backgroundSize: "18px 18px",
                    }} />
                  )}
                  {model.pattern === "dots" && (
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                    }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Type tag */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${typeTagColor[model.type] || "bg-white/10 text-white/60 border-white/10"}`}>
                      {model.type}
                    </span>
                  </div>
                  {/* Bottom decorative lines */}
                  <div className="absolute bottom-3 left-3 flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-0.5 rounded-full bg-cyan-400/30" style={{ width: `${20 + i * 6}px` }} />
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div className="p-3 md:p-4">
                  <h3 className="text-[13px] md:text-[15px] font-semibold mb-1.5 line-clamp-1">{model.title}</h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {model.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.08] text-[11px] text-gray-400">{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                      <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-2.5 h-2.5" />
                      </div>
                      <span className="truncate max-w-[90px]">{model.author}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] text-gray-500">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{model.views}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{model.likes}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services：展示围绕模型数据的服务能力 */}
      <section className="relative py-16 md:py-20 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          {/* Header */}
          <div className="mb-8 md:mb-10">
            <h2 className="text-[26px] md:text-[38px] font-bold mb-3 leading-tight">我们提供的不只是模型</h2>
            <p className="text-[14px] md:text-[15px] text-gray-400 leading-relaxed max-w-[640px]">
              从实景重建到模型展示，再到平台接入与训练数据处理，构建完整的三维空间数据服务能力。
            </p>
          </div>

          {/* Mobile: single column list */}
          <div className="flex flex-col gap-3 md:hidden">
            {services.map(svc => <ServiceCard key={svc.title} svc={svc} />)}
          </div>

          {/* Desktop: left visual 42% + right 58% with 2+2+1 grid */}
          <div className="hidden md:flex gap-8 items-stretch">
            {/* Left visual */}
            <div className="flex-shrink-0" style={{ width: "42%" }}>
              <SpaceVisual />
            </div>

            {/* Right cards */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 flex-1">
                {services.slice(0, 2).map((svc) => (
                  <ServiceCard key={svc.title} svc={svc} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 flex-1">
                {services.slice(2, 4).map((svc) => (
                  <ServiceCard key={svc.title} svc={svc} />
                ))}
              </div>
              <div className="flex-1">
                {services.slice(4).map((svc) => (
                  <div key={svc.title} className="group flex items-center gap-6 p-5 rounded-[16px] border border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] transition-all duration-200 h-full">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-cyan-400/60 group-hover:text-cyan-400/90 transition-colors">
                      {svc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-semibold text-white mb-1">{svc.title}</h4>
                      <p className="text-[13px] text-gray-500 leading-relaxed">{svc.desc}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                      {svc.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-gray-500 whitespace-nowrap">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA：底部转化区域，引导用户进入联系页咨询定制数据服务 */}
      <section className="relative py-12 md:py-24 bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="relative rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-8 md:p-16 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-[0.035]" style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.6) 1px, transparent 0)",
              backgroundSize: "36px 36px",
            }} />
            <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-slate-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-[24px] md:text-[44px] font-bold mb-4 leading-tight">需要定制真实三维空间数据？</h2>
              <p className="text-[14px] md:text-[17px] text-gray-400 mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
                我们可以根据业务场景提供实景重建、BIM 模型处理、构件级模型、云端展示、数字孪生接入与具身智能空间训练数据服务。
              </p>
              {/* 点击「联系我们」跳转到联系页，咨询定制三维空间数据服务 */}
              <button onClick={onNavigateContact} className="px-10 py-3.5 md:py-4 rounded-full bg-white text-black text-[15px] md:text-[16px] font-semibold hover:bg-gray-100 transition-all inline-flex items-center gap-2">
                联系我们
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer：底部信息区，包含 Logo、公司名称、联系方式占位与站内导航链接 */}
      <footer className="relative bg-black border-t border-white/10 py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-10 md:mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4 md:mb-5">
                <img src={logoSrc} alt="数境空间" className="h-7 w-auto object-contain" style={{ mixBlendMode: "screen" }} />
                <span className="text-[18px] font-medium">数境空间</span>
              </div>
              <p className="text-[14px] text-gray-500">{config.companyName}</p>
            </div>
            <div>
              <h4 className="text-[15px] font-semibold mb-4 md:mb-5">联系方式</h4>
              {/* 联系方式来自站点配置（GET /api/site-config）；接口异常时回退默认占位「请填写」 */}
              <div className="space-y-2 md:space-y-2.5 text-[14px] text-gray-500">
                <p>电话：{config.phone}</p>
                <p>邮箱：{config.email}</p>
                <p>地址：{config.address}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[15px] font-semibold mb-4 md:mb-5">导航</h4>
              <div className="space-y-2 md:space-y-2.5 text-[14px]">
                <button onClick={onNavigateHome} className="block text-gray-500 hover:text-white transition-colors">首页</button>
                <span className="block text-gray-300">模型社区</span>
                <button onClick={onNavigateAbout} className="block text-gray-500 hover:text-white transition-colors">关于我们</button>
              </div>
            </div>
          </div>
          <div className="pt-6 md:pt-8 border-t border-white/[0.08] text-center">
            <p className="text-[12px] md:text-[13px] text-gray-600">{config.footerText}</p>
            {/* 备案号：站点配置存在 icp 时才渲染，默认空值不显示 */}
            {config.icp && <p className="mt-2 text-[12px] md:text-[13px] text-gray-600">{config.icp}</p>}
          </div>
        </div>
      </footer>

    </div>
  );
}
