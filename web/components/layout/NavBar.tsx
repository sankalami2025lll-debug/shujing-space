"use client";

/**
 * 组件名称：顶部导航 NavBar
 * 组件用途：全站公共顶部导航（登录注册页 /auth 使用独立顶栏，由 SiteChrome 不挂载本组件）
 * 主要功能：Logo 返回首页、PC 导航高亮、PC 右侧注册登录 / 联系我们、移动端菜单展开收起及滚动锁定
 * 对应文档：页面功能注释文档/03_顶部导航_NavBar.md
 */
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";

// ActivePage：当前激活页面，仅用于导航高亮（models/contact/auth 时三项主导航均不高亮）
type ActivePage = "home" | "community" | "about" | "models" | "contact" | "auth";

// resolveActivePage：根据 pathname 解析高亮项，与 Vite NavBar activePage 语义一致
function resolveActivePage(pathname: string): ActivePage {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/about")) return "about";
  if (pathname.startsWith("/models")) return "models";
  if (pathname.startsWith("/contact")) return "contact";
  if (pathname.startsWith("/auth")) return "auth";
  return "models";
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const activePage = useMemo(() => resolveActivePage(pathname), [pathname]);

  // mobileOpen：控制移动端下拉菜单的展开/收起状态
  const [mobileOpen, setMobileOpen] = useState(false);

  // 登录态：user 为当前登录用户（未登录为 null），logout 退出登录
  const { user, isAuthed, logout } = useAuth();
  // loggingOut：退出登录请求中，避免重复点击
  const [loggingOut, setLoggingOut] = useState(false);

  // close：点击任意移动端菜单项后统一关闭菜单
  const close = () => setMobileOpen(false);

  // handleLogout：退出登录后关闭菜单、提示并返回首页（与 Vite NavBar 行为一致）
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      toast.success("已退出登录");
    } finally {
      setLoggingOut(false);
      close();
      router.push("/");
    }
  };

  // 移动端菜单展开时锁定页面滚动，防止背景内容滚动
  useEffect(() => {
    if (mobileOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [mobileOpen]);

  // navLinks：PC 与移动端共用的主导航项（首页 / 模型社区 / 关于我们）
  const navLinks = [
    { key: "home" as const, label: "首页", href: "/" },
    { key: "community" as const, label: "模型社区", href: "/community" },
    { key: "about" as const, label: "关于我们", href: "/about" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
      <div className="max-w-[1440px] mx-auto px-5 md:px-24 h-16 md:h-[72px] flex items-center justify-between">
        {/* Logo：点击返回首页，并关闭可能展开的移动端菜单 */}
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-2.5 flex-shrink-0"
        >
          <img
            src="/logo.png"
            alt="数境空间"
            className="h-7 md:h-8 w-auto object-contain"
            style={{ mixBlendMode: "screen" }}
          />
          <span className="text-[18px] md:text-[22px] font-medium tracking-wide">
            数境空间
          </span>
        </Link>

        {/* PC 端主导航：当前页面对应项显示冰蓝下划线高亮 */}
        <div className="hidden md:flex items-center gap-12">
          {navLinks.map((link) =>
            link.key === activePage ? (
              <span
                key={link.key}
                className="relative text-white text-[15px] font-medium pb-1"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400/70 rounded-full" />
              </span>
            ) : (
              <Link
                key={link.key}
                href={link.href}
                className="text-gray-400 text-[15px] hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>

        {/* PC 端右侧操作区 */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthed ? (
            <>
              <span className="flex items-center gap-2 text-[15px] text-gray-300 max-w-[160px] truncate">
                <UserRound className="w-4 h-4 text-cyan-400/80 flex-shrink-0" />
                <span className="truncate">{user?.nickname}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-6 py-2.5 rounded-full border border-white/30 text-white text-[15px] hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loggingOut ? "退出中…" : "退出登录"}
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="px-6 py-2.5 rounded-full border border-white/30 text-white text-[15px] hover:bg-white/5 transition-all"
            >
              注册 / 登录
            </Link>
          )}
          <Link
            href="/contact"
            className="px-6 py-2.5 rounded-full bg-white text-black text-[15px] font-medium hover:bg-gray-100 transition-all"
          >
            联系我们
          </Link>
        </div>

        {/* 移动端菜单开关 */}
        <button
          type="button"
          className="md:hidden w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="菜单"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 移动端下拉菜单 */}
      {mobileOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10">
          <div className="px-5 py-5 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={close}
                className={`w-full text-left px-4 py-3.5 rounded-xl text-[16px] transition-colors ${
                  link.key === activePage
                    ? "text-white bg-white/[0.06] font-medium"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 pt-4 border-t border-white/10 flex flex-col gap-3">
              {isAuthed ? (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 text-[15px] text-gray-300">
                    <UserRound className="w-4 h-4 text-cyan-400/80 flex-shrink-0" />
                    <span className="truncate">{user?.nickname}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full py-3 rounded-full border border-white/25 text-white text-[15px] hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loggingOut ? "退出中…" : "退出登录"}
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={close}
                  className="w-full py-3 rounded-full border border-white/25 text-white text-[15px] hover:bg-white/5 transition-all text-center"
                >
                  注册 / 登录
                </Link>
              )}
              <Link
                href="/contact"
                onClick={close}
                className="w-full py-3 rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all text-center"
              >
                联系我们
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
