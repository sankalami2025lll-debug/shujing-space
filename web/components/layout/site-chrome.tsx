"use client";

/**
 * 组件：全站布局壳 SiteChrome
 * 用途：按路由挂载 NavBar 与主内容区顶距；/auth 不显示 NavBar（与 Vite AuthPage 独立顶栏一致）
 */
import { usePathname } from "next/navigation";
import NavBar from "@/components/layout/NavBar";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // hideNav：登录注册页、后台管理页、viewer 独立查看器使用独立顶栏或不展示导航
  // /viewer 路径用于 LCC iframe 隔离查看器，不渲染主站 NavBar
  const hideNav =
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/viewer");

  return (
    <>
      {!hideNav && <NavBar />}
      <div className={hideNav ? undefined : "pt-16 md:pt-[72px]"}>{children}</div>
    </>
  );
}
