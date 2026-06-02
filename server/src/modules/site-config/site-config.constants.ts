/**
 * 常量：站点配置白名单与字段映射（单一数据源）
 * 用途：定义对外公开的站点配置项，及「公开字段名 ↔ 数据库 key ↔ 默认值」三者映射。
 * 说明：
 *  - field：前端使用的对外字段名（camelCase，GET /api/site-config 返回的键）。
 *  - dbKey：site_configs 表主键（snake_case），与 seed 中已有键对齐（contact_phone 等）。
 *  - defaultValue：库中无该键时的回退值，保证前端字段恒在、不为 undefined。
 *  - PUT 仅允许更新 field 白名单内的项，杜绝任意键注入。
 * 默认值取自前端 Footer 现有写死文案，确保首次读取即为合理展示。
 */

// 站点配置项定义（公开字段名 ↔ DB 键 ↔ 默认值 ↔ 值长度上限）
export interface SiteConfigFieldDef {
  field: string; // 对外字段名（camelCase）
  dbKey: string; // site_configs 主键（snake_case）
  defaultValue: string; // 库中缺失时的回退值
  maxLength: number; // 值长度上限（PUT 校验用）
}

export const SITE_CONFIG_FIELD_DEFS: readonly SiteConfigFieldDef[] = [
  { field: 'phone', dbKey: 'contact_phone', defaultValue: '请填写', maxLength: 120 },
  { field: 'email', dbKey: 'contact_email', defaultValue: '请填写', maxLength: 120 },
  { field: 'address', dbKey: 'contact_address', defaultValue: '请填写', maxLength: 255 },
  { field: 'icp', dbKey: 'icp', defaultValue: '请填写', maxLength: 120 },
  {
    field: 'companyName',
    dbKey: 'company_name',
    defaultValue: '数境空间（深圳）科技有限公司',
    maxLength: 120,
  },
  {
    field: 'footerText',
    dbKey: 'footer_text',
    defaultValue: '© 2026 数境空间（深圳）科技有限公司 All Rights Reserved.',
    maxLength: 255,
  },
] as const;

// 对外字段名白名单（PUT items.key 的合法取值，DTO @IsIn 用）
export const SITE_CONFIG_FIELDS = SITE_CONFIG_FIELD_DEFS.map((d) => d.field);

// field → 定义 的快速索引
export const SITE_CONFIG_DEF_BY_FIELD = new Map<string, SiteConfigFieldDef>(
  SITE_CONFIG_FIELD_DEFS.map((d) => [d.field, d]),
);

// dbKey → 定义 的快速索引（读取时把 DB 行还原为对外字段）
export const SITE_CONFIG_DEF_BY_DBKEY = new Map<string, SiteConfigFieldDef>(
  SITE_CONFIG_FIELD_DEFS.map((d) => [d.dbKey, d]),
);
