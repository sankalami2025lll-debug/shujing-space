"use client";

/**
 * 组件：AdminShell
 * 用途：后台统一布局壳，负责品牌区、模块导航、顶部信息栏与主内容容器。
 * 说明：仅作为 Admin 前端阶段 1 的骨架，不承载业务表格与真实数据请求。
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  FolderTree,
  LayoutDashboard,
  MessageSquareMore,
  Settings2,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export interface AdminNavItem {
  label: string;
  href: string;
  description: string;
  icon: typeof LayoutDashboard;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    label: "概览",
    href: "/admin",
    description: "后台概览与模块入口",
    icon: LayoutDashboard,
  },
  {
    label: "模型管理",
    href: "/admin/models",
    description: "模型审核与删除入口",
    icon: Boxes,
  },
  {
    label: "用户管理",
    href: "/admin/users",
    description: "用户状态与角色维护",
    icon: Users,
  },
  {
    label: "分类管理",
    href: "/admin/categories",
    description: "模型分类与启停维护",
    icon: FolderTree,
  },
  {
    label: "联系线索",
    href: "/admin/leads",
    description: "线索状态流转与跟进",
    icon: MessageSquareMore,
  },
  {
    label: "训练申请",
    href: "/admin/training",
    description: "训练数据服务申请处理",
    icon: Workflow,
  },
  {
    label: "站点配置",
    href: "/admin/site-config",
    description: "官网底部与联系信息配置",
    icon: Settings2,
  },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`))) {
    return true;
  }
  return href === "/admin/training" && pathname === "/admin/training-applications";
}

function resolvePageTitle(pathname: string): string {
  return ADMIN_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href))?.label ?? "后台管理";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const pageTitle = resolvePageTitle(pathname);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#101010] lg:border-r lg:border-b-0">
          <div className="px-5 py-5 border-b border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                  Shujing Space
                </p>
                <h1 className="mt-2 text-[22px] font-semibold tracking-wide">
                  Admin Console
                </h1>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <ShieldCheck className="h-5 w-5 text-white/80" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/55">
              黑白灰后台骨架，延续数境空间科技感，不与用户侧导航混用。
            </p>
          </div>

          <div className="px-3 py-3">
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
              {ADMIN_NAV_ITEMS.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group min-w-[160px] rounded-2xl border px-4 py-3 transition-all lg:block lg:min-w-0 ${
                      active
                        ? "border-white/20 bg-white/[0.08] text-white"
                        : "border-transparent bg-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                          active
                            ? "border-white/15 bg-white/[0.08]"
                            : "border-white/8 bg-white/[0.03] group-hover:border-white/12 group-hover:bg-white/[0.05]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="hidden truncate text-xs text-white/40 lg:block">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-white/10 bg-[#0d0d0d]/95 px-5 py-4 backdrop-blur xl:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                  Admin / {pageTitle}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{pageTitle}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    当前管理员
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                    <span className="max-w-[180px] truncate">{user?.nickname ?? "管理员"}</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-white/45">
                      {user?.role ?? "admin"}
                    </span>
                  </div>
                </div>

                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  返回官网
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </header>

          <main className="px-5 py-6 xl:px-8 xl:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
