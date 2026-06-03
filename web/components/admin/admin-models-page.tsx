"use client";

/**
 * 组件：AdminModelsPage
 * 用途：后台模型管理页，接入 /api/admin/models 列表、详情、审核与软删除能力。
 * 说明：本阶段聚焦模型管理，不扩展其他后台模块。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteAdminModel,
  getAdminModelDetail,
  getAdminModels,
  updateAdminModelStatus,
} from "@/lib/api/admin-models";
import { formatViews } from "@/lib/format";
import { ApiError } from "@/lib/http";
import type { AdminModel, AdminModelStatusFilter, ModelStatus } from "@/lib/types";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: Array<{ label: string; value: AdminModelStatusFilter }> = [
  { label: "全部", value: "all" },
  { label: "待审核", value: "pending" },
  { label: "已发布", value: "published" },
  { label: "已驳回", value: "rejected" },
  { label: "草稿", value: "draft" },
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

function getStatusLabel(status: ModelStatus): string {
  switch (status) {
    case "pending":
      return "待审核";
    case "published":
      return "已发布";
    case "rejected":
      return "已驳回";
    case "draft":
      return "草稿";
    default:
      return status;
  }
}

function getVisibilityLabel(visibility: AdminModel["visibility"]): string {
  switch (visibility) {
    case "public":
      return "公开";
    case "private":
      return "仅自己";
    case "review":
      return "审核后公开";
    default:
      return visibility;
  }
}

function badgeClass(status: ModelStatus): string {
  switch (status) {
    case "pending":
      return "border-amber-400/15 bg-amber-300/10 text-amber-200";
    case "published":
      return "border-emerald-400/15 bg-emerald-300/10 text-emerald-200";
    case "rejected":
      return "border-rose-400/15 bg-rose-300/10 text-rose-200";
    case "draft":
      return "border-white/10 bg-white/[0.05] text-white/68";
    default:
      return "border-white/10 bg-white/[0.05] text-white/68";
  }
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-white/6 py-3 md:grid-cols-[120px_minmax(0,1fr)]">
      <div className="text-sm text-white/42">{label}</div>
      <div className="min-w-0 text-sm leading-7 text-white/82">{value}</div>
    </div>
  );
}

export function AdminModelsPage() {
  const [status, setStatus] = useState<AdminModelStatusFilter>("pending");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const [list, setList] = useState<AdminModel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AdminModel | null>(null);

  const [approveTarget, setApproveTarget] = useState<AdminModel | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminModel | null>(null);

  const [rejectReason, setRejectReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [actionPendingId, setActionPendingId] = useState<number | null>(null);

  const requestIdRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const emptyMessage = useMemo(() => {
    if (error) return error;
    if (!loading && list.length === 0) return "当前筛选条件下暂无模型。";
    return null;
  }, [error, list.length, loading]);

  const loadList = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminModels({
        status,
        keyword: keyword || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (reqId !== requestIdRef.current) return;
      setList(res.list);
      setTotal(res.total);
    } catch (e) {
      if (reqId !== requestIdRef.current) return;
      const msg = e instanceof ApiError ? e.message : "模型列表加载失败，请稍后重试。";
      setList([]);
      setTotal(0);
      setError(msg);
      toast.error(msg);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [keyword, page, status]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = useCallback(async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getAdminModelDetail(id);
      setDetail(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "模型详情加载失败，请稍后重试。";
      toast.error(msg);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshAfterAction = useCallback(async () => {
    await loadList();
    if (detail?.id) {
      try {
        const next = await getAdminModelDetail(detail.id);
        setDetail(next);
      } catch {
        setDetail(null);
        setDetailOpen(false);
      }
    }
  }, [detail?.id, loadList]);

  const handleApprove = useCallback(async () => {
    if (!approveTarget || actionPendingId != null) return;
    setActionPendingId(approveTarget.id);
    try {
      await updateAdminModelStatus(approveTarget.id, { action: "approve" });
      toast.success("审核通过");
      setApproveTarget(null);
      await refreshAfterAction();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "审核失败，请稍后重试。");
    } finally {
      setActionPendingId(null);
    }
  }, [actionPendingId, approveTarget, refreshAfterAction]);

  const handleReject = useCallback(async () => {
    if (!rejectTarget || actionPendingId != null) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("请填写驳回原因");
      return;
    }
    setActionPendingId(rejectTarget.id);
    try {
      await updateAdminModelStatus(rejectTarget.id, {
        action: "reject",
        rejectReason: reason,
      });
      toast.success("已驳回模型");
      setRejectTarget(null);
      setRejectReason("");
      await refreshAfterAction();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "驳回失败，请稍后重试。");
    } finally {
      setActionPendingId(null);
    }
  }, [actionPendingId, refreshAfterAction, rejectReason, rejectTarget]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || actionPendingId != null) return;
    setActionPendingId(deleteTarget.id);
    try {
      await deleteAdminModel(deleteTarget.id, {
        deleteReason: deleteReason.trim() || undefined,
      });
      toast.success("模型已软删除");
      if (detail?.id === deleteTarget.id) {
        setDetail(null);
        setDetailOpen(false);
      }
      setDeleteTarget(null);
      setDeleteReason("");
      await loadList();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败，请稍后重试。");
    } finally {
      setActionPendingId(null);
    }
  }, [actionPendingId, deleteReason, deleteTarget, detail?.id, loadList]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[#121212] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
              Admin / Models
            </p>
            <h1 className="mt-3 text-3xl font-semibold">模型管理</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              当前页已接入 <code>/api/admin/models</code> 相关接口，可查看模型详情、审核通过、填写驳回原因和执行软删除。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,300px)_auto_auto]">
            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/42">状态筛选</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AdminModelStatusFilter);
                  setPage(1);
                }}
                className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition-colors focus:border-white/20"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#101010]">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/42">关键词</span>
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 transition-colors focus-within:border-white/20">
                <Search className="h-4 w-4 text-white/35" />
                <input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setKeyword(keywordInput.trim());
                      setPage(1);
                    }
                  }}
                  placeholder="搜索标题或作者"
                  className="h-full flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                />
              </div>
            </label>

            <button
              type="button"
              onClick={() => {
                setKeyword(keywordInput.trim());
                setPage(1);
              }}
              className="h-11 rounded-2xl border border-white/15 px-5 text-sm text-white transition-colors hover:bg-white/[0.05]"
            >
              搜索
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus("pending");
                setKeywordInput("");
                setKeyword("");
                setPage(1);
              }}
              className="h-11 rounded-2xl border border-white/10 px-5 text-sm text-white/72 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              重置
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#121212]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
          <div className="text-sm text-white/72">
            共 <span className="font-medium text-white">{total}</span> 条模型记录
          </div>
          <div className="text-xs text-white/40">
            当前阶段只显示未软删除模型；对象存储文件不会立即删除
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1240px] w-full">
            <thead className="bg-black/20">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-white/35">
                {["ID", "标题", "类型", "作者", "分类", "状态", "可见性", "浏览", "点赞", "收藏", "创建时间", "操作"].map((label) => (
                  <th key={label} className="px-4 py-4 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16">
                    <div className="flex items-center justify-center gap-3 text-sm text-white/50">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      正在加载模型列表...
                    </div>
                  </td>
                </tr>
              ) : emptyMessage ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-sm text-white/45">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                list.map((model) => (
                  <tr key={model.id} className="border-t border-white/6 text-sm text-white/78">
                    <td className="px-4 py-4 font-mono text-xs text-white/55">{model.id}</td>
                    <td className="px-4 py-4">
                      <div className="max-w-[240px]">
                        <div className="truncate font-medium text-white">{model.title}</div>
                        <div className="mt-1 truncate text-xs text-white/42">
                          {model.fileFormat ?? model.viewerType}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/62">{model.type}</td>
                    <td className="px-4 py-4">{model.author || "-"}</td>
                    <td className="px-4 py-4 text-white/62">{model.category?.name ?? "-"}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${badgeClass(model.status)}`}>
                        {getStatusLabel(model.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/62">{getVisibilityLabel(model.visibility)}</td>
                    <td className="px-4 py-4 text-white/62">{formatViews(model.viewsCount)}</td>
                    <td className="px-4 py-4 text-white/62">{model.likesCount}</td>
                    <td className="px-4 py-4 text-white/62">{model.favoritesCount}</td>
                    <td className="px-4 py-4 text-white/50">{toDateTimeText(model.createdAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(model.id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 text-xs text-white transition-colors hover:bg-white/[0.05]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          查看详情
                        </button>
                        <button
                          type="button"
                          disabled={model.status !== "pending" || actionPendingId === model.id}
                          onClick={() => setApproveTarget(model)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-400/15 px-3 text-xs text-emerald-200 transition-colors hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" />
                          审核通过
                        </button>
                        <button
                          type="button"
                          disabled={model.status !== "pending" || actionPendingId === model.id}
                          onClick={() => {
                            setRejectTarget(model);
                            setRejectReason("");
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-400/15 px-3 text-xs text-amber-200 transition-colors hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          驳回
                        </button>
                        <button
                          type="button"
                          disabled={actionPendingId === model.id}
                          onClick={() => {
                            setDeleteTarget(model);
                            setDeleteReason("");
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rose-400/15 px-3 text-xs text-rose-200 transition-colors hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
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

      {detailOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm"
          onClick={() => {
            if (!detailLoading) setDetailOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#111111] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                  模型详情
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  {detail?.title ?? "正在加载..."}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-white/50">
                <Loader2 className="h-5 w-5 animate-spin" />
                正在加载模型详情...
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/25">
                    {detail.coverUrl ? (
                      <Image
                        src={detail.coverUrl}
                        alt={detail.title}
                        width={640}
                        height={480}
                        className="aspect-[4/3] h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-white/[0.04] text-sm text-white/35">
                        暂无封面
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${badgeClass(detail.status)}`}>
                        {getStatusLabel(detail.status)}
                      </span>
                      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65">
                        {getVisibilityLabel(detail.visibility)}
                      </span>
                      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65">
                        作者：{detail.author || "-"}
                      </span>
                    </div>

                    <div className="mt-5">
                      <MetaRow label="模型 ID" value={detail.id} />
                      <MetaRow label="类型" value={detail.type} />
                      <MetaRow label="分类" value={detail.category?.name ?? "-"} />
                      <MetaRow label="浏览量" value={detail.viewsCount} />
                      <MetaRow label="点赞数" value={detail.likesCount} />
                      <MetaRow label="收藏数" value={detail.favoritesCount} />
                      <MetaRow label="创建时间" value={toDateTimeText(detail.createdAt)} />
                      <MetaRow label="更新时间" value={toDateTimeText(detail.updatedAt)} />
                      <MetaRow label="Viewer" value={detail.viewerType} />
                      <MetaRow label="模型地址" value={detail.viewerUrl ?? "-"} />
                      <MetaRow label="驳回原因" value={detail.rejectReason ?? "-"} />
                      <MetaRow label="删除原因" value={detail.deleteReason ?? "-"} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="text-sm font-medium text-white/88">模型描述</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/62">
                    {detail.description || "暂无描述"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {approveTarget && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm"
          onClick={() => {
            if (actionPendingId == null) setApproveTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111111] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">审核通过</p>
            <h3 className="mt-3 text-xl font-semibold">确认发布该模型？</h3>
            <p className="mt-3 text-sm leading-7 text-white/55">
              仅 <code>pending</code> 状态模型允许审核通过。确认后将调用
              <code>PATCH /api/admin/models/{approveTarget.id}/status</code>。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={actionPendingId != null}
                onClick={() => setApproveTarget(null)}
                className="h-11 rounded-full border border-white/12 px-5 text-sm text-white transition-colors hover:bg-white/[0.05] disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                disabled={actionPendingId != null}
                onClick={handleApprove}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-300/10 px-5 text-sm text-emerald-100 transition-colors hover:bg-emerald-300/15 disabled:opacity-40"
              >
                {actionPendingId === approveTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm"
          onClick={() => {
            if (actionPendingId == null) {
              setRejectTarget(null);
              setRejectReason("");
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#111111] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">驳回模型</p>
            <h3 className="mt-3 text-xl font-semibold">填写驳回原因</h3>
            <p className="mt-3 text-sm leading-7 text-white/55">
              后端要求 <code>action=reject</code> 时必须传入 <code>rejectReason</code>。
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              maxLength={500}
              placeholder="请输入驳回原因"
              className="mt-5 min-h-[140px] w-full rounded-[24px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/20"
            />
            <div className="mt-2 text-right text-xs text-white/35">{rejectReason.length}/500</div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={actionPendingId != null}
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="h-11 rounded-full border border-white/12 px-5 text-sm text-white transition-colors hover:bg-white/[0.05] disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                disabled={actionPendingId != null}
                onClick={handleReject}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-400/15 bg-amber-300/10 px-5 text-sm text-amber-100 transition-colors hover:bg-amber-300/15 disabled:opacity-40"
              >
                {actionPendingId === rejectTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm"
          onClick={() => {
            if (actionPendingId == null) {
              setDeleteTarget(null);
              setDeleteReason("");
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#111111] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">软删除模型</p>
            <h3 className="mt-3 text-xl font-semibold">确认删除“{deleteTarget.title}”？</h3>
            <p className="mt-3 text-sm leading-7 text-white/55">
              本操作调用 <code>DELETE /api/admin/models/{deleteTarget.id}</code>，当前仅做软删除；
              模型记录会隐藏，但 OSS / R2 文件不会立即删除。
            </p>
            <textarea
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              maxLength={500}
              placeholder="可选：填写删除原因"
              className="mt-5 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/20"
            />
            <div className="mt-2 text-right text-xs text-white/35">{deleteReason.length}/500</div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={actionPendingId != null}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteReason("");
                }}
                className="h-11 rounded-full border border-white/12 px-5 text-sm text-white transition-colors hover:bg-white/[0.05] disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                disabled={actionPendingId != null}
                onClick={handleDelete}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-rose-400/15 bg-rose-300/10 px-5 text-sm text-rose-100 transition-colors hover:bg-rose-300/15 disabled:opacity-40"
              >
                {actionPendingId === deleteTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
