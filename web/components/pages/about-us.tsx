"use client";

/**
 * 页面名称：关于我们 AboutUs
 * 页面用途：建立公司可信度，说明数境空间的公司定位、核心能力、服务场景与长期愿景
 * 主要功能：Hero 首屏、公司介绍、核心能力卡片、服务场景、愿景区、CTA 转化区、Footer
 * 对应文档：页面功能注释文档/10_关于我们_AboutUs.md
 * 说明：全站 NavBar 由 layout SiteChrome 挂载；本页不含 NavBar（对齐 Next 4A 架构）。
 */
import Link from "next/link";
import {
  ArrowRight,
  Box,
  Layers,
  Scan,
  Cloud,
  Building2,
  Mountain,
  Camera,
  Archive,
  Home,
  Brain,
  Cpu,
} from "lucide-react";
import { useSiteConfig } from "@/components/providers/site-config-provider";

// capabilities：核心能力卡片数据，正式项目可由 CMS / 后台站点配置接口返回
const capabilities = [
  {
    icon: <Box className="w-5 h-5" />,
    title: "三维空间数据处理",
    desc: "将建筑、园区、商业空间与文旅场景数据进行整理、优化、结构化与标准化处理。",
  },
  {
    icon: <Scan className="w-5 h-5" />,
    title: "实景重建",
    desc: "结合 3DGS、倾斜摄影、实景 VR 等技术路线，构建高真实感三维空间表达。",
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: "BIM 模型处理",
    desc: "支持建筑、结构、机电等工程模型处理，服务工程改造、空间管理与运维应用。",
  },
  {
    icon: <Cpu className="w-5 h-5" />,
    title: "构件级模型处理",
    desc: "面向建筑构件、空间部件与设备对象，提供精细化模型处理与资产组织能力。",
  },
  {
    icon: <Cloud className="w-5 h-5" />,
    title: "云端模型展示",
    desc: "让复杂三维空间模型可以在线浏览、远程展示、快速分享与业务演示。",
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: "具身智能空间训练数据处理",
    desc: "基于真实空间结构与场景关系，构建可用于机器人感知、导航与任务理解的训练数据。",
  },
];

// scenarios：服务场景列表，与首页业务场景保持一致，用于展示真实空间数据的应用方向
const scenarios = [
  {
    icon: <Building2 className="w-6 h-6" />,
    title: "工程改造",
    desc: "建筑复核、空间测量、改造预演与工程数据管理",
  },
  {
    icon: <Mountain className="w-6 h-6" />,
    title: "数字文旅",
    desc: "景区数字化、线上导览、沉浸式展示与文化空间传播",
  },
  {
    icon: <Camera className="w-6 h-6" />,
    title: "游戏影视",
    desc: "真实场景资产处理、虚拟制作与数字内容生产",
  },
  {
    icon: <Archive className="w-6 h-6" />,
    title: "数字存档",
    desc: "历史建筑、工业遗产与城市空间长期数字化保存",
  },
  {
    icon: <Home className="w-6 h-6" />,
    title: "云上营销",
    desc: "商业空间在线展示、远程看房、招商演示与空间价值表达",
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: "具身智能空间训练",
    desc: "面向机器人感知、导航、交互与任务理解的真实空间训练场景",
  },
];

