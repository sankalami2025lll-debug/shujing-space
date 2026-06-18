---
description: 
alwaysApply: true
---

# 数境空间官网开发 Agent 总规则

项目：数境空间官网 / Figma 当前导出版本  
文档源：`页面功能注释文档/` 目录中的每页 Markdown 为页面功能与交互的第一依据。

Agent 协作文件布局见 `.cursor/skills/shujing-space-agent-guide/SKILL.md`。

## 最终技术栈（已确定）

> 架构与部署的第一依据见 `docs/backend-architecture-plan.md`，与历史设想不一致处以该文档为准。

| 层 | 选型 |
|---|---|
| 前端（目标） | **Next.js**（React + TypeScript + Tailwind CSS + shadcn/ui + lucide-react） |
| 前端（当前） | **Vite + React 18 + TS（UI 原型基准，见下）** |
| 后端 | **Node.js + NestJS（TypeScript）** |
| 数据库 | **PostgreSQL**（ORM 用 Prisma） |
| 对象存储 | **OSS**（模型文件 / 图片 / 视频全部存 OSS，禁止落服务器本地） |
| CDN / DNS / SSL / 安全 | **Cloudflare** |
| 服务器系统 | **Ubuntu 22.04 LTS** |
| 运维面板 | **1Panel** |
| 部署方式 | **Docker / Docker Compose（所有服务一律容器化）** |
| 架构形态 | **前后端分离** |

### 当前 Vite 前端 = UI 原型基准

- `src/` 下的 Vite + React 前端是 **Figma 导出后的 UI 原型基准**：定义视觉风格、页面层级、中文文案与交互逻辑，是 Next.js 版本的唯一还原依据。
- 后续需**迁移为 Next.js**（迁移时保持 UI/文案/交互不变）；在 Next.js 版本上线并验收前，**Vite 原型仍是验收基准，不得删除**。

### 部署与数据红线

- 模型文件、图片、视频**必须上传 OSS**，**不得存服务器本地磁盘**。
- 数据库只保存：文件 URL、模型信息、用户信息、业务数据。
- 后台管理需覆盖：模型审核、用户管理、分类管理、数据服务申请管理、联系表单管理。
- 所有密钥（OSS / 数据库 / JWT / 短信 / Cloudflare Token）只放服务器环境变量或容器注入，**严禁进仓库**。

## 开发顺序

1. 先读 `页面功能注释文档/00_文档索引.md`。
2. 再读当前任务对应页面文档，例如首页读 `02_首页_Home.md`。
3. 再读相关源码文件，例如 `src/app/App.tsx`、`src/app/NavBar.tsx`。
4. 开始编码前先列出：要改哪些文件、为什么改、是否影响其它页面。
5. 每次只完成一个明确任务，避免一次性重构全项目。

## 最高优先级

- 不得随意改变 Figma 当前导出版本的视觉风格、页面层级、文案语气和交互逻辑。
- 不得把页面做成通用模板站；必须围绕「数境空间：实景三维 / BIM / 构件级模型 / 模型社区 / 机器人训练场景数据服务」。
- 新增页面、组件、接口前，必须先确认现有文件中是否已有对应实现。
- 所有关键组件、状态、表单、接口调用位置必须写中文注释。

## 输出要求

- 优先保持 TypeScript 类型清晰。
- UI 组件优先复用已有 `src/app/components/ui/`。
- 样式优先使用 Tailwind class，不要大量写散乱 CSS。
- 每个页面完成后执行构建检查：`pnpm build`。

## Cursor Cloud specific instructions

本仓库为**多应用同仓**（非 pnpm workspace 单体）：根目录 Vite 原型、`web/` Next.js、`server/` NestJS。全栈本地联调见 `docs/dev-checkpoint.md`。

### 依赖与质量门禁（命令出处见各 `package.json`）

| 位置 | dev | build | lint | test |
|------|-----|-------|------|------|
| 仓库根（Vite） | `pnpm dev` → :5173 | `pnpm build` | 无 | 无 |
| `web/` | `pnpm dev` → :3000 | `pnpm build` | `pnpm lint` | 无 |
| `server/` | `pnpm dev` → :4000 | `pnpm build` | `pnpm lint` | `pnpm test` |

### 首次在本机/Cloud VM 起库（非 update_script）

1. **Docker 引擎**：Cloud VM 若 `docker ps` 报权限或 daemon 未起，需已安装 Docker 且 `dockerd` 运行；开发库使用 `fuse-overlayfs`（见 `/etc/docker/daemon.json`）。socket 权限问题可临时 `sudo chmod 666 /var/run/docker.sock`（仅开发环境）。
2. **PostgreSQL**：仓库根执行 `docker compose -f deploy/docker-compose.dev.yml up -d`（仅 :5432，见 `deploy/README.md`）。
3. **后端环境**：`cp server/.env.example server/.env`（若尚无 `.env`）；`cd server && pnpm prisma:migrate`（或 `prisma migrate dev`）；可选 `pnpm prisma:seed` 写入演示模型。
4. **R2**：未配置 `R2_*` 时上传相关接口可能 503；浏览列表/详情不依赖 R2。

### 日常启动服务（用 tmux 保持后台）

```bash
# 终端 1
cd server && pnpm dev

# 终端 2
cd web && pnpm dev
```

- 健康检查：`curl http://localhost:4000/api/health`（`db: up` 表示已连 PostgreSQL）。
- Next dev 将 `/api` 反代到 :4000（`web/next.config.ts`）。
- Vite 原型（:5173）同样将 `/api` 代理到 :4000，作 UI 对照基准，**不要删除**。

### 样式/缓存

Next 全局样式大改后若未生效：结束占用 3000 的 `next dev` → 删除 `web/.next` → 重新 `pnpm dev` → 浏览器硬刷新。
