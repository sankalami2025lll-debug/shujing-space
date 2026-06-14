/**
 * 模块：环境变量校验
 * 用途：服务启动时校验关键环境变量是否合法，避免缺失/格式错误导致运行期才暴露问题。
 * 说明：本步脚手架只校验基础字段；后续模块（JWT/对象存储/短信）字段在对应阶段加入校验。
 */
import { z } from 'zod';

// —— JWT 生产密钥安全阈值与黑名单（上线前安全修复 2A）——
// 生产环境最小密钥长度，低于此值视为弱密钥，拒绝启动。
const JWT_SECRET_MIN_LENGTH = 32;
// 明确的开发/占位密钥黑名单（精确匹配）：禁止其进入生产。
const JWT_SECRET_BLOCKLIST = [
  'replace_me_access',
  'replace_me_refresh',
  'dev_only_access_secret_change_in_production_0a1b2c3d4e5f',
];
// 明显的开发占位关键词（包含匹配）：命中即视为非生产密钥。
const JWT_SECRET_DEV_KEYWORDS = [
  'dev_only',
  'change_in_production',
  'replace_me',
];

// 环境变量 schema：定义类型与默认值
const envSchema = z.object({
  // 运行环境
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  // 服务监听端口
  PORT: z.coerce.number().int().positive().default(4000),
  // PostgreSQL 连接串（Prisma 使用）
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
  // 允许的前端来源，逗号分隔
  // 开发环境默认放行 localhost:5173（Vite）和 localhost:3000（Next.js）；
  // 生产环境必须显式配置，缺失将阻止启动（见下方 superRefine）。
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  // 是否启用 Swagger 文档
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('true'),
  // —— JWT 鉴权（第 4 步 认证模块）——
  // 访问令牌密钥：开发仅要求非空；生产额外强校验长度与禁用 dev 占位（见下方 superRefine）。
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET 不能为空'),
  // 访问令牌有效期（如 2h / 30m），默认 2h
  JWT_ACCESS_EXPIRES: z.string().default('2h'),
  // —— 对象存储驱动（第 6 步 上传模块）——
  STORAGE_DRIVER: z.enum(['oss-compatible', 'oss']).default('oss'),
  // —— 阿里云 OSS / OSS 兼容对象存储（第 6 步 上传模块）——
  // 说明：开发环境允许为空（不阻断启动），缺失时由具体存储服务在调用时抛清晰错误；
  //       生产应在部署环境注入真实值。一律不落服务器本地磁盘。
  OSS_ACCESS_KEY_ID: z.string().default(''),
  OSS_ACCESS_KEY_SECRET: z.string().default(''),
  OSS_BUCKET: z.string().default('shujing-dev'),
  // OSS region 形如 oss-cn-shenzhen；S3 兼容端点可按服务商要求填写真实地域。
  OSS_REGION: z.string().default(''),
  // 完整 endpoint，例如 https://oss-cn-shenzhen.aliyuncs.com 或 S3 兼容 endpoint。
  OSS_ENDPOINT: z.string().default(''),
  // S3 兼容驱动下，阿里云 OSS 一般为 false（virtual-hosted style）。
  OSS_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false'),
  OSS_PUBLIC_BASE: z.string().default(''),
  // 预签名 PUT 有效期（秒），默认 600（10 分钟）
  OSS_PRESIGN_EXPIRES: z.coerce.number().int().positive().default(900),
  // —— 上传大小上限（MB）——
  MAX_MODEL_SIZE_MB: z.coerce.number().int().positive().default(500),
  MAX_COVER_SIZE_MB: z.coerce.number().int().positive().default(5),
  // —— viewerUrl 域名白名单（上线前安全修复 2D）——
  // 逗号分隔的允许 host 列表（只写 host，不写完整 URL，例如 sketchfab.com,lcc-viewer.xgrids.cloud）；
  // 为空时由 configuration 回退到默认安全列表（DEFAULT_VIEWER_ALLOWED_HOSTS）。
  VIEWER_URL_ALLOWED_HOSTS: z.string().default(''),
})
  // —— 生产环境 JWT 密钥强校验（上线前安全修复 2A）——
  // 仅在 NODE_ENV=production 下生效；开发/测试环境保持兼容，不影响本地 pnpm dev。
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const secret = env.JWT_ACCESS_SECRET;
    // 1) 禁止使用已知 dev / 占位默认值（精确匹配）
    if (JWT_SECRET_BLOCKLIST.includes(secret)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message:
          '生产环境禁止使用开发/占位 JWT_ACCESS_SECRET，请改用随机长串（≥32 字符）',
      });
      return;
    }
    // 2) 禁止包含明显的开发占位关键词
    const hitKeyword = JWT_SECRET_DEV_KEYWORDS.find((kw) =>
      secret.includes(kw),
    );
    if (hitKeyword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: `生产环境 JWT_ACCESS_SECRET 不能包含开发占位词「${hitKeyword}」，请改用随机长串`,
      });
    }
    // 3) 长度下限校验（生产强制 ≥ 32）
    if (secret.length < JWT_SECRET_MIN_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: `生产环境 JWT_ACCESS_SECRET 长度须 ≥ ${JWT_SECRET_MIN_LENGTH}，当前为 ${secret.length}`,
      });
    }

    // 4) CORS_ORIGIN 生产强制校验：禁止为空或仅含空白
    //    生产环境必须显式配置前端域名，避免意外放通或使用开发默认值
    const corsOrigin = (env.CORS_ORIGIN ?? '').trim();
    if (!corsOrigin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message:
          '生产环境 CORS_ORIGIN 不能为空，请配置为前端正式域名，例如 https://shujingspace.com',
      });
    }
    // 5) CORS_ORIGIN 生产强制校验：禁止包含 localhost 或 127.0.0.1（排除误用开发默认值）
    if (
      corsOrigin.includes('localhost') ||
      corsOrigin.includes('127.0.0.1')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message:
          '生产环境 CORS_ORIGIN 不能包含 localhost 或 127.0.0.1，请配置为前端正式域名，例如 https://shujingspace.com',
      });
    }
  });

// 推导出的环境变量类型
export type AppEnv = z.infer<typeof envSchema>;

/**
 * 校验并返回标准化后的环境变量。
 * 由 ConfigModule 的 validate 调用；校验失败抛错并阻止启动。
 */
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    // 聚合所有校验错误，便于一眼定位
    const message = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`环境变量校验失败：${message}`);
  }
  return parsed.data;
}
