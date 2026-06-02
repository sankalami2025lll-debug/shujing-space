/**
 * 页面名称：首页 Home
 * 页面用途：公司官网主入口，传达「数境空间」品牌、真实三维空间数据服务定位，并引导进入模型社区、关于我们、联系我们
 * 主要功能：顶部导航、Hero 首屏、业务平台卡片（点击打开视频弹窗）、业务场景卡片、CTA 转化区、Footer、VideoModal 视频说明弹窗
 * 对应文档：页面功能注释文档/02_首页_Home.md、页面功能注释文档/03_顶部导航_NavBar.md
 */
import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Building2,
  Camera,
  Mountain,
  Archive,
  Home,
  Brain,
  Cloud,
  Network,
  X,
  Play,
  Pause,
} from "lucide-react";
import ModelCommunity from "./ModelCommunity";
import AboutUs from "./AboutUs";
import ModelLibrary from "./ModelLibrary";
import ContactPage from "./ContactPage";
import AuthPage from "./AuthPage";
import NavBar from "./NavBar";
import { AuthProvider } from "./AuthContext";
import { SiteConfigProvider, useSiteConfig } from "./SiteConfigContext";
import { Toaster } from "./components/ui/sonner";
import heroBg from "../imports/_______.png";
import logoSrc from "../imports/____logo_1_.png";

interface ModalItem {
  category: string;
  title: string;
  videoTitle: string;
  desc: string;
  tags: string[];
  isEmbodied?: boolean;
  gradientFrom: string;
  gradientTo: string;
  icon: React.ReactNode;
}

const platformCards: ModalItem[] = [
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
  },
];

const scenarioCards: ModalItem[] = [
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
  },
];

