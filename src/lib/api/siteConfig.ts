/**
 * 模块：站点配置接口封装 api/siteConfig.ts
 * 用途：封装 GET /api/site-config（公开接口），既用于本步网络层连通性验证，也供后续 Footer/联系方式接入复用。
 * 对应后端：SiteConfigModule（GET /api/site-config 返回 phone/email/address/icp/companyName/footerText）。
 */
import { http } from "../http";
import type { SiteConfig } from "../types";

// getSiteConfig：拉取全站配置；公开接口无需登录（auth:false 避免无谓携带 token）。
export function getSiteConfig(): Promise<SiteConfig> {
  return http.get<SiteConfig>("/site-config", { auth: false });
}
