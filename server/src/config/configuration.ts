/**
 * 模块：应用配置整理
 * 用途：把校验后的环境变量整理为结构化配置，供各模块通过 ConfigService 读取。
 */
import type { AppEnv } from './env.validation';
import { DEFAULT_VIEWER_ALLOWED_HOSTS } from '../modules/models/viewer-url.util';

// 把逗号分隔的来源字符串解析为数组
function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 配置工厂：ConfigModule.load 调用，返回结构化配置对象。
 * 注意：传入的 env 已由 validateEnv 标准化（含默认值）。
 */
export function configuration() {
  const env = process.env as unknown as AppEnv;
  return {
    nodeEnv: env.NODE_ENV,
    port: Number(env.PORT),
    // CORS 允许来源列表
    corsOrigins: parseOrigins(String(env.CORS_ORIGIN)),
    // Swagger 是否开启
    swaggerEnabled: String(env.SWAGGER_ENABLED) === 'true',
    database: {
      url: env.DATABASE_URL,
    },
    // JWT 鉴权配置（认证模块使用）
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessExpires: env.JWT_ACCESS_EXPIRES,
    },
    // Cloudflare R2 对象存储配置（上传模块使用；密钥仅来自环境变量，不入库）
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      endpoint: env.R2_ENDPOINT,
      publicBase: env.R2_PUBLIC_BASE,
      presignExpires: Number(env.R2_PRESIGN_EXPIRES),
    },
    // 上传大小上限（字节，由 MB 换算）
    upload: {
      maxModelBytes: Number(env.MAX_MODEL_SIZE_MB) * 1024 * 1024,
      maxCoverBytes: Number(env.MAX_COVER_SIZE_MB) * 1024 * 1024,
    },
    // viewerUrl 域名白名单（外链发布安全校验 2D）：
    //   env 配置优先；未配置（解析后为空）时回退默认安全列表，避免「空列表」歧义。
    viewer: {
      allowedHosts: (() => {
        const fromEnv = parseOrigins(String(env.VIEWER_URL_ALLOWED_HOSTS ?? ''));
        return fromEnv.length > 0 ? fromEnv : [...DEFAULT_VIEWER_ALLOWED_HOSTS];
      })(),
    },
  };
}

export type AppConfig = ReturnType<typeof configuration>;