const scenarios = [
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

function VideoModal({
  item,
  onClose,
  onNavigateModels,
  onNavigateContact,
}: {
  item: ModalItem;
  onClose: () => void;
  onNavigateModels: () => void;
  onNavigateContact: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleClose = useCallback(() => {
    setPlaying(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () =>
      document.removeEventListener("keydown", handler);
  }, [handleClose]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setPlaying(false);
          return 0;
        }
        return p + 0.5;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-[960px] bg-[#0f0f0f] border border-white/10 rounded-t-3xl sm:rounded-[24px] overflow-hidden flex flex-col sm:flex-row max-h-[90vh] sm:max-h-[680px]"
        style={{
          boxShadow:
            "0 0 0 1px rgba(6,182,212,0.08), 0 32px 80px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cyan accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* Left: video area (65%) */}
        <div className="w-full sm:w-[65%] flex-shrink-0 flex flex-col">
          <div
            className={`relative flex-1 bg-gradient-to-br ${item.gradientFrom} ${item.gradientTo} overflow-hidden`}
            style={{ minHeight: 220, aspectRatio: "16/9" }}
          >
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            {/* Corner accents */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-cyan-500/30" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-cyan-500/30" />
            <div className="absolute bottom-8 left-3 w-4 h-4 border-b border-l border-cyan-500/30" />
            <div className="absolute bottom-8 right-3 w-4 h-4 border-b border-r border-cyan-500/30" />

            {/* Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white/30">
                  {item.icon}
                </div>
                {!playing && (
                  <p className="text-white/30 text-[13px]">
                    {item.videoTitle}
                  </p>
                )}
                {playing && (
                  <p className="text-cyan-400/60 text-[13px]">
                    正在播放...
                  </p>
                )}
              </div>
            </div>

            {/* Play button overlay */}
            <button
              onClick={() => setPlaying(!playing)}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <div
                className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 ${playing ? "bg-white/5 border-white/15 opacity-0 group-hover:opacity-100" : "bg-white/10 border-white/20 hover:bg-white/15 hover:border-cyan-500/30"}`}
              >
                {playing ? (
                  <Pause className="w-5 h-5 text-white/70" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </div>
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-10 bg-[#0a0a0a] border-t border-white/5 flex items-center px-4 gap-3">
            <button
              onClick={() => setPlaying(!playing)}
              className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
            >
              {playing ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-400/40 rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-600 flex-shrink-0">
              {Math.floor((progress * 1.8) / 60)
                .toString()
                .padStart(2, "0")}
              :
              {Math.floor((progress * 1.8) % 60)
                .toString()
                .padStart(2, "0")}{" "}
              / 03:00
            </span>
          </div>
        </div>

        {/* Right: info panel (35%) */}
        <div className="w-full sm:w-[35%] flex flex-col justify-center p-6 md:p-10 overflow-y-auto border-t sm:border-t-0 sm:border-l border-white/[0.06]">
          <div className="space-y-5">
            <div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px]">
                {item.category}
              </span>
            </div>
            <h2 className="text-[22px] md:text-[24px] font-semibold leading-tight">
              {item.title}
            </h2>
            <p className="text-[13px] md:text-[14px] text-gray-400 leading-relaxed">
              {item.desc}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[12px] text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 弹窗底部引导按钮：具身智能业务显示「申请训练数据服务」；首页业务平台/业务场景弹窗不显示「浏览模型」 */}
          {(item.isEmbodied ||
            (item.category !== "业务平台" &&
              item.category !== "业务场景")) && (
            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              {item.isEmbodied ? (
                <button
                  onClick={() => {
                    handleClose();
                    onNavigateContact();
                  }}
                  className="w-full py-2.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[14px] hover:bg-violet-500/25 transition-all"
                >
                  申请训练数据服务
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleClose();
                    onNavigateModels();
                  }}
                  className="w-full py-2.5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-[14px] hover:bg-cyan-500/25 transition-all"
                >
                  浏览模型
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// App：根组件，用 AuthProvider + SiteConfigProvider 包裹全站，向下提供登录态与站点配置上下文。
//   登录态供 NavBar 显示 / AuthPage 写入；站点配置供各页 Footer 与联系我们侧栏读取联系方式。
export default function App() {
  return (
    <AuthProvider>
      <SiteConfigProvider>
        <AppContent />
      </SiteConfigProvider>
    </AuthProvider>
  );
}

// AppContent：原有首页 + 模拟路由主体，承载页面切换、弹窗与各页面渲染。
function AppContent() {
  const [page, setPage] = useState<
    | "home"
    | "community"
    | "about"
    | "models"
    | "contact"
    | "auth"
  >("home");
  const [activeModal, setActiveModal] =
    useState<ModalItem | null>(null);
  const [initialModelId, setInitialModelId] = useState<
    number | undefined
  >(undefined);

  // 站点配置：首页 Footer 的联系方式 / 公司名 / 版权 / 备案号来自后端 GET /api/site-config（默认值兜底）
  const { config } = useSiteConfig();

  // 页面切换滚动复位：以 useState 模拟路由切换页面时，浏览器不会自动重置滚动位置，
  // 会停留在上一页的滚动高度（如从 Footer/底部 CTA 点击进入联系我们页时停在中间）。
  // 因此监听 page 变化，每次切换后将窗口滚动回顶部，覆盖 home/community/models/about/contact/auth 全部页面。
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

  const nav = {
    home: () => setPage("home"),
    community: () => setPage("community"),
    about: () => setPage("about"),
    models: (modelId?: number) => {
      setInitialModelId(modelId);
      setPage("models");
    },
    contact: () => setPage("contact"),
    auth: () => setPage("auth"),
  };

  // toaster：全站统一的轻提示出口（sonner）。各页面切换为 useState 模拟路由，存在多处提前 return，
  // 故以共享元素在每个返回分支挂载，保证任意页面触发的 loading/success/error 提示都能显示。
  // 本步仅挂载组件，尚未在业务中调用 toast。
  const toaster = <Toaster richColors position="top-center" />;

  if (page === "community") {
    return (
      <>
        <ModelCommunity
          onNavigateHome={nav.home}
          onNavigateAbout={nav.about}
          onNavigateModels={nav.models}
          onNavigateContact={nav.contact}
          onNavigateAuth={nav.auth}
        />
        {toaster}
      </>
    );
  }
  if (page === "about") {
    return (
      <>
        <AboutUs
          onNavigateHome={nav.home}
          onNavigateCommunity={nav.community}
          onNavigateContact={nav.contact}
          onNavigateAuth={nav.auth}
        />
        {toaster}
      </>
    );
  }
  if (page === "models") {
    return (
      <>
        <ModelLibrary
          onNavigateHome={nav.home}
          onNavigateCommunity={nav.community}
          onNavigateAbout={nav.about}
          onNavigateContact={nav.contact}
          onNavigateAuth={nav.auth}
          initialModelId={initialModelId}
        />
        {toaster}
      </>
    );
  }
  if (page === "contact") {
    return (
      <>
        <ContactPage
          onNavigateHome={nav.home}
          onNavigateCommunity={nav.community}
          onNavigateAbout={nav.about}
          onNavigateAuth={nav.auth}
          onNavigateModels={nav.models}
        />
        {toaster}
      </>
    );
  }
  if (page === "auth") {
    return (
      <>
        {/* 登录 / 注册成功后跳转模型库（与「正在进入模型库」文案一致），onNavigateHome 用于 Logo / 返回官网 */}
        <AuthPage onNavigateHome={nav.home} onNavigateModels={() => nav.models()} />
        {toaster}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <NavBar
        activePage="home"
        onNavigateHome={nav.home}
        onNavigateCommunity={nav.community}
        onNavigateAbout={nav.about}
        onNavigateContact={nav.contact}
        onNavigateAuth={nav.auth}
      />

      {/* Hero：官网首屏，建立品牌识别与核心业务定位，提供进入模型社区 / 了解我们两个 CTA */}
      <section className="relative h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroBg}
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
              <button
                onClick={() => setPage("community")}
                className="px-8 py-3.5 rounded-full bg-white text-black text-[15px] md:text-[16px] font-medium hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              >
                进入模型社区
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage("about")}
                className="px-8 py-3.5 rounded-full border border-white/40 text-white text-[15px] md:text-[16px] hover:bg-white/5 transition-all text-center"
              >
                了解我们
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 业务平台：三大平台能力入口，点击卡片打开 VideoModal 视频说明弹窗 */}
      <section className="relative py-16 md:py-32 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f]">
        <div className="max-w-[1200px] mx-auto px-5 md:px-6">
          <div className="text-center mb-12 md:mb-20">
            <h2 className="text-[28px] md:text-[42px] font-bold mb-4">
              业务平台
            </h2>
            <p className="text-[15px] md:text-[17px] text-gray-400 max-w-2xl mx-auto">
              围绕真实三维空间数据，构建在线展示、数字孪生与具身智能训练的平台能力
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
            {platformCards.map((card) => (
              <button
                key={card.title}
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
                  {/* Click hint */}
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
            <h2 className="text-[24px] md:text-[32px] font-bold mb-2">
              业务场景
            </h2>
            <p className="text-[13px] md:text-[15px] text-gray-400 max-w-2xl mx-auto">
              真实三维空间数据可应用于工程、文旅、影视、存档、营销与具身智能训练等场景
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
            {scenarios.map((s) => {
              // 通过标题匹配 scenarioCards 找到对应弹窗数据，点击卡片打开 VideoModal
              const modalItem = scenarioCards.find(
                (c) => c.title === s.title,
              );
              return (
                <button
                  key={s.title}
                  onClick={() =>
                    modalItem && setActiveModal(modalItem)
                  }
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
                    {/* Play hint on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 md:p-4 w-full">
                    <h3 className="text-[13px] md:text-[15px] font-semibold mb-1 flex items-center gap-1.5">
                      <span className="text-cyan-400">
                        {s.icon}
                      </span>
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
              {/* 点击「联系我们」跳转到联系页，发起合作咨询 */}
              <button
                onClick={() => setPage("contact")}
                className="px-10 py-3.5 md:py-4 rounded-full bg-white text-black text-[15px] md:text-[16px] font-medium hover:bg-gray-100 transition-all inline-flex items-center gap-2"
              >
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
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <img
                  src={logoSrc}
                  alt="数境空间"
                  className="h-7 w-auto object-contain"
                  style={{ mixBlendMode: "screen" }}
                />
                <span className="text-[18px] font-medium">
                  数境空间
                </span>
              </div>
              <p className="text-[14px] text-gray-500">
                {config.companyName}
              </p>
            </div>
            <div>
              <h4 className="text-[15px] md:text-[16px] font-semibold mb-4">
                联系方式
              </h4>
              {/* 联系方式来自站点配置（GET /api/site-config）；接口异常时回退默认占位「请填写」 */}
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
                {/* 首页链接改为按钮跳转，与下方模型社区、关于我们保持一致的导航方式 */}
                <button
                  onClick={() => setPage("home")}
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  首页
                </button>
                <button
                  onClick={() => setPage("community")}
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  模型社区
                </button>
                <button
                  onClick={() => setPage("about")}
                  className="block text-gray-500 hover:text-white transition-colors"
                >
                  关于我们
                </button>
              </div>
            </div>
          </div>
          <div className="pt-6 md:pt-8 border-t border-white/10 text-center">
            <p className="text-[12px] md:text-[13px] text-gray-600">
              {config.footerText}
            </p>
            {/* 备案号：站点配置存在 icp 时才渲染，默认空值不显示 */}
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
        <VideoModal
          item={activeModal}
          onClose={() => setActiveModal(null)}
          onNavigateModels={() => {
            setActiveModal(null);
            setPage("models");
          }}
          onNavigateContact={() => {
            setActiveModal(null);
            setPage("contact");
          }}
        />
      )}

      {/* 首页全局轻提示出口（sonner），与其它页面分支共用同一配置 */}
      {toaster}
    </div>
  );
}