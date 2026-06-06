/**
 * 工具：viewerUrl 域名白名单校验（上线前安全修复 2D）
 * 用途：模型「外链发布」（POST /api/models 仅传 viewerUrl，不走对象存储文件）入库前，
 *       校验链接主机名是否在允许列表内，防止任意 https 外链被作为 iframe Viewer 内嵌。
 * 安全说明：
 *  - 仅基于 new URL() 解析出的 hostname 比对（小写、去末尾点），不做字符串 includes，
 *    杜绝 https://sketchfab.com.evil.com / https://evil.com/sketchfab.com /
 *    https://sketchfab.com@evil.com 等绕过手法。
 *  - 白名单条目支持两种形式：
 *      1) 精确主机：sketchfab.com（仅该主机命中；x.sketchfab.com 不命中）
 *      2) 通配子域：*.xgrids.cloud（命中裸域 xgrids.cloud 与任意层级子域，如 a.b.xgrids.cloud；
 *         但不命中 evilxgrids.cloud —— 必须等于 base 或以「.base」结尾）
 *  - 仅作用于外链发布分支，不影响 modelFileId / coverFileId 的对象存储发布路径，也不重校验历史数据。
 */

// 默认兜底白名单（VIEWER_URL_ALLOWED_HOSTS 未配置时使用）：
//   当前 seed 测试域名（sketchfab）+ 业务方 XGRIDS Viewer 域名。
//   作为白名单的「单一默认数据源」，env 配置优先于此。
export const DEFAULT_VIEWER_ALLOWED_HOSTS = [
  'sketchfab.com',
  'www.sketchfab.com',
  'lcc-viewer.xgrids.cloud',
];

// 规范化主机名：去首尾空白 + 小写 + 去末尾点（FQDN 末尾点）
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '');
}

// 单条白名单规则匹配：支持精确主机与 *.suffix 通配子域
function matchHost(host: string, rule: string): boolean {
  const r = normalizeHost(rule);
  if (!r) return false;
  // 通配子域形式 *.base：命中 base 本身或其任意子域
  if (r.startsWith('*.')) {
    const base = r.slice(2);
    if (!base) return false;
    return host === base || host.endsWith('.' + base);
  }
  // 精确主机：完全相等才命中
  return host === r;
}

/**
 * 判断 viewerUrl 是否允许入库。
 * @param viewerUrl 待校验链接（DTO 已限定 https，本函数再次解析并兜底校验协议）
 * @param allowedHosts 白名单（host 或 *.suffix 形式）
 * @returns 为 https 且 hostname 命中白名单返回 true，否则 false
 */
export function isViewerUrlAllowed(
  viewerUrl: string,
  allowedHosts: string[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(viewerUrl);
  } catch {
    return false; // 非法 URL 直接判不通过
  }
  // 协议兜底：仅允许 https（与 DTO 一致，双重保险）
  if (parsed.protocol !== 'https:') return false;
  const host = normalizeHost(parsed.hostname);
  if (!host) return false;
  return allowedHosts.some((rule) => matchHost(host, rule));
}
