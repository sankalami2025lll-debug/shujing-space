"use client";

/**
 * 页面名称：模型社区入口页 ModelCommunity
 * 页面用途：模型社区宣传入口（非完整模型库），展示数据类型、精选模型与服务能力，引导进入模型库与联系数据服务
 * 主要功能：Hero、数据类型、精选模型（GET /api/models 推荐 6 条）、服务能力、CTA、Footer
 * 对应文档：页面功能注释文档/04_模型社区入口页_ModelCommunity.md、页面功能注释文档/13_模型数据结构_communityData.md
 * 说明：全站 NavBar 由 layout SiteChrome 挂载；精选模型点击跳转 /models/[id]。
 *        服务能力区左侧图片轮播绑定 services 数组索引，点击服务卡片切换到对应图片。
 */
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
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
  Search,
} from "lucide-react";
import { useSiteConfig } from "@/components/providers/site-config-provider";
import { getModels } from "@/lib/api/models";
import { coverStyleByType, formatViews } from "@/lib/format";
import { typeTagColor } from "@/lib/community-data";
import type { ModelListItem } from "@/lib/types";

// FeaturedCard：精选模型卡片展示结构（由后端列表项映射而来）
interface FeaturedCard {
  id: number;
  title: string;
  type: string;
  tags: string[];
  author: string;
  coverUrl: string;
  color: string;
  pattern: string;
  views: string;
  likes: number;
}

// mapModelToFeatured：后端 ModelListItem → 精选卡片（补封面视觉与浏览量格式）
function mapModelToFeatured(m: ModelListItem): FeaturedCard {
  const cover = coverStyleByType(m.type, m.id);
  return {
    id: m.id,
    title: m.title,
    type: m.type,
    tags: Array.isArray(m.tags) ? m.tags : [],
    author: m.author,
    coverUrl: m.coverUrl,
    color: cover.color,
    pattern: cover.pattern,
    views: formatViews(m.viewsCount),
    likes: m.likesCount,
  };
}

