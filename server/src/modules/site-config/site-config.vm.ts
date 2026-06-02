/**
 * 视图模型 / 映射：站点配置接口对外字段
 * 用途：把 site_configs 表的 key/value 行整形为前端易用的对象（白名单字段，缺失回退默认值）。
 * 约定：
 *  - SiteConfigVm：公开 / 后台读取统一返回结构，含全部 6 个白名单字段。
 *  - 不下发 DB 中白名单之外的任意键，杜绝泄露。
 */
import { SiteConfig } from '@prisma/client';
import { SITE_CONFIG_DEF_BY_DBKEY, SITE_CONFIG_FIELD_DEFS } from './site-config.constants';

// 站点配置对外结构（6 个白名单字段，键名与 SITE_CONFIG_FIELD_DEFS.field 一致）
export interface SiteConfigVm {
  phone: string;
  email: string;
  address: string;
  icp: string;
  companyName: string;
  footerText: string;
}

/**
 * DB 行集合 → 对外整形对象。
 * 先用各字段默认值兜底，再用库中实际值覆盖（仅覆盖白名单内的键）。
 */
export function toSiteConfigVm(rows: SiteConfig[]): SiteConfigVm {
  // 1. 默认值兜底
  const result: Record<string, string> = {};
  for (const def of SITE_CONFIG_FIELD_DEFS) {
    result[def.field] = def.defaultValue;
  }
  // 2. 用库中实际值覆盖（忽略白名单外的键）
  for (const row of rows) {
    const def = SITE_CONFIG_DEF_BY_DBKEY.get(row.key);
    if (def) {
      result[def.field] = row.value;
    }
  }
  return result as unknown as SiteConfigVm;
}
