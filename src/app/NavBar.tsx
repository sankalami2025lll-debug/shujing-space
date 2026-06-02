/**
 * 组件名称：顶部导航 NavBar
 * 组件用途：全站公共顶部导航，用于首页、模型社区、模型库、关于我们、联系我们等主页面（登录注册页 AuthPage 使用独立顶部，不复用本组件）
 * 主要功能：Logo 返回首页、PC 导航高亮、PC 右侧注册登录 / 联系我们按钮、移动端菜单展开收起及滚动锁定
 * 对应文档：页面功能注释文档/03_顶部导航_NavBar.md
 */
import { useState, useEffect } from "react";
import { Menu, X, UserRound } from "lucide-react";
import { toast } from "sonner";
import logoSrc from "../imports/____logo_1_.png";
import { useAuth } from "./AuthContext";

interface NavBarProps {
  // 当前激活页面，仅用于导航高亮，不负责真实路由逻辑。
  // 高亮下划线只作用于 首页/模型社区/关于我们 三个主导航项；
  // 传入 models/contact/auth 时三项均不高亮（用于这些页面没有对应主导航项的情况）。
  activePage: "home" | "community" | "about" | "models" | "contact" | "auth";
  onNavigateHome: () => void;
  onNavigateCommunity: () => void;
  onNavigateAbout: () => void;
  onNavigateContact?: () => void;
  onNavigateAuth?: () => void;
}

export default function NavBar({ activePage, onNavigateHome, onNavigateCommunity, onNavigateAbout, onNavigateContact, onNavigateAuth }: NavBarProps) {
  // mobileOpen：控制移动端下拉菜单的展开/收起状态
  const [mobileOpen, setMobileOpen] = useState(false);

  // 登录态：user 为当前登录用户（未登录为 null），logout 退出登录；用于右侧操作区条件渲染
  const { user, isAuthed, logout } = useAuth();
  // loggingOut：退出登录请求中，避免重复点击
  const [loggingOut, setLoggingOut] = useState(false);

  // close：点击任意移动端菜单项后统一关闭菜单
  const close = () => setMobileOpen(false);

  // handleLogout：退出登录（清除登录态）后关闭菜单、提示并返回首页
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      toast.success("已退出登录");
    } finally {
      setLoggingOut(false);
      close();
      onNavigateHome();
    }
  };

  // 移动端菜单展开时锁定页面滚动，防止背景内容滚动；菜单关闭或组件卸载时恢复
  useEffect(() => {
    if (mobileOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [mobileOpen]);

  // navLinks：PC 与移动端共用的主导航项配置（首页 / 模型社区 / 关于我们），action 为父组件传入的页面跳转函数
  const navLinks = [
    { key: "home", label: "首页", action: onNavigateHome },
    { key: "community", label: "模型社区", action: onNavigateCommunity },
    { key: "about", label: "关于我们", action: onNavigateAbout },
  ] as const;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
      <div className="max-w-[1440px] mx-auto px-5 md:px-24 h-16 md:h-[72px] flex items-center justify-between">

        {/* Logo：点击返回首页，并关闭可能展开的移动端菜单 */}
        <button onClick={() => { onNavigateHome(); close(); }} className="flex items-center gap-2.5 flex-shrink-0">
          <img src={logoSrc} alt="数境空间" className="h-7 md:h-8 w-auto object-contain" style={{ mixBlendMode: "screen" }} />
          <span className="text-[18px] md:text-[22px] font-medium tracking-wide">数境空间</span>
        </button>

        {/* PC 端主导航：当前页面对应项显示冰蓝下划线高亮，其余项点击触发对应跳转 */}
        <div className="hidden md:flex items-center gap-12">
          {navLinks.map(link => (
            link.key === activePage ? (
              <span key={link.key} className="relative text-white text-[15px] font-medium pb-1">
                {link.label}
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400/70 rounded-full" />
              </span>
            ) : (
              <button key={link.key} onClick={link.action} className="text-gray-400 text-[15px] hover:text-white transition-colors">
                {link.label}
              </button>
            )
          ))}
        </div>

        {/* PC 端右侧操作区：未登录显示「注册/登录」，已登录显示用户昵称 + 退出登录；联系我们始终为强转化按钮 */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthed ? (
            <>
              {/* 已登录：展示当前用户昵称（图标 + 昵称） */}
              <span className="flex items-center gap-2 text-[15px] text-gray-300 max-w-[160px] truncate">
                <UserRound className="w-4 h-4 text-cyan-400/80 flex-shrink-0" />
                <span className="truncate">{user?.nickname}</span>
              </span>
              {/* 退出登录：清除登录态后返回首页 */}
              <button onClick={handleLogout} disabled={loggingOut} className="px-6 py-2.5 rounded-full border border-white/30 text-white text-[15px] hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loggingOut ? "退出中…" : "退出登录"}
              </button>
            </>
          ) : (
            <button onClick={onNavigateAuth} className="px-6 py-2.5 rounded-full border border-white/30 text-white text-[15px] hover:bg-white/5 transition-all">注册 / 登录</button>
          )}
          <button onClick={onNavigateContact} className="px-6 py-2.5 rounded-full bg-white text-black text-[15px] font-medium hover:bg-gray-100 transition-all">联系我们</button>
        </div>

        {/* 移动端菜单开关：切换 mobileOpen 控制下拉菜单展开/收起 */}
        <button
          className="md:hidden w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          onClick={() => setMobileOpen(prev => !prev)}
          aria-label="菜单"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 移动端下拉菜单：仅在 mobileOpen 为真时渲染，包含主导航项 + 注册登录 + 联系我们 */}
      {mobileOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10">
          <div className="px-5 py-5 flex flex-col gap-1">
            {navLinks.map(link => (
              // 点击导航项：先执行跳转，再关闭菜单（close 同时解除滚动锁定）
              <button
                key={link.key}
                onClick={() => { link.action(); close(); }}
                className={`w-full text-left px-4 py-3.5 rounded-xl text-[16px] transition-colors ${
                  link.key === activePage
                    ? "text-white bg-white/[0.06] font-medium"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {link.label}
              </button>
            ))}
            {/* 移动端操作区：未登录显示「注册/登录」，已登录显示昵称 + 退出登录；联系我们始终显示，点击后均关闭菜单 */}
            <div className="mt-3 pt-4 border-t border-white/10 flex flex-col gap-3">
              {isAuthed ? (
                <>
                  {/* 已登录：展示当前用户昵称 */}
                  <div className="flex items-center gap-2 px-4 py-2 text-[15px] text-gray-300">
                    <UserRound className="w-4 h-4 text-cyan-400/80 flex-shrink-0" />
                    <span className="truncate">{user?.nickname}</span>
                  </div>
                  {/* 退出登录：清除登录态后返回首页 */}
                  <button onClick={handleLogout} disabled={loggingOut} className="w-full py-3 rounded-full border border-white/25 text-white text-[15px] hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {loggingOut ? "退出中…" : "退出登录"}
                  </button>
                </>
              ) : (
                <button onClick={() => { onNavigateAuth?.(); close(); }} className="w-full py-3 rounded-full border border-white/25 text-white text-[15px] hover:bg-white/5 transition-all">
                  注册 / 登录
                </button>
              )}
              <button onClick={() => { onNavigateContact?.(); close(); }} className="w-full py-3 rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all">
                联系我们
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