// SpaceVisual：公司介绍区右侧的纯 SVG 三维空间示意插画（无交互，仅视觉装饰）
function SpaceVisual() {
  return (
    <div className="relative w-full aspect-[4/3] md:aspect-[4/5] rounded-[22px] border border-white/10 overflow-hidden bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-950">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(96,165,250,0.1) 0%, transparent 65%)",
        }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500" fill="none">
        <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.6">
          <rect x="100" y="160" width="80" height="180" />
          <rect x="220" y="100" width="80" height="240" />
          <line x1="100" y1="160" x2="80" y2="140" />
          <line x1="180" y1="160" x2="160" y2="140" />
          <line x1="180" y1="340" x2="160" y2="320" />
          <line x1="100" y1="340" x2="80" y2="320" />
          <rect x="80" y="140" width="80" height="180" />
          <line x1="220" y1="100" x2="200" y2="80" />
          <line x1="300" y1="100" x2="280" y2="80" />
          <rect x="200" y="80" width="80" height="240" />
        </g>
        <g stroke="rgba(96,165,250,0.5)" strokeWidth="0.8">
          <line x1="80" y1="140" x2="200" y2="80" />
          <line x1="160" y1="140" x2="280" y2="80" />
        </g>
        <g stroke="rgba(96,165,250,0.6)" strokeWidth="1">
          <polyline points="40,430 90,410 140,415 190,405 240,408 290,400 340,405 380,395" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
        <span className="text-[12px] text-gray-600">三维空间数字化</span>
        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-0.5 rounded-full"
              style={{
                width: `${16 + i * 6}px`,
                background: i < 3 ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// HeroRightVisual：Figma 导出时预留的 Hero 右侧三维线框插画组件。
// 当前 Hero 采用单列布局（grid-cols-1）未启用本组件，暂作设计预留保留，便于后续切换为左右双列布局时直接复用，请勿删除。
function HeroRightVisual() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-[280px] h-[240px] md:w-[380px] md:h-[340px]">
        <svg width="100%" height="100%" viewBox="0 0 380 340" fill="none">
          <g opacity="0.15" stroke="white" strokeWidth="0.5">
            <rect x="60" y="40" width="260" height="160" rx="4" />
            <line x1="60" y1="80" x2="320" y2="80" />
            <line x1="60" y1="120" x2="320" y2="120" />
            <line x1="60" y1="160" x2="320" y2="160" />
            <line x1="140" y1="40" x2="140" y2="200" />
            <line x1="220" y1="40" x2="220" y2="200" />
          </g>
          <g opacity="0.3" stroke="white" strokeWidth="0.6">
            <rect x="100" y="100" width="60" height="100" />
            <rect x="200" y="60" width="70" height="140" />
            <line x1="100" y1="100" x2="85" y2="85" />
            <line x1="160" y1="100" x2="145" y2="85" />
            <line x1="160" y1="200" x2="145" y2="185" />
            <line x1="100" y1="200" x2="85" y2="185" />
            <rect x="85" y="85" width="60" height="100" />
          </g>
          <g stroke="rgba(96,165,250,0.7)" strokeWidth="1">
            <polyline points="40,260 90,240 140,248 190,235 240,242 290,230 340,236" />
            <line x1="200" y1="60" x2="200" y2="20" strokeDasharray="3 3" />
            <circle cx="200" cy="16" r="3" fill="rgba(96,165,250,0.6)" stroke="none" />
          </g>
          <g fill="rgba(255,255,255,0.2)">
            {[
              [30, 150],
              [350, 80],
              [30, 280],
              [360, 260],
              [190, 290],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="2" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

// scrollToCoreCapabilities：Hero 主按钮平滑滚动到核心能力区锚点
function scrollToCoreCapabilities() {
  document.getElementById("core-capabilities")?.scrollIntoView({ behavior: "smooth" });
}

export default function AboutUsPage() {
  // 站点配置：Footer 联系方式 / 公司名 / 版权 / 备案号来自 SiteConfigProvider
  const { config } = useSiteConfig();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden -mt-16 md:-mt-[72px]">
      {/* Hero：负 margin 抵消 SiteChrome 顶距，pt-16 与 Vite 版全屏 Hero + 固定 NavBar 叠层一致 */}
      <section className="relative h-screen flex items-center overflow-hidden pt-16 md:pt-[72px]">
        <div className="absolute inset-0">
          <img
            src="/about-hero.png"
            alt="空间数据"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/55" />
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>
        <div className="relative max-w-[1440px] mx-auto px-5 md:px-24 w-full py-14 md:py-24">
          <div className="grid grid-cols-1 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 text-[13px] text-gray-300 mb-6 md:mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                关于我们
              </div>
              <h1 className="text-[36px] md:text-[62px] font-bold leading-[1.15] md:leading-[1.1] mb-4 md:mb-5 tracking-tight">
                让真实世界
                <br />
                进入数字空间
              </h1>
              <p className="text-[15px] md:text-[18px] font-medium text-gray-200 mb-3 md:mb-4 leading-snug">
                专注真实三维空间数据服务，构建连接现实空间与数字平台的数据底座。
              </p>
              <p className="text-[14px] md:text-[16px] text-gray-400 leading-relaxed mb-8 md:mb-10 max-w-[500px]">
                数境空间致力于将建筑、园区、商业空间与文旅场景转化为可展示、可管理、可拓展的三维空间数据资产。
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={scrollToCoreCapabilities}
                  className="px-8 py-3.5 rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                >
                  了解核心能力
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  href="/contact"
                  className="px-8 py-3.5 rounded-full border border-white/25 text-white text-[15px] hover:bg-white/5 transition-all text-center"
                >
                  联系我们
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company Intro */}
      <section className="relative py-16 md:py-32 bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <p className="text-[12px] md:text-[13px] text-gray-500 uppercase tracking-widest mb-3 md:mb-4 font-mono">
                关于数境空间
              </p>
              <h2 className="text-[26px] md:text-[38px] font-bold mb-2 md:mb-3 leading-tight">
                我们是谁
              </h2>
              <p className="text-[14px] md:text-[16px] text-gray-500 mb-6 md:mb-10 leading-relaxed">
                一家专注真实三维空间数据服务的科技公司
              </p>
              <div className="space-y-5 md:space-y-6 text-[14px] md:text-[16px] text-gray-400 leading-relaxed">
                <p>
                  数境空间（深圳）科技有限公司是一家专注
                  <strong className="text-white font-semibold">真实三维空间数据服务</strong>
                  的科技企业。
                </p>
                <p>
                  我们围绕建筑、园区、商业空间、文旅场景等真实空间对象，提供实景重建、BIM
                  模型处理、构件级模型、云端展示、数字孪生平台接入与具身智能空间训练数据服务。
                </p>
                <p>
                  通过 3DGS、倾斜摄影、实景 VR、BIM
                  与云端展示能力，服务于工程改造、数字文旅、游戏影视、数字存档、云上营销与具身智能空间训练等场景。
                </p>
              </div>
              <div className="mt-8 md:mt-10 flex flex-wrap gap-2">
                {[
                  "真实三维空间数据",
                  "数字孪生",
                  "实景三维",
                  "BIM",
                  "具身智能空间训练",
                  "云端轻量化展示",
                ].map((kw) => (
                  <span
                    key={kw}
                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[12px] md:text-[13px] text-gray-300"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <SpaceVisual />
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section id="core-capabilities" className="relative py-16 md:py-32 bg-[#0d0d0d]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-[26px] md:text-[40px] font-bold mb-3 md:mb-4">核心能力</h2>
            <p className="text-[14px] md:text-[16px] text-gray-400 max-w-2xl mx-auto leading-relaxed">
              围绕真实空间数据，提供从实景重建到平台接入的完整能力
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {capabilities.map((cap, i) => (
              <div
                key={cap.title}
                className="group relative bg-white/[0.03] backdrop-blur-sm rounded-[22px] border border-white/10 p-6 md:p-7 hover:border-cyan-500/20 hover:bg-white/[0.045] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4 md:mb-5">
                  <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-cyan-400/75 group-hover:text-cyan-400 transition-colors">
                    {cap.icon}
                  </div>
                  <span className="text-[12px] text-gray-600 font-mono">0{i + 1}</span>
                </div>
                <h3 className="text-[16px] md:text-[17px] font-semibold mb-2 md:mb-3">
                  {cap.title}
                </h3>
                <p className="text-[13px] md:text-[14px] text-gray-500 leading-relaxed">
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Scenarios */}
      <section className="relative py-16 md:py-32 bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-[26px] md:text-[40px] font-bold mb-3 md:mb-4">服务场景</h2>
            <p className="text-[14px] md:text-[16px] text-gray-400 max-w-2xl mx-auto leading-relaxed">
              真实三维空间数据可广泛应用于工程、文旅、影视、营销、运维与具身智能训练等场景
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
            {scenarios.map((s) => (
              <div
                key={s.title}
                className="group flex gap-4 md:gap-5 items-start p-5 md:p-6 rounded-[20px] border border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.035] transition-all duration-200"
              >
                <div className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-cyan-400/80 transition-colors">
                  {s.icon}
                </div>
                <div>
                  <h3 className="text-[16px] md:text-[17px] font-semibold mb-1.5 md:mb-2">
                    {s.title}
                  </h3>
                  <p className="text-[13px] md:text-[14px] text-gray-500 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="relative py-20 md:py-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0c0c0c] to-[#0a0a0a]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.6) 1px, transparent 0)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full bg-cyan-500/[0.04] blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="relative max-w-[1200px] mx-auto px-5 md:px-6 text-center">
          <p className="text-[12px] md:text-[13px] text-gray-600 uppercase tracking-widest font-mono mb-5 md:mb-6">
            我们的愿景
          </p>
          <h2 className="text-[30px] md:text-[56px] font-bold leading-tight mb-5 md:mb-6 tracking-tight">
            构建真实世界的空间数据底座
          </h2>
          <p className="text-[15px] md:text-[18px] text-gray-400 mb-12 md:mb-20 max-w-2xl mx-auto leading-relaxed">
            让三维空间数据成为数字孪生、空间智能与具身智能应用的重要基础能力。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-0 md:bg-white/[0.08] md:rounded-[20px] md:overflow-hidden">
            {[
              { label: "真实空间数据化", sub: "将物理世界精准映射为数字资产" },
              { label: "空间资产可拓展", sub: "一次处理，多场景持续拓展" },
              { label: "智能应用可连接", sub: "开放接入，驱动具身智能与数字业务" },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[#0c0c0c] border border-white/[0.08] md:border-0 rounded-[16px] md:rounded-none px-6 md:px-10 py-8 md:py-12 text-center hover:bg-white/[0.025] transition-colors duration-300"
              >
                <div className="w-8 h-px bg-cyan-400/40 mx-auto mb-5 md:mb-6" />
                <h3 className="text-[18px] md:text-[22px] font-semibold mb-2 md:mb-3">
                  {item.label}
                </h3>
                <p className="text-[13px] md:text-[14px] text-gray-500 leading-relaxed">
                  {item.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-12 md:py-24 bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="relative rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-8 md:p-16 text-center overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.03]"
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
                一起构建真实空间的数据价值
              </h2>
              <p className="text-[14px] md:text-[17px] text-gray-400 mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
                从实景重建到平台接入，为你的业务建立可展示、可管理、可拓展的三维空间数据资产。
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
              <p className="text-[14px] text-gray-500 leading-relaxed">{config.companyName}</p>
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
                <Link
                  href="/community"
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  模型社区
                </Link>
                <span className="block text-gray-300">关于我们</span>
              </div>
            </div>
          </div>
          <div className="pt-6 md:pt-8 border-t border-white/[0.08] text-center">
            <p className="text-[12px] md:text-[13px] text-gray-600">{config.footerText}</p>
            {config.icp && (
              <p className="mt-2 text-[12px] md:text-[13px] text-gray-600">{config.icp}</p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