function FeaturedModelCard({ model }: { model: FeaturedCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(model.coverUrl) && !imgFailed;

  return (
    <Link
      href={`/models/${model.id}`}
      className="group relative bg-white/[0.03] rounded-[16px] border border-white/10 overflow-hidden hover:border-white/20 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.10)] transition-all duration-300 text-left block"
    >
      <div
        className={`relative h-[140px] md:aspect-[16/7] md:h-auto bg-gradient-to-br ${model.color} overflow-hidden`}
      >
        {showImage ? (
          <img
            src={model.coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : null}
        {!showImage && model.pattern === "grid" && (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        )}
        {!showImage && model.pattern === "lines" && (
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 1px, transparent 0, transparent 50%)",
              backgroundSize: "18px 18px",
            }}
          />
        )}
        {!showImage && model.pattern === "dots" && (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-2.5 left-2.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] border ${typeTagColor[model.type] || "bg-white/10 text-white/60 border-white/10"}`}
          >
            {model.type}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-0.5 rounded-full bg-cyan-400/30"
              style={{ width: `${20 + i * 6}px` }}
            />
          ))}
        </div>
      </div>
      <div className="p-3 md:p-4">
        <h3 className="text-[13px] md:text-[15px] font-semibold mb-1.5 line-clamp-1">
          {model.title}
        </h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {model.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.08] text-[11px] text-gray-400"
            >
              {tag}
            </span>
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
            <span className="flex items-center gap-0.5">
              <Eye className="w-3 h-3" />
              {model.views}
            </span>
            <span className="flex items-center gap-0.5">
              <Heart className="w-3 h-3" />
              {model.likes}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// dataTypes：社区支持的真实空间数据类型展示配置
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

// services：服务能力展示；桌面端 2+2+1 布局中 slice(2,4) 为「构件级+数字孪生平台接入」，slice(4) 为「具身智能空间训练数据处理」（顺序与 Vite 修复后一致）
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

/**
 * ServiceImageCarousel：服务能力区左侧图片展示组件
 * 功能：未点击时自动轮播 5 张服务模块图；点击某服务卡片后锁定对应图片；点击其他服务切换到新图片。
 * 图片路径：/模型社区_我们提供的不只是模型/{文件名}
 * 图片索引与 services 数组一一对应
 */
const IMAGE_BASE = "/模型社区_我们提供的不只是模型";
const IMAGE_FILES = [
  "实景重建.png",              // index 0 → services[0] 实景重建
  "BIM 模型处理.png",          // index 1 → services[1] BIM 模型处理
  "构件级模型处理.png",        // index 2 → services[2] 构件级模型处理
  "数字孪生平台接入.png",      // index 3 → services[3] 数字孪生平台接入
  "具身智能空间训练数据处理.png", // index 4 → services[4] 具身智能空间训练数据处理
];

function ServiceImageCarousel({
  activeIndex,
}: {
  activeIndex: number | null;
}) {
  // currentIndex：实际显示的图片下标，activeIndex 优先，否则走自动轮播
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 清理轮播定时器
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 启动自动轮播（每 4 秒切换）
  const startAutoPlay = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGE_FILES.length);
    }, 4000);
  }, [clearTimer]);

  // 用户点击服务卡片时，锁定显示并停止自动轮播
  useEffect(() => {
    if (activeIndex !== null) {
      clearTimer();
      setCurrentIndex(activeIndex);
    } else {
      // activeIndex 为 null 时恢复自动轮播
      startAutoPlay();
    }
    return clearTimer;
  }, [activeIndex, clearTimer, startAutoPlay]);

  // 图片切换时重置错误状态
  useEffect(() => {
    setImgFailed(false);
  }, [currentIndex]);

  const src = `${IMAGE_BASE}/${IMAGE_FILES[currentIndex]}`;

  // 深色占位背景（加载失败时显示）
  if (imgFailed) {
    return (
      <div className="relative w-full h-full min-h-[420px] rounded-[22px] border border-white/10 overflow-hidden bg-zinc-900 flex items-center justify-center">
        <span className="text-gray-600 text-[13px]">图片加载失败</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-[22px] border border-white/10 overflow-hidden bg-zinc-900">
      <img
        key={src}
        src={src}
        alt={IMAGE_FILES[currentIndex].replace(".png", "")}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        onError={() => setImgFailed(true)}
      />
      {/* 轻微暗角，不挡住主体 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />
      {/* 底部指示器 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {IMAGE_FILES.map((_, i) => (
          <span
            key={i}
            className={`block rounded-full transition-all duration-300 ${
              i === currentIndex
                ? "w-5 h-1.5 bg-white/70"
                : "w-1.5 h-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceCard({
  svc,
  onClick,
  isActive,
}: {
  svc: (typeof services)[0];
  onClick?: () => void;
  isActive?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex flex-col gap-3 p-5 rounded-[16px] border transition-all duration-200 h-full cursor-pointer ${
        isActive
          ? "border-cyan-500/40 bg-white/[0.06]"
          : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-cyan-400/60 group-hover:text-cyan-400/90 transition-colors">
          {svc.icon}
        </div>
        <h4 className="text-[14px] font-semibold text-white leading-tight">{svc.title}</h4>
      </div>
      <p className="text-[13px] text-gray-500 leading-relaxed">{svc.desc}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {svc.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-gray-500"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ModelCommunityPage() {
  const { config } = useSiteConfig();
  // featured：精选模型，仅来自 GET /api/models
  const [featured, setFeatured] = useState<FeaturedCard[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  // activeServiceIndex：服务能力区当前选中的模块索引，null 表示自动轮播
  const [activeServiceIndex, setActiveServiceIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getModels({
          page: 1,
          pageSize: 6,
          sort: "recommended",
        });
        if (active) {
          setFeatured((res?.list ?? []).map(mapModelToFeatured));
        }
      } catch {
        if (active) {
          setFeatured([]);
        }
      } finally {
        if (active) {
          setFeaturedLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden -mt-16 md:-mt-[72px]">
      {/* Hero：模型社区入口首屏 */}
      <section className="relative h-screen flex items-center overflow-hidden pt-16 md:pt-[72px]">
        <div className="absolute inset-0">
          <img
            src="/community-hero.png"
            alt="模型社区"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/50" />
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>
        <div className="relative max-w-[1440px] mx-auto px-5 md:px-24 w-full py-14 md:py-24">
          <div className="max-w-[600px]">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 text-[13px] text-gray-300 mb-6 md:mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              模型社区
            </div>
            <h1 className="text-[36px] md:text-[64px] font-bold leading-[1.15] md:leading-[1.1] mb-4 md:mb-5 tracking-tight">
              真实三维空间
              <br />
              数据资产库
            </h1>
            <p className="text-[16px] md:text-[18px] font-medium text-gray-200 mb-3 md:mb-4 leading-snug">
              汇聚实景三维、BIM、构件级模型等多类型空间数据资源
            </p>
            <p className="text-[14px] md:text-[16px] text-gray-400 leading-relaxed mb-8 md:mb-10 max-w-[520px]">
              面向数字孪生、工程改造、数字文旅、游戏影视、数字存档、云上营销与具身智能空间训练等场景，提供高质量三维空间数据服务。
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Link
                href="/models"
                className="px-8 py-3.5 rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              >
                浏览模型
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="px-8 py-3.5 rounded-full border border-white/25 text-white text-[15px] hover:bg-white/5 transition-all text-center"
              >
                联系数据服务
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Data Types：真实空间数据资产类型 */}
      <section className="relative py-16 md:py-32 bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-[26px] md:text-[40px] font-bold mb-3 md:mb-4">
              真实空间数据资产
            </h2>
            <p className="text-[14px] md:text-[16px] text-gray-400 max-w-2xl mx-auto leading-relaxed">
              覆盖多类型三维空间数据，为模型展示、平台接入、数字孪生与具身智能训练提供数据基础
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {dataTypes.map((item) => (
              <div
                key={item.title}
                className="group relative bg-white/[0.03] backdrop-blur-sm rounded-[22px] border border-white/10 p-6 md:p-7 hover:border-cyan-500/25 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-cyan-400/80 mb-4 md:mb-5">
                  {item.icon}
                </div>
                <h3 className="text-[16px] md:text-[17px] font-semibold mb-2 md:mb-3">
                  {item.title}
                </h3>
                <p className="text-[13px] md:text-[14px] text-gray-400 leading-relaxed mb-4 md:mb-5">
                  {item.desc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-white/5 text-[11px] md:text-[12px] text-gray-400 border border-white/[0.08]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Model Gallery：精选模型 */}
      <section className="relative py-10 md:py-14 bg-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="flex items-end justify-between mb-5 md:mb-6">
            <div>
              <h2 className="text-[22px] md:text-[32px] font-bold mb-1">精选模型</h2>
              <p className="text-[13px] md:text-[14px] text-gray-400">
                来自模型社区的真实三维空间数据
              </p>
            </div>
            <Link
              href="/models"
              className="flex-shrink-0 flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-white transition-colors"
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {featuredLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-white/[0.03] rounded-[16px] border border-white/10 overflow-hidden animate-pulse"
                >
                  <div className="h-[140px] md:aspect-[16/7] md:h-auto bg-white/5" />
                  <div className="p-3 md:p-4 space-y-2">
                    <div className="h-4 bg-white/5 rounded" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center text-gray-400">
              <Search className="mx-auto mb-4 h-10 w-10 opacity-30" />
              <p className="text-[15px] text-gray-300">暂无模型，欢迎上传发布第一个模型</p>
              <p className="mt-2 text-[13px] text-gray-500">
                当前精选区仅展示 /api/models 返回的真实模型数据。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {featured.map((model) => (
                <FeaturedModelCard key={model.id} model={model} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Services：我们提供的不只是模型（桌面 2+2+1，底部整行为具身智能空间训练数据处理） */}
      <section className="relative py-16 md:py-20 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="mb-8 md:mb-10">
            <h2 className="text-[26px] md:text-[38px] font-bold mb-3 leading-tight">
              我们提供的不只是模型
            </h2>
            <p className="text-[14px] md:text-[15px] text-gray-400 leading-relaxed max-w-[640px]">
              从实景重建到模型展示，再到平台接入与训练数据处理，构建完整的三维空间数据服务能力。
            </p>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {services.map((svc, i) => (
              <ServiceCard
                key={svc.title}
                svc={svc}
                isActive={activeServiceIndex === i}
                onClick={() => setActiveServiceIndex(i)}
              />
            ))}
          </div>

          <div className="hidden md:flex gap-8 items-stretch">
            <div className="flex-shrink-0" style={{ width: "42%" }}>
              <ServiceImageCarousel activeIndex={activeServiceIndex} />
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 flex-1">
                {services.slice(0, 2).map((svc, i) => (
                  <ServiceCard
                    key={svc.title}
                    svc={svc}
                    isActive={activeServiceIndex === i}
                    onClick={() => setActiveServiceIndex(i)}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 flex-1">
                {services.slice(2, 4).map((svc, i) => (
                  <ServiceCard
                    key={svc.title}
                    svc={svc}
                    isActive={activeServiceIndex === i + 2}
                    onClick={() => setActiveServiceIndex(i + 2)}
                  />
                ))}
              </div>
              <div className="flex-1">
                {services.slice(4).map((svc, i) => (
                  <div
                    key={svc.title}
                    onClick={() => setActiveServiceIndex(i + 4)}
                    className={`group flex items-center gap-6 p-5 rounded-[16px] border transition-all duration-200 h-full cursor-pointer ${
                      activeServiceIndex === i + 4
                        ? "border-cyan-500/40 bg-white/[0.06]"
                        : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16]"
                    }`}
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-cyan-400/60 group-hover:text-cyan-400/90 transition-colors">
                      {svc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-semibold text-white mb-1">
                        {svc.title}
                      </h4>
                      <p className="text-[13px] text-gray-500 leading-relaxed">
                        {svc.desc}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                      {svc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-gray-500 whitespace-nowrap"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-12 md:py-24 bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="relative rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-8 md:p-16 text-center overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.6) 1px, transparent 0)",
                backgroundSize: "36px 36px",
              }}
            />
            <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-slate-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-[24px] md:text-[44px] font-bold mb-4 leading-tight">
                需要定制真实三维空间数据？
              </h2>
              <p className="text-[14px] md:text-[17px] text-gray-400 mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
                我们可以根据业务场景提供实景重建、BIM 模型处理、构件级模型、云端展示、数字孪生接入与具身智能空间训练数据服务。
              </p>
              <Link
                href="/contact"
                className="px-10 py-3.5 md:py-4 rounded-full bg-white text-black text-[15px] md:text-[16px] font-semibold hover:bg-gray-100 transition-all inline-flex items-center gap-2"
              >
                联系我们
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-black border-t border-white/10 py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-10 md:mb-12">
            <div>
              <div className="flex items-center mb-4 md:mb-5">
                <img
                  src="/loading/loading-logo-reference1.png"
                  alt="数境空间"
                  className="h-[57px] w-auto object-contain"
                />
              </div>
              <p className="text-[14px] text-gray-500">{config.companyName}</p>
            </div>
            <div>
              <h4 className="text-[15px] font-semibold mb-4 md:mb-5">联系方式</h4>
              <div className="space-y-2 md:space-y-2.5 text-[14px] text-gray-500">
                <p>电话：{config.phone}</p>
                <p>邮箱：{config.email}</p>
                <p>地址：{config.address}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[15px] font-semibold mb-4 md:mb-5">导航</h4>
              <div className="space-y-2 md:space-y-2.5 text-[14px]">
                <Link
                  href="/"
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  首页
                </Link>
                <span className="block text-gray-300">模型社区</span>
                <Link
                  href="/about"
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  关于我们
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-6 md:pt-8 border-t border-white/[0.08] text-center">
            <p className="text-[12px] md:text-[13px] text-gray-600">
              {config.footerText}
            </p>
            {config.icp && (
              <p className="mt-2 text-[12px] md:text-[13px] text-gray-600">
                {config.icp}
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

