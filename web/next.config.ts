import type { NextConfig } from "next";
import path from "path";

/**
 * Next.js 配置：本地开发时将 /api 代理到 NestJS 后端（4000），与 Vite vite.config.ts proxy 行为一致。
 * 生产环境由 Cloudflare / 反向代理处理 API，不在此处写死 localhost。
 */
const nextConfig: NextConfig = {
  // 避免 monorepo 多 lockfile 时 Next 误推断 workspace 根目录
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:4000/api/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
