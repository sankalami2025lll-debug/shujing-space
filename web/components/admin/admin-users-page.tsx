"use client";

/**
 * 组件：AdminUsersPage
 * 用途：后台用户管理页，支持列表、筛选、分页与状态/角色调整。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { getAdminUsers, updateAdminUserStatus } from "@/lib/api/admin-users";
import { ApiError } from "@/lib/http";
import type { AdminUser, UserRole, UserStatus } from "@/lib/types";

const PAGE_SIZE = 10;

const ROLE_OPTIONS: Array<{ value: UserRole | "all"; label: string }> = [
  { value: "all", label: "全部角色" },
  { value: "admin", label: "管理员" },
  { value: "user", label: "普通用户" },
];

const STATUS_OPTIONS: Array<{ value: UserStatus | "all"; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "启用" },
  { value: "disabled", label: "禁用" },
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

function getRoleLabel(role: UserRole): string {
  return role === "admin" ? "管理员" : "普通用户";
}

function getStatusLabel(status: UserStatus): string {
  return status === "active" ? "启用" : "禁用";
}

function roleBadgeClass(role: UserRole): string {
  return role === "admin"
    ? "border-violet-400/20 bg-violet-300/10 text-violet-200"
    : "border-white/10 bg-white/[0.05] text-white/72";
}

function statusBadgeClass(status: UserStatus): string {
  return status === "active"
    ? "border-emerald-400/20 bg-emerald-300/10 text-emerald-200"
    : "border-rose-400/20 bg-rose-300/10 text-rose-200";
}

export function AdminUsersPage() {
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<number, UserRole>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<number, UserStatus>>({});
  const [pendingId, setPendingId] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const emptyMessage = useMemo(() => {
    if (error) return error;
    if (!loading && list.length === 0) return "当前筛选条件下暂无用户。";
    return null;
  }, [error, list.length, loading]);

  const loadList = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUsers({
        keyword: keyword || undefined,
        role,
        status,
        page,
        pageSize: PAGE_SIZE,
      });
      if (reqId !== requestIdRef.current) return;
      setList(res.list);
      setTotal(res.total);
      setDraftRoles(Object.fromEntries(res.list.map((item) => [item.id, item.role])));
      setDraftStatuses(
        Object.fromEntries(res.list.map((item) => [item.id, item.status])),
      );
    } catch (e) {
      if (reqId !== requestIdRef.current) return;
      const message = e instanceof ApiError ? e.message : "用户列表加载失败，请稍后重试。";
      setList([]);
      setTotal(0);
      setError(message);
      toast.error(message);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [keyword, page, role, status]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSearch = useCallback(() => {
    setPage(1);
    setKeyword(keywordInput.trim());
  }, [keywordInput]);

  const handleUpdate = useCallback(
    async (item: AdminUser) => {
      const nextRole = draftRoles[item.id] ?? item.role;
      const nextStatus = draftStatuses[item.id] ?? item.status;
      if (nextRole === item.role && nextStatus === item.status) return;
      const roleChanged = nextRole !== item.role;

      const isDangerous = item.status !== nextStatus && nextStatus === "disabled";
      if (
        isDangerous &&
        !window.confirm(`确认禁用用户「${item.nickname}」吗？后端仍会做最终权限校验。`)
      ) {
        return;
      }

      setPendingId(item.id);
      try {
        const updated = await updateAdminUserStatus(item.id, {
          ...(nextRole !== item.role ? { role: nextRole } : {}),
          ...(nextStatus !== item.status ? { status: nextStatus } : {}),
        });
        setList((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)),
        );
        setDraftRoles((prev) => ({ ...prev, [item.id]: updated.role }));
        setDraftStatuses((prev) => ({ ...prev, [item.id]: updated.status }));
        toast.success(
          roleChanged
            ? "角色已更新，对方需退出并重新登录后生效"
            : "用户状态已更新",
        );
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "用户状态更新失败，请稍后重试。");
      } finally {
        setPendingId(null);
      }
    },
    [draftRoles, draftStatuses],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[#121212] p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
              Admin / Users
            </p>
            <h1 className="mt-3 text-3xl font-semibold">用户管理</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              当前页已接入 <code>/api/admin/users</code>，支持搜索、角色筛选、状态筛选与行内更新。列表字段已脱敏，不显示 <code>passwordHash</code>。
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/42">搜索用户</span>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4">
                <Search className="h-4 w-4 text-white/35" />
                <input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSearch();
                  }}
                  placeholder="昵称 / 手机 / 邮箱"
                  className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/42">角色筛选</span>
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as UserRole | "all");
                  setPage(1);
                }}
                className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#101010]">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/42">状态筛选</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as UserStatus | "all");
                  setPage(1);
                }}
                className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#101010]">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleSearch}
              className="h-11 self-end rounded-2xl border border-white/12 px-5 text-sm text-white transition-colors hover:bg-white/[0.05]"
            >
              搜索
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#121212]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
          <div className="text-sm text-white/72">
            共 <span className="font-medium text-white">{total}</span> 位用户
          </div>
          <div className="text-xs text-white/40">用户更新由后端继续限制不能禁用或降级当前管理员自己</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1240px] w-full">
            <thead className="bg-black/20">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-white/35">
                {["ID", "昵称", "手机", "邮箱", "公司", "角色", "状态", "创建时间", "操作"].map((label) => (
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
                      正在加载用户列表...
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
                list.map((item) => {
                  const nextRole = draftRoles[item.id] ?? item.role;
                  const nextStatus = draftStatuses[item.id] ?? item.status;
                  const changed = nextRole !== item.role || nextStatus !== item.status;
                  return (
                    <tr key={item.id} className="border-t border-white/6 text-sm text-white/78">
                      <td className="px-4 py-4 font-mono text-xs text-white/55">{item.id}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">{item.nickname}</div>
                        <div className="mt-1 text-xs text-white/42">
                          {item.roleType || "未填写角色类型"}
                        </div>
                      </td>
                      <td className="px-4 py-4">{item.phone ?? "-"}</td>
                      <td className="px-4 py-4">{item.email ?? "-"}</td>
                      <td className="px-4 py-4 text-white/62">{item.company ?? "-"}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${roleBadgeClass(item.role)}`}>
                          {getRoleLabel(item.role)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusBadgeClass(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/50">{toDateTimeText(item.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={nextRole}
                            onChange={(event) =>
                              setDraftRoles((prev) => ({
                                ...prev,
                                [item.id]: event.target.value as UserRole,
                              }))
                            }
                            disabled={pendingId === item.id}
                            className="h-9 rounded-full border border-white/10 bg-black/30 px-3 text-xs text-white outline-none"
                          >
                            {ROLE_OPTIONS.filter((option) => option.value !== "all").map(
                              (option) => (
                                <option key={option.value} value={option.value} className="bg-[#101010]">
                                  {option.label}
                                </option>
                              ),
                            )}
                          </select>
                          <select
                            value={nextStatus}
                            onChange={(event) =>
                              setDraftStatuses((prev) => ({
                                ...prev,
                                [item.id]: event.target.value as UserStatus,
                              }))
                            }
                            disabled={pendingId === item.id}
                            className="h-9 rounded-full border border-white/10 bg-black/30 px-3 text-xs text-white outline-none"
                          >
                            {STATUS_OPTIONS.filter((option) => option.value !== "all").map(
                              (option) => (
                                <option key={option.value} value={option.value} className="bg-[#101010]">
                                  {option.label}
                                </option>
                              ),
                            )}
                          </select>
                          <button
                            type="button"
                            disabled={!changed || pendingId === item.id}
                            onClick={() => handleUpdate(item)}
                            className="inline-flex h-9 items-center rounded-full border border-white/12 px-3 text-xs text-white transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {pendingId === item.id ? "更新中..." : "保存"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
    </div>
  );
}
