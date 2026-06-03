"use client";

/**
 * 组件：AdminTrainingPage
 * 用途：后台训练申请管理页，接入列表与状态流转。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminTrainingApplications,
  updateAdminTrainingStatus,
} from "@/lib/api/admin-training";
import { ApiError } from "@/lib/http";
import type { AdminTrainingApplication, TrainingStatus } from "@/lib/types";

const PAGE_SIZE = 10;

const TRAINING_STATUS_OPTIONS: Array<{
  value: TrainingStatus | "all";
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "submitted", label: "已提交" },
  { value: "contacted", label: "已联系" },
  { value: "evaluating", label: "评估中" },
  { value: "quoted", label: "已报价" },
  { value: "closed", label: "已关闭" },
];

function toDateTimeText(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTrainingStatusLabel(status: TrainingStatus): string {
  return (
    TRAINING_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
  );
}

function trainingStatusBadgeClass(status: TrainingStatus): string {
  switch (status) {
    case "submitted":
      return "border-white/10 bg-white/[0.05] text-white/72";
    case "contacted":
      return "border-sky-400/15 bg-sky-300/10 text-sky-200";
    case "evaluating":
      return "border-violet-400/15 bg-violet-300/10 text-violet-200";
    case "quoted":
      return "border-amber-400/15 bg-amber-300/10 text-amber-200";
    case "closed":
      return "border-white/10 bg-white/[0.08] text-white/72";
    default:
      return "border-white/10 bg-white/[0.05] text-white/72";
  }
}

function stringifyJsonArray(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "-";
  return value
    .map((item) => (typeof item === "string" ? item : String(item)))
    .join(" / ");
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-white/6 py-3 md:grid-cols-[120px_minmax(0,1fr)]">
      <div className="text-sm text-white/42">{label}</div>
      <div className="min-w-0 text-sm leading-7 text-white/82">{value}</div>
    </div>
  );
}

export function AdminTrainingPage() {
  const [status, setStatus] = useState<TrainingStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminTrainingApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTrainingApplication | null>(null);
  const [draftStatuses, setDraftStatuses] = useState<Record<number, TrainingStatus>>({});
  const [pendingId, setPendingId] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const emptyMessage = useMemo(() => {
    if (error) return error;
    if (!loading && list.length === 0) return "当前筛选条件下暂无训练申请。";
    return null;
  }, [error, list.length, loading]);

  const loadList = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminTrainingApplications({
        status,
        page,
        pageSize: PAGE_SIZE,
      });
      if (reqId !== requestIdRef.current) return;
      setList(res.list);
      setTotal(res.total);
      setDraftStatuses(
        Object.fromEntries(res.list.map((item) => [item.id, item.status])),
      );
    } catch (e) {
      if (reqId !== requestIdRef.current) return;
      const message =
        e instanceof ApiError ? e.message : "训练申请加载失败，请稍后重试。";
      setList([]);
      setTotal(0);
      setError(message);
      toast.error(message);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, status]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleUpdateStatus = useCallback(
    async (item: AdminTrainingApplication) => {
      const nextStatus = draftStatuses[item.id] ?? item.status;
      if (nextStatus === item.status || pendingId != null) return;
      setPendingId(item.id);
      try {
        const updated = await updateAdminTrainingStatus(item.id, { status: nextStatus });
        toast.success("训练申请状态已更新");
        setList((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)),
        );
        setDraftStatuses((prev) => ({ ...prev, [item.id]: updated.status }));
        setDetail((prev) => (prev?.id === item.id ? { ...prev, ...updated } : prev));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "训练申请状态更新失败，请稍后重试。");
      } finally {
        setPendingId(null);
      }
    },
    [draftStatuses, pendingId],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[#121212] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
              Admin / Training
            </p>
            <h1 className="mt-3 text-3xl font-semibold">训练申请</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              当前页已接入 <code>/api/admin/training-applications</code>，支持申请列表、状态筛选、详情查看与状态流转。
            </p>
          </div>

          <label className="flex w-full max-w-[220px] flex-col gap-2">
            <span className="text-xs text-white/42">状态筛选</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TrainingStatus | "all");
                setPage(1);
              }}
              className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition-colors focus:border-white/20"
            >
              {TRAINING_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#101010]">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#121212]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
          <div className="text-sm text-white/72">
            共 <span className="font-medium text-white">{total}</span> 条训练申请
          </div>
          <div className="text-xs text-white/40">批量操作与导出 Excel 留待二期</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full">
            <thead className="bg-black/20">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-white/35">
                {["ID", "联系人", "联系方式", "公司", "机器人类型", "训练任务", "状态", "创建时间", "操作"].map((label) => (
                  <th key={label} className="px-4 py-4 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16">
                    <div className="flex items-center justify-center gap-3 text-sm text-white/50">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      正在加载训练申请...
                    </div>
                  </td>
                </tr>
              ) : emptyMessage ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-sm text-white/45">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr key={item.id} className="border-t border-white/6 text-sm text-white/78">
                    <td className="px-4 py-4 font-mono text-xs text-white/55">{item.id}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{item.contactName}</div>
                      <div className="mt-1 text-xs text-white/42">
                        {item.applicant ? `账号：${item.applicant}` : "游客提交"}
                      </div>
                    </td>
                    <td className="px-4 py-4">{item.contactWay}</td>
                    <td className="px-4 py-4 text-white/62">{item.company}</td>
                    <td className="px-4 py-4 text-white/62">{item.robotType}</td>
                    <td className="px-4 py-4 text-white/62">
                      <div className="max-w-[220px] truncate">
                        {stringifyJsonArray(item.trainTasks)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${trainingStatusBadgeClass(item.status)}`}>
                        {getTrainingStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/50">{toDateTimeText(item.createdAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetail(item)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 text-xs text-white transition-colors hover:bg-white/[0.05]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          查看详情
                        </button>
                        <select
                          value={draftStatuses[item.id] ?? item.status}
                          onChange={(event) =>
                            setDraftStatuses((prev) => ({
                              ...prev,
                              [item.id]: event.target.value as TrainingStatus,
                            }))
                          }
                          disabled={pendingId === item.id}
                          className="h-9 rounded-full border border-white/10 bg-black/30 px-3 text-xs text-white outline-none"
                        >
                          {TRAINING_STATUS_OPTIONS.filter(
                            (option) => option.value !== "all",
                          ).map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              className="bg-[#101010]"
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            pendingId === item.id ||
                            (draftStatuses[item.id] ?? item.status) === item.status
                          }
                          onClick={() => handleUpdateStatus(item)}
                          className="inline-flex h-9 items-center rounded-full border border-white/12 px-3 text-xs text-white transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {pendingId === item.id ? "更新中..." : "更新状态"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/8 px-6 py-4 text-sm text-white/65 md:flex-row md:items-center md:justify-between">
          <div>
            第 <span className="text-white">{page}</span> / {totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="inline-flex h-10 items-center gap-1 rounded-full border border-white/12 px-4 text-sm text-white transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="inline-flex h-10 items-center gap-1 rounded-full border border-white/12 px-4 text-sm text-white transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {detail && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#111111] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                  训练申请详情
                </p>
                <h2 className="mt-3 text-2xl font-semibold">{detail.contactName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${trainingStatusBadgeClass(detail.status)}`}>
                  {getTrainingStatusLabel(detail.status)}
                </span>
              </div>

              <div className="mt-5">
                <DetailRow label="申请 ID" value={detail.id} />
                <DetailRow label="申请人账号" value={detail.applicant ?? "游客提交"} />
                <DetailRow label="联系方式" value={detail.contactWay} />
                <DetailRow label="公司" value={detail.company} />
                <DetailRow label="机器人类型" value={detail.robotType} />
                <DetailRow label="训练任务" value={stringifyJsonArray(detail.trainTasks)} />
                <DetailRow label="创建时间" value={toDateTimeText(detail.createdAt)} />
                <DetailRow label="更新时间" value={toDateTimeText(detail.updatedAt)} />
                <DetailRow label="训练任务描述" value={detail.sceneDesc} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
