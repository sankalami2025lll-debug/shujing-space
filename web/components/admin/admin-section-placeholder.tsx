/**
 * 组件：AdminSectionPlaceholder
 * 用途：Admin 前端阶段 1 的模块占位内容，保证后台导航已可点击但暂未接业务表格。
 */
import Link from "next/link";

interface AdminSectionPlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function AdminSectionPlaceholder({
  eyebrow,
  title,
  description,
}: AdminSectionPlaceholderProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#121212] p-6 md:p-8">
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">{eyebrow}</p>
      <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">{description}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-sm font-medium text-white/88">当前状态</div>
          <div className="mt-3 text-sm leading-7 text-white/55">
            本模块路由和后台壳子已接入，但真实列表、筛选、表格与操作流程将在后续阶段逐步对接。
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-sm font-medium text-white/88">接口来源</div>
          <div className="mt-3 text-sm leading-7 text-white/55">
            本模块后续数据将来自对应的 <code>/api/admin/*</code> 接口，当前阶段只完成骨架和鉴权守卫。
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm text-white transition-colors hover:bg-white/[0.05]"
        >
          返回后台概览
        </Link>
      </div>
    </section>
  );
}
