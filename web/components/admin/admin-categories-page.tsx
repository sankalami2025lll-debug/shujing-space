"use client";

/**
 * 组件：AdminCategoriesPage
 * 用途：后台分类管理页，支持分类列表、增改、启停与删除。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PencilLine, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "@/lib/api/admin-categories";
import { ApiError } from "@/lib/http";
import type {
  AdminCategory,
  CreateAdminCategoryPayload,
} from "@/lib/types";

interface CategoryFormState {
  name: string;
  slug: string;
  sort: string;
  isActive: boolean;
}

const EMPTY_FORM: CategoryFormState = {
  name: "",
  slug: "",
  sort: "0",
  isActive: true,
};

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

function activeBadgeClass(isActive: boolean): string {
  return isActive
    ? "border-emerald-400/20 bg-emerald-300/10 text-emerald-200"
    : "border-white/10 bg-white/[0.05] text-white/72";
}

function normalizeForm(form: CategoryFormState): CreateAdminCategoryPayload {
  const sortValue = Number(form.sort);
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    sort: Number.isFinite(sortValue) ? sortValue : 0,
    isActive: form.isActive,
  };
}

export function AdminCategoriesPage() {
  const [list, setList] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);

  const emptyMessage = useMemo(() => {
    if (error) return error;
    if (!loading && list.length === 0) return "当前暂无分类。";
    return null;
  }, [error, list.length, loading]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminCategories();
      setList(res);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "分类列表加载失败，请稍后重试。";
      setList([]);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openCreate = useCallback(() => {
    setEditorMode("create");
    setEditingCategory(null);
    setForm(EMPTY_FORM);
  }, []);

  const openEdit = useCallback((item: AdminCategory) => {
    setEditorMode("edit");
    setEditingCategory(item);
    setForm({
      name: item.name,
      slug: item.slug,
      sort: String(item.sort),
      isActive: item.isActive,
    });
  }, []);

  const closeEditor = useCallback(() => {
    if (submitting) return;
    setEditorMode(null);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
  }, [submitting]);

  const handleSubmit = useCallback(async () => {
    const payload = normalizeForm(form);
    if (!payload.name) {
      toast.error("请填写分类名称");
      return;
    }
    if (!payload.slug) {
      toast.error("请填写 slug");
      return;
    }

    setSubmitting(true);
    try {
      if (editorMode === "create") {
        const created = await createAdminCategory(payload);
        setList((prev) =>
          [...prev, created].sort((a, b) => a.sort - b.sort || a.id - b.id),
        );
        toast.success("分类已创建");
      } else if (editorMode === "edit" && editingCategory) {
        const updated = await updateAdminCategory(editingCategory.id, payload);
        setList((prev) =>
          prev
            .map((item) => (item.id === editingCategory.id ? updated : item))
            .sort((a, b) => a.sort - b.sort || a.id - b.id),
        );
        toast.success("分类已更新");
      }
      closeEditor();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "分类保存失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }, [closeEditor, editorMode, editingCategory, form]);

  const handleToggle = useCallback(async (item: AdminCategory) => {
    const nextIsActive = !item.isActive;
    const actionLabel = nextIsActive ? "启用" : "停用";
    if (
      !window.confirm(
        `确认${actionLabel}分类「${item.name}」吗？${nextIsActive ? "" : "停用后前台不会继续使用该分类。"}`
      )
    ) {
      return;
    }

    setTogglingId(item.id);
    try {
      const updated = await updateAdminCategory(item.id, { isActive: nextIsActive });
      setList((prev) =>
        prev
          .map((row) => (row.id === item.id ? updated : row))
          .sort((a, b) => a.sort - b.sort || a.id - b.id),
      );
      toast.success(`分类已${actionLabel}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : `分类${actionLabel}失败，请稍后重试。`);
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (item: AdminCategory) => {
    if (!window.confirm(`确认删除分类「${item.name}」吗？此操作不可撤销。`)) {
      return;
    }

    setDeletingId(item.id);
    try {
      await deleteAdminCategory(item.id);
      setList((prev) => prev.filter((row) => row.id !== item.id));
      toast.success("分类已删除");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "分类删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[#121212] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
              Admin / Categories
            </p>
            <h1 className="mt-3 text-3xl font-semibold">分类管理</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              当前页已接入 <code>/api/admin/categories</code>，支持分类列表、新增、编辑、启停和删除未引用分类。
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 px-5 text-sm text-white transition-colors hover:bg-white/[0.05]"
          >
            <Plus className="h-4 w-4" />
            新增分类
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#121212]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
          <div className="text-sm text-white/72">
            共 <span className="font-medium text-white">{list.length}</span> 个分类
          </div>
          <div className="text-xs text-white/40">被模型引用的分类删除时将直接展示后端错误 message</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full">
            <thead className="bg-black/20">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-white/35">
                {["ID", "分类名称", "Slug", "排序", "状态", "模型数", "更新时间", "操作"].map((label) => (
                  <th key={label} className="px-4 py-4 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16">
                    <div className="flex items-center justify-center gap-3 text-sm text-white/50">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      正在加载分类列表...
                    </div>
                  </td>
                </tr>
              ) : emptyMessage ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-white/45">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr key={item.id} className="border-t border-white/6 text-sm text-white/78">
                    <td className="px-4 py-4 font-mono text-xs text-white/55">{item.id}</td>
                    <td className="px-4 py-4 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-4 text-white/62">{item.slug}</td>
                    <td className="px-4 py-4">{item.sort}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${activeBadgeClass(item.isActive)}`}>
                        {item.isActive ? "启用" : "停用"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{item.modelCount ?? 0}</td>
                    <td className="px-4 py-4 text-white/50">{toDateTimeText(item.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 text-xs text-white transition-colors hover:bg-white/[0.05]"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          编辑
                        </button>
                        <button
                          type="button"
                          disabled={togglingId === item.id}
                          onClick={() => handleToggle(item)}
                          className="inline-flex h-9 items-center rounded-full border border-white/12 px-3 text-xs text-white transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {togglingId === item.id ? "处理中..." : item.isActive ? "停用" : "启用"}
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rose-300/15 px-3 text-xs text-rose-200 transition-colors hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === item.id ? "删除中..." : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editorMode && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm"
          onClick={closeEditor}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#111111] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                  {editorMode === "create" ? "新增分类" : "编辑分类"}
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  {editorMode === "create" ? "创建新分类" : editingCategory?.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-white/65">分类名称</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="例如：实景三维"
                  className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/28"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-white/65">Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, slug: event.target.value }))
                  }
                  placeholder="例如：reality-3d"
                  className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/28"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-white/65">排序</span>
                <input
                  value={form.sort}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, sort: event.target.value }))
                  }
                  placeholder="0"
                  inputMode="numeric"
                  className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/28"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-white/20 bg-black/30"
                />
                <span className="text-sm text-white/72">创建后立即启用</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                disabled={submitting}
                className="h-11 rounded-2xl border border-white/10 px-5 text-sm text-white/72 transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-11 rounded-2xl border border-white/12 px-5 text-sm text-white transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "保存中..." : "保存分类"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
