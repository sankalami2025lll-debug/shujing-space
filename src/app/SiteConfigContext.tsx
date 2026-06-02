/**
 * 模块：全站站点配置上下文 SiteConfigContext
 * 用途：集中拉取并缓存站点配置（联系方式 / 公司名 / 版权 / 备案号），供各页面 Footer 与联系我们侧栏复用。
 * 主要功能：
 *   1. 启动拉取：挂载时调用 GET /api/site-config 一次，全站共享，避免每个 Footer 各自请求。
 *   2. 默认值兜底：初始值与各页 Footer 现有写死文案一致；接口失败或未加载完成时保持默认，避免空白闪烁/视觉回归。
 * 对应后端：SiteConfigModule（GET /api/site-config 返回 phone/email/address/icp/companyName/footerText）。
 * 说明：本上下文为只读展示；后台维护配置走 admin 接口，不在前端。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSiteConfig } from "../lib/api/siteConfig";
import type { SiteConfig } from "../lib/types";

// DEFAULT_SITE_CONFIG：默认站点配置，取自各页 Footer 现有写死文案。
//   作为接口未加载完成 / 异常时的兜底，保证显示与改造前完全一致（电话/邮箱/地址沿用「请填写」占位）。
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  phone: "请填写",
  email: "请填写",
  address: "请填写",
  icp: "", // 备案号默认空，空值时各 Footer 不渲染备案行
  companyName: "数境空间（深圳）科技有限公司",
  footerText: "© 2026 数境空间（深圳）科技有限公司 All Rights Reserved.",
};

// SiteConfigContextValue：上下文对外暴露的配置与加载态。
interface SiteConfigContextValue {
  config: SiteConfig; // 当前站点配置（始终有值，未加载/失败时为默认值）
  loading: boolean; // 是否正在首次拉取
}

const SiteConfigContext = createContext<SiteConfigContextValue | null>(null);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  // config：站点配置，初始用默认值兜底；loading：首次拉取中
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);

  // 启动拉取：仅首次挂载执行一次；失败静默保持默认值（不打断页面、不弹错）
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getSiteConfig();
        if (active && data) {
          // 后端可能返回空串字段，逐项以默认值兜底，避免出现空白联系方式 / 公司名
          setConfig({
            phone: data.phone || DEFAULT_SITE_CONFIG.phone,
            email: data.email || DEFAULT_SITE_CONFIG.email,
            address: data.address || DEFAULT_SITE_CONFIG.address,
            icp: data.icp || DEFAULT_SITE_CONFIG.icp,
            companyName: data.companyName || DEFAULT_SITE_CONFIG.companyName,
            footerText: data.footerText || DEFAULT_SITE_CONFIG.footerText,
          });
        }
      } catch {
        // 接口异常（后端未启动 / 网络失败）时保持默认值，Footer 显示与改造前一致
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, loading }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

// useSiteConfig：在组件内读取站点配置；必须在 SiteConfigProvider 内使用。
//   返回的 config 始终有值（默认值兜底），调用方可直接渲染，无需判空。
export function useSiteConfig(): SiteConfigContextValue {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) {
    throw new Error("useSiteConfig 必须在 <SiteConfigProvider> 内部使用");
  }
  return ctx;
}
