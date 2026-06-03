"use client";

/**
 * 组件：AdminSiteConfigPage
 * 用途：后台站点配置页，支持读取和保存 6 个白名单字段。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminSiteConfig,
  updateAdminSiteConfig,
} from "@/lib/api/admin-site-config";
import { ApiError } from "@/lib/http";
import type { SiteConfig, SiteConfigFieldKey } from "@/lib/types";

const FIELD_CONFIGS: Array<{
  key: SiteConfigFieldKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: "phone", label: "联系电话", placeholder: "请输入联系电话" },
  { key: "email", label: "联系邮箱", placeholder: "请输入联系邮箱" },
  { key: "address", label: "联系地址", placeholder: "请输入联系地址", multiline: true },
  { key: "icp", label: "备案号", placeholder: "请输入备案号" },
  { key: "companyName", label: "公司名称", placeholder: "请输入公司名称" },
  { key: "footerText", label: "页脚文案", placeholder: "请输入页脚版权文案", multiline: true },
];

const EMPTY_CONFIG: SiteConfig = {
  phone: "",
  email: "",
  address: "",
  icp: "",
  companyName: "",
  footerText: "",
};

export function AdminSiteConfigPage() {
  const [form, setForm] = useState<SiteConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialConfig, setInitialConfig] = useState<SiteConfig>(EMPTY_CONFIG);

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialConfig),
    [form, initialConfig],
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminSiteConfig();
      setForm(res);
      setInitialConfig(res);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "站点配置加载失败，请稍后重试。";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        items: FIELD_CONFIGS.map((field) => ({
          key: field.key,
          value: form[field.key] ?? "",
        })),
      };
      const updated = await updateAdminSiteConfig(payload);
      setForm(updated);
      setInitialConfig(updated);
      toast.success("站点配置已保存");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "站点配置保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }, [form]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[#121212] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
              Admin / Site Config
            </p>
            <h1 className="mt-3 text-3xl font-semibold">站点配置</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              当前页已接入 <code>/api/admin/site-config</code>，仅允许编辑白名单字段：phone、email、address、icp、companyName、footerText。保存后前台 Footer 后续刷新即可读取新配置。
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !hasChanges}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/12 px-5 text-sm text-white transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#121212] p-6">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center gap-3 text-sm text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在读取站点配置...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : (
          <div className="grid gap-4">
            {FIELD_CONFIGS.map((field) => (
              <label
                key={field.key}
                className="grid gap-2 rounded-[24px] border border-white/8 bg-black/20 p-4"
              >
                <span className="text-sm text-white/68">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    value={form[field.key]}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    rows={field.key === "footerText" ? 3 : 4}
                    placeholder={field.placeholder}
                    className="min-h-[96px] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
                  />
                ) : (
                  <input
                    value={form[field.key]}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="h-11 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-white/28"
                  />
                )}
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
