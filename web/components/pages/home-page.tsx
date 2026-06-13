"use client";

/**
 * 页面名称：首页 Home
 * 页面用途：公司官网主入口，传达「数境空间」品牌、真实三维空间数据服务定位，并引导进入模型社区、关于我们、联系我们
 * 主要功能：Hero 首屏、业务平台卡片（点击打开视频弹窗）、业务场景卡片、CTA 转化区、Footer、VideoModal 视频说明弹窗
 * 对应文档：页面功能注释文档/02_首页_Home.md、页面功能注释文档/03_顶部导航_NavBar.md
 * 说明：全站 NavBar 由 layout SiteChrome 挂载；本页不含 NavBar（对齐 Next 4A 架构）。
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { useSiteConfig } from "@/components/providers/site-config-provider";
import { VideoModal } from "@/components/home/video-modal";
import {
  platformCards,
  scenarioCards,
  scenarios,
  type ModalItem,
} from "@/lib/home-content";

export default function HomePage() {
  // activeModal：当前打开的业务说明弹窗数据，null 表示关闭
  const [activeModal, setActiveModal] = useState<ModalItem | null>(null);
  // 站点配置：Footer 联系方式 / 公司名 / 版权 / 备案号来自 SiteConfigProvider（GET /api/site-config）
  const { config } = useSiteConfig();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden -mt-16 md:-mt-[72px]">
      {/* Hero：负 margin 抵消 SiteChrome 顶距，pt-16 与 Vite 版全屏 Hero + 固定 NavBar 叠层一致 */}
      <section className="relative h-screen flex items-center overflow-hidden pt-16 md:pt-[72px]">
        <div className="absolute inset-0">
          <img
            src="/home-hero.png"
            alt="数字孪生城市"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <div className="relative max-w-[1440px] mx-auto px-5 md:px-24 w-full pt-20 md:pt-0 pb-12 md:pb-0">
          <div className="max-w-[560px]">
            <h1 className="text-[40px] md:text-[72px] font-bold leading-tight mb-3 md:mb-4">
              数境空间
            </h1>
            <p className="text-[22px] md:text-[38px] font-medium leading-tight mb-4 md:mb-6 text-gray-100">
              真实三维空间数据服务平台
            </p>
            <p className="text-[15px] md:text-[17px] leading-relaxed text-gray-300 mb-8 md:mb-12">
              将真实世界转化为可展示、可管理、可拓展的三维空间数据资产
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Link
                href="/community"
                className="px-8 py-3.5 rounded-full bg-white text-black text-[15px] md:text-[16px] font-medium hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              >
                进入模型社区
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/about"
                className="px-8 py-3.5 rounded-full border border-white/40 text-white text-[15px] md:text-[16px] hover:bg-white/5 transition-all text-center"
              >
                了解我们
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 业务平台：三大平台能力入口，点击卡片打开 VideoModal 视频说明弹窗 */}
      <section className="relative py-16 md:py-32 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-[28px] md:text-[42px] font-bold mb-4">业务平台</h2>
            <p className="text-[15px] md:text-[17px] text-gray-400 max-w-2xl mx-auto">
              围绕真实三维空间数据，构建在线展示、数字孪生与具身智能训练的平台能力
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
            {platformCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setActiveModal(card)}
                className="group relative h-full flex flex-col bg-gradient-to-b from-white/[0.05] to-white/[0.02] backdrop-blur-sm rounded-[24px] border border-white/10 p-6 md:p-8 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden text-left cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/5 group-hover:to-transparent transition-all duration-300" />
                <div className="relative flex flex-col flex-1 h-full">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 md:mb-6 text-cyan-400/70 group-hover:text-cyan-400 transition-colors">
                    {card.icon}
                  </div>
                  <h3 className="text-[18px] md:text-[22px] font-semibold mb-3 md:mb-4 min-h-[3.5rem] md:min-h-[4.5rem]">
                    {card.title}
                  </h3>
                  <p className="text-[14px] md:text-[15px] text-gray-400 leading-relaxed mb-5 md:mb-6 flex-1">
                    {card.desc}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1.5 rounded-full bg-white/5 text-[12px] md:text-[13px] text-gray-300 border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-1 text-[11px] text-cyan-400/70 pr-1 pt-1">
                      <Play className="w-3 h-3" />
                      <span>查看演示</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 业务场景：六个应用场景入口，按标题匹配 scenarioCards 后打开对应场景弹窗 */}
      <section className="relative py-10 md:py-14 bg-[#0a0a0a]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-[24px] md:text-[32px] font-bold mb-2">业务场景</h2>
            <p className="text-[13px] md:text-[15px] text-gray-400 max-w-2xl mx-auto">
              真实三维空间数据可应用于工程、文旅、影视、存档、营销与具身智能训练等场景
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
            {scenarios.map((s) => {
              // 通过标题匹配 scenarioCards 找到对应弹窗数据，点击卡片打开 VideoModal
              const modalItem = scenarioCards.find((c) => c.title === s.title);
              return (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => modalItem && setActiveModal(modalItem)}
                  className="group relative w-full min-w-0 p-0 flex flex-col bg-gradient-to-b from-white/[0.03] to-transparent rounded-[16px] border border-white/10 overflow-hidden hover:border-cyan-500/30 transition-all duration-300 text-left cursor-pointer"
                >
                  {/* 顶部展示区域：absolute 背景层铺满，避免 button 默认内边距造成左上空白 */}
                  <div className="relative w-full aspect-[16/7] min-h-[110px] shrink-0 overflow-hidden">
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
                    <div className="absolute inset-0 flex items-center justify-center text-white/15 pointer-events-none">
                      {s.icon && (
                        <div className="w-10 h-10 flex items-center justify-center">
                          {s.icon}
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 md:p-4 w-full">
                    <h3 className="text-[13px] md:text-[15px] font-semibold mb-1 flex items-center gap-1.5">
                      <span className="text-cyan-400">{s.icon}</span>
                      {s.title}
                    </h3>
                    <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">
                      {s.desc}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-white/5 border border-white/[0.08] text-[11px] text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA：底部转化区域，引导用户进入联系页发起合作咨询 */}
      <section className="relative py-16 md:py-32 bg-gradient-to-b from-[#0a0a0a] to-black">
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
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-[26px] md:text-[48px] font-bold mb-4 leading-tight">
                让真实空间成为可拓展的三维数据资产
              </h2>
              <p className="text-[15px] md:text-[18px] text-gray-400 mb-8 md:mb-10 max-w-3xl mx-auto">
                从空间数据处理到云端展示，为企业构建可展示、可管理、可拓展的空间数字底座。
              </p>
              <Link
                href="/contact"
                className="px-10 py-3.5 md:py-4 rounded-full bg-white text-black text-[15px] md:text-[16px] font-medium hover:bg-gray-100 transition-all inline-flex items-center gap-2"
              >
                联系我们
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer：底部信息区，Logo、站点配置联系方式与站内导航 */}
      <footer className="relative bg-black border-t border-white/10 py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-10 md:mb-12">
            <div>
              <div className="flex items-center mb-4 md:mb-6">
                <img
                  src="/loading/loading-logo-reference1.png"
                  alt="数境空间"
                  className="h-[57px] w-auto object-contain"
                />
              </div>
              <p className="text-[14px] text-gray-500">{config.companyName}</p>
            </div>
            <div>
              <h4 className="text-[15px] md:text-[16px] font-semibold mb-4">
                联系方式
              </h4>
              <div className="space-y-2 text-[14px] text-gray-500">
                <p>电话：{config.phone}</p>
                <p>邮箱：{config.email}</p>
                <p>地址：{config.address}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[15px] md:text-[16px] font-semibold mb-4">
                导航
              </h4>
              <div className="space-y-2 text-[14px]">
                <span className="block text-gray-300">首页</span>
                <Link
                  href="/community"
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  模型社区
                </Link>
                <Link
                  href="/about"
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  关于我们
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-6 md:pt-8 border-t border-white/10 text-center">
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

      {/* VideoModal：业务说明弹窗，当前为模拟视频播放，后续可替换为真实视频资源 */}
      {activeModal && (
        <VideoModal item={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}

