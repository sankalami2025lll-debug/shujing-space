"use client";

/**
 * 页面：/admin 后台概览
 * 用途：阶段 1 默认首页，展示当前管理员信息、模块入口卡片与接口来源说明。
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "@/components/admin/admin-shell";
import { useAuth } from "@/components/providers/auth-provider";

export default function AdminOverviewPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[#121212] p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
          Stage 1 / Admin Shell
        </p>
        <h1 className="mt-4 text-3xl font-semibold md:text-4xl">后台概览</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">
          当前阶段只完成后台路由骨架、管理员鉴权守卫和模块导航壳子，业务表格、筛选器与写操作将在下一阶段继续对接。
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <div className="text-sm font-medium text-white/88">当前登录管理员</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
                  昵称
                </div>
                <div className="mt-2 text-base font-medium text-white/90">
                  {user?.nickname ?? "-"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
                  联系方式
                </div>
                <div className="mt-2 text-base font-medium text-white/90">
                  {user?.email ?? user?.phone ?? "-"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
                  角色
                </div>
                <div className="mt-2 text-base font-medium uppercase text-white/90">
                  {user?.role ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <div className="text-sm font-medium text-white/88">接口说明</div>
            <p className="mt-4 text-sm leading-7 text-white/55">
              后台真实业务数据来自 <code>/api/admin/*</code>，当前阶段只验证后台壳子、登录态和管理员权限体验守卫。
            </p>
            <p className="mt-4 text-sm leading-7 text-white/55">
              后端仍通过 <code>JwtAuthGuard + RolesGuard + @Roles(&quot;admin&quot;)</code> 做最终权限控制。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[28px] border border-white/10 bg-[#121212] p-6 transition-colors hover:bg-[#161616]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Icon className="h-5 w-5 text-white/78" />
                </div>
                <ArrowRight className="h-4 w-4 text-white/35 transition-transform group-hover:translate-x-1 group-hover:text-white/70" />
              </div>
              <div className="mt-6 text-lg font-medium">{item.label}</div>
              <div className="mt-2 text-sm leading-7 text-white/55">{item.description}</div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
