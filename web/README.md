# 数境空间官网 · Next.js 前端（web/）

> 目标生产前端；当前 Vite 原型 `src/` 仍为 UI 验收基准，迁移完成前不得删除。

## 迁移阶段 0–4A（当前）

- Next.js App Router 骨架
- Tailwind CSS 4 + `@/*` 路径别名
- `lib/http.ts` 等最小 API 网络层（自 Vite `src/lib/` 平移）
- 全站 `AppProviders`（Auth + SiteConfig + Theme + Toaster）
- 全站 `NavBar` + **`/about`**、**`/contact`（含表单 API）**、**`/auth`（独立顶栏 + 认证 API）** 正式 UI；`/`、`/models`、`/community` 仍为占位
- 本地 dev：`/api` → `http://localhost:4000/api`（见 `next.config.ts` rewrites）

## 本地开发

```bash
# 1. 启动 Postgres + 后端（见 deploy/ 与 server/）
# 2. web/ 目录
cp .env.example .env.local   # 可选，默认 NEXT_PUBLIC_API_BASE_URL=/api
pnpm install
pnpm dev                     # http://localhost:3000
pnpm build
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | API 基址，本地推荐 `/api` |
