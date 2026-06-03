/**
 * 模块：后台站点配置接口封装 admin-site-config.ts
 * 用途：封装 /api/admin/site-config 的读取与保存。
 */
import { http } from "../http";
import type { SiteConfig, UpdateAdminSiteConfigPayload } from "../types";

export function getAdminSiteConfig(): Promise<SiteConfig> {
  return http.get<SiteConfig>("/admin/site-config");
}

export function updateAdminSiteConfig(
  payload: UpdateAdminSiteConfigPayload,
): Promise<SiteConfig> {
  return http.put<SiteConfig>("/admin/site-config", payload);
}
