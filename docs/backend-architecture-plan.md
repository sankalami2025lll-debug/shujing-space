# 数境空间官网 后端架构与部署方案（当前实现与生产目标）

> 更新日期：2026-06-14
> 状态：已按当前仓库实际实现重写；本文档为 `web/`、`server/`、对象存储、部署目标和接口口径的最新总说明。
> 适用：前后端开发、联调、部署运维、文档续写。
> 说明：项目当前同时保留根目录 `src/` Vite 原型与 `web/` Next.js 正式前端；文档统一使用 `OSS_* / objectKey / oss-compatible.service.ts` 作为当前对象存储命名，当前存储后端为 **阿里云 OSS**。

---

## 〇、当前技术栈总览

| 层 | 当前状态 | 说明 |
|---|---|---|
| 操作系统（生产目标） | Ubuntu 22.04 LTS | 生产部署基线 |
| 面板（生产目标） | 1Panel | 容器、日志、备份、站点反代 |
| 部署方式（生产目标） | Docker / Docker Compose | 前后端分离，容器化部署 |
| 前端（正式） | Next.js 15 + React 18 + TypeScript + Tailwind CSS 4 | 目录：`web/` |
| 前端（UI 基准） | Vite + React 18 + TypeScript | 目录：`src/`，作为视觉/文案/交互基准继续保留 |
| 后端 | NestJS 10 + TypeScript | 目录：`server/` |
| 数据库 | PostgreSQL | 业务主库 |
| ORM | Prisma | schema、迁移、seed |
| 对象存储 | 阿里云 OSS（S3 兼容接入） | 模型文件、封面、视频、LCC/LCC2 成果包均存 OSS，不落服务器本地 |
| CDN / DNS / SSL / 安全 | Cloudflare | 域名解析、SSL、WAF、边缘缓存 |
| 3D 原生查看 | LCC Web SDK 0.6.0 + Three.js | LCC / LCC2 当前走 `LccViewer` |
| 缓存（二期可选） | Redis | 验证码、限流、热点缓存 |

### 当前红线

1. **模型文件、封面图、视频、LCC/LCC2 解压结果一律存阿里云 OSS，不落服务器本地磁盘。**
2. **数据库只保存 URL / object key / 业务数据，不保存二进制。**
3. **前后端分离**：`web/` 负责页面与交互，`server/` 只提供 API。
4. **LCC/LCC2 入口规则已固定**：前端 `LccViewer` 直接使用 `.lcc / .lcc2` 入口文件 URL 作为 `dataPath`；不使用目录 `dataPath`，不依赖 `meta.lcc / meta.lcc2 / meta.splat`。
5. **环境变量文档口径说明**：当前文档统一使用 `OSS_*` 表示对象存储环境变量与配置项；实际代码若仍保留旧别名，也应按 OSS 兼容对象存储理解。

---

## 一、当前系统结构

```txt
公司官网首页设计/
├─ src/                       Vite 原型（UI 对照基准，继续保留）
├─ web/                       Next.js 15 正式前端
│  ├─ app/                    App Router 页面
│  ├─ components/             页面、布局、模型浏览器、后台组件
│  ├─ lib/api/                前端 API 客户端
│  └─ public/vendor/lcc-web/  LCC Web SDK 静态资源
├─ server/                    NestJS 后端
│  ├─ prisma/                 schema、迁移、seed、管理员初始化
│  └─ src/modules/            auth/models/uploads/admin/... 业务模块
├─ docs/                      当前说明文档
├─ 页面功能注释文档/          页面需求与交互依据
└─ LCC-Web-0.6.0/             官方 SDK 对照包
```

### 当前已落地模块

- `web/`：用户侧页面、后台页面壳子与多项管理页、模型详情页、LCC/LCC2 查看器接入。
- `server/`：认证、模型、分类、联系表单、训练申请、站点配置、上传、后台管理接口已落地。
- `uploads`：支持 **阿里云 OSS 直传**、回执登记、ZIP 成果包处理后回写模型地址。
- `models`：支持 `viewerUrl` 外链发布、普通文件发布、LCC/LCC2 ZIP 成果包发布。
- `LCC/LCC2`：真实 ZIP 已打通“上传记录 -> 解压 -> 上传 OSS -> 回写 `.lcc/.lcc2` 入口 URL -> 前端 LccViewer 浏览”。

### 当前未完全落地项

- 生产部署编排文件未在当前仓库形成最终版统一目录规范。
- Redis、监控告警、对象存储清理策略、物理删文件、完整线上部署文档仍属后续工作。
- 其他格式（GLB / PLY / IFC / RVT / OSGB）当前仍以占位 Viewer 或待接入状态为主，未全部实现真实在线引擎。

---

## 二、生产目标架构

```txt
                        [ Cloudflare ]
             DNS / CDN / SSL / WAF / 边缘缓存
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
   www.shujingspace.com  api.shujingspace.com  assets / OSS 公共域
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────────────────────────────────────────────┐
  │ Ubuntu 22.04 + 1Panel + Docker Compose              │
  │                                                      │
  │  web   : Next.js 15                                  │
  │  api   : NestJS 10                                   │
  │  db    : PostgreSQL                                  │
  │  cache : Redis（二期可选）                            │
  │  proxy : OpenResty / Nginx                           │
  └──────────────────────────────────────────────────────┘
                              │
                              ▼
                     阿里云 OSS Bucket
        模型文件 / 封面 / 视频 / LCC-LCC2 成果包 / 处理结果
```

### 要点

- 对外域名和 HTTPS 仍建议交给 Cloudflare。
- 大文件仍走“后端签名 / 前端直传 OSS”的模式，**文件不经过应用服务器，不落本地磁盘**。
- 数据库、JWT、OSS 密钥、短信密钥等只放服务器环境变量，不进仓库。
- OSS 可直接使用公共域访问，也可以后续再挂自定义域 + CDN。

---

## 三、对象存储现状（阿里云 OSS）

### 3.1 当前实现口径

- 当前对象存储实际使用：**阿里云 OSS**。
- 当前本地开发 `.env` 指向：
  - `OSS_ENDPOINT=https://s3.oss-cn-shenzhen.aliyuncs.com`
  - `OSS_PUBLIC_BASE=https://shujingspace.oss-cn-shenzhen.aliyuncs.com`
- 后端当前同时存在两种实现类：
  - `server/src/modules/uploads/oss.service.ts`：阿里云 OSS SDK 封装
  - `server/src/modules/uploads/oss-compatible.service.ts`：S3 兼容封装，现可用于 OSS 兼容接入
- **文档统一口径应视为“阿里云 OSS 已在用，旧对象存储命名仅作兼容说明”。**

### 3.2 当前统一命名：`OSS_* / objectKey`

- 早期上传模块曾沿用旧对象存储命名；为减少数据库和接口破坏性改动，文档当前统一按 OSS 命名解释为：
  - `OSS_*` 环境变量名
  - `oss-compatible.service.ts` 文件名
  - `objectKey` DTO / 字段名
- 这些名称**现在只是兼容层命名**；实际运行时值和存储后端是 OSS。
- 若后续继续推进代码层命名收敛，应作为单独重构任务处理，不在本次文档同步范围内。

### 3.3 当前上传流程

1. 前端调用 `POST /api/uploads/presign`
2. 后端校验登录、扩展名、MIME、大小限制，返回预签名上传信息
3. 浏览器直接 PUT 到 OSS
4. 前端调用 `POST /api/uploads/callback`
5. 后端 HeadObject / 获取对象信息后登记 `model_files`
6. 发布模型时 `POST /api/models` 关联 `modelFileId / coverFileId`，或直接使用 `viewerUrl`

### 3.3.1 上传任务持久化（3A-1）

- 当前已新增 `upload_tasks` 作为上传任务外层编排表。
- 作用：持久化上传任务快照、文件绑定关系、错误信息与中断状态，供前端刷新后恢复任务卡。
- 边界：
  - **不替代** `POST /api/uploads/presign`、`POST /api/uploads/callback`、`POST /api/models`
  - **不承诺** 浏览器刷新后的真正断点续传
  - 浏览器刷新/关闭导致 PUT 中断时，仅把任务状态收敛为 `interrupted`
- 当前新增接口：
  - `POST /api/upload-tasks`
  - `GET /api/upload-tasks/me`
  - `POST /api/upload-tasks/:id/status`
  - `POST /api/upload-tasks/:id/heartbeat`
  - `POST /api/upload-tasks/:id/files`
  - `POST /api/upload-tasks/:id/publish`
  - `POST /api/upload-tasks/:id/cancel`
  - `POST /api/upload-tasks/:id/interrupted`

### 3.4 LCC / LCC2 ZIP 处理流程

1. 用户先把 ZIP 当模型文件上传到 OSS
2. `POST /api/uploads/presign + PUT + callback` 完成文件上传登记
3. `POST /api/upload-tasks/:id/publish` 创建 `models` 记录并立即回写 `modelId` 到 `upload_tasks`
4. 若文件是 ZIP，`publish` 接口快速返回（`processingStatus=processing`），LCC ZIP 处理在后台**异步**执行
5. 后端后台任务从 OSS 下载 ZIP，安全解压到临时目录
6. 识别唯一 `.lcc` 或 `.lcc2` 入口文件
7. 保持完整目录结构重新上传到 `processed/lcc/{modelId}/...`
8. 回写：
   - `modelUrl` = `.lcc / .lcc2` 入口文件 OSS URL
   - `fileFormat` = `lcc / lcc2`
   - `viewerType` = `native`
   - `processingStatus` = `ready`（成功）或 `failed`（处理异常）
9. 处理完毕更新**同一条** `models` 记录，不创建新模型

> 设计要点：
> - `publish` 接口不因 LCC ZIP 处理耗时阻塞 HTTP 请求，前端不会因超时而误判为上传失败
> - 异步处理仍确保 `modelId` 在 `processLccZip` 执行前已写入 `upload_tasks`，重试 `publish` 时被幂等拦截
> - 上传成功后 ZIP 解析失败显示为"解析失败"，不是"上传失败"

---

## 四、当前后端模块与接口

统一前缀：`/api`
统一响应：`{ code, message, data }`

### 4.1 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/send-code`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 4.2 模型与互动

- `GET /api/models`
- `GET /api/models/:id`
- `POST /api/models`
- `POST /api/models/:id/submit-review`
- `POST /api/models/:id/like`
- `DELETE /api/models/:id/like`
- `POST /api/models/:id/favorite`
- `DELETE /api/models/:id/favorite`
- `POST /api/models/:id/share`

### 4.3 上传

- `POST /api/uploads/presign`
- `POST /api/uploads/callback`
- `POST /api/upload-tasks`
- `GET /api/upload-tasks/me`
- `POST /api/upload-tasks/:id/status`
- `POST /api/upload-tasks/:id/heartbeat`
- `POST /api/upload-tasks/:id/files`
- `POST /api/upload-tasks/:id/publish`
- `POST /api/upload-tasks/:id/cancel`
- `POST /api/upload-tasks/:id/interrupted`

> 说明：文档统一将对象键记作 `objectKey`，当前均表示 OSS object key。

### 4.4 用户中心

- `GET /api/users/me`
- `GET /api/users/me/models`
- `GET /api/users/me/favorites`
- `GET /api/users/me/published`
- `GET /api/users/me/applications`

### 4.5 联系与训练申请

- `POST /api/contact/leads`
- `GET /api/contact/options`
- `POST /api/training-applications`
- `GET /api/training-applications/my`

### 4.6 分类与站点配置

- `GET /api/categories`
- `GET /api/site-config`
- `PUT /api/admin/site-config`

### 4.7 后台管理

- `GET /api/admin/models`
- `GET /api/admin/models/:id`
- `PATCH /api/admin/models/:id/status`
- `DELETE /api/admin/models/:id`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `GET/POST/PUT/DELETE /api/admin/categories`
- `GET /api/admin/leads`
- `PATCH /api/admin/leads/:id/status`
- `GET /api/admin/training-applications`
- `PATCH /api/admin/training-applications/:id/status`

---

## 五、数据库与 Prisma 当前口径

### 5.1 核心表

- `users`
- `categories`
- `models`
- `model_files`
- `upload_tasks`
- `favorites`
- `likes`
- `training_applications`
- `contact_leads`
- `verification_codes`
- `site_configs`

### 5.2 文件相关字段口径

- `models.cover_url`：封面图 URL
- `models.model_url`：模型资源 URL / 外部查看地址 / `.lcc/.lcc2` 入口 URL
- `model_files.object_key`（文档口径）：当前表示 OSS object key
- `model_files.url`：对象公共访问地址

### 5.3 当前模型处理相关字段

`models` 已包含：

- `processing_status`
- `processing_error`
- `processed_at`
- `deleted_at`
- `deleted_by`
- `delete_reason`

这说明当前后端已经不仅是“规划”，而是具备模型上传、处理、软删除、后台管理所需的主干字段。

---

## 六、当前前端结构与 Viewer 架构

### 6.1 前端双轨结构

- `src/`：Vite UI 原型，继续作为视觉与交互验收基准
- `web/`：Next.js 15 正式前端，当前主要开发与联调入口

### 6.2 模型浏览器结构

- 统一外壳：`web/components/models/model-viewer-shell.tsx`
- LCC / LCC2：`web/components/models/lcc-viewer.tsx`
- 其他格式：位于 `web/components/models/viewers/`
- 当前默认视角：LCC / LCC2 统一收口为 `boundsCenterHomeView`
- 当前稳定规则：
  - `dataPath` 必须为 `.lcc / .lcc2` 入口文件 URL
  - 不使用目录 `dataPath`
  - 不依赖 `meta.lcc / meta.lcc2 / meta.splat`

---

## 七、环境变量口径（按当前实现）

### 7.1 后端当前常用变量

| 变量 | 当前用途 | 说明 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 | Prisma 使用 |
| `CORS_ORIGIN` | 允许来源 | 本地含 `3000` / `5173` |
| `JWT_ACCESS_SECRET` | JWT 密钥 | 生产必须换强随机值 |
| `OSS_ACCESS_KEY_ID` | OSS 访问密钥 ID | 当前统一命名 |
| `OSS_ACCESS_KEY_SECRET` | OSS 访问密钥 Secret | 当前统一命名 |
| `OSS_BUCKET` | OSS Bucket 名称 | 当前统一命名 |
| `OSS_ENDPOINT` | OSS 端点 / S3 兼容端点 | 由当前部署环境注入 |
| `OSS_PUBLIC_BASE` | OSS 公共访问基址 | 当前指向 OSS 公网域 |
| `OSS_REGION` | 区域 | 当前 `cn-shenzhen` |
| `OSS_FORCE_PATH_STYLE` | S3 兼容参数 | 当前 `false` |
| `MAX_MODEL_SIZE_MB` | 模型文件大小限制 | 当前 500；ZIP 特殊规则在服务端额外放宽 |
| `MAX_COVER_SIZE_MB` | 封面大小限制 | 当前 5 |

### 7.2 前端当前常用变量

| 变量 | 当前用途 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | API 基址；本地通常配 `/api` |

> 当前前端不直接持有 OSS 密钥；浏览器只使用后端返回的预签名地址。

---

## 八、当前文件组织建议（以实际仓库为准）

### 8.1 代码目录

- `web/app/`：Next.js 路由页面
- `web/components/`：页面、模型、后台、布局组件
- `web/lib/api/`：前端 API 封装
- `server/src/modules/`：按业务拆分模块
- `server/prisma/`：数据库 schema / migration / seed
- `docs/`：最新文档说明

### 8.2 文档阅读顺序

1. `docs/backend-architecture-plan.md`：总体技术栈、接口、对象存储与部署目标
2. `docs/dev-checkpoint.md`：已落地事实与阶段性记录
3. `docs/lcc-web-sdk-integration.md`：LCC / LCC2 接入与默认视角规则
4. `docs/model-viewer-architecture.md`：模型浏览器分层与边界
5. `docs/frontend-acceptance-checklist.md`：联调与手验清单

---

## 九、当前明确不变的约束

1. 不把文件实体落服务器本地长期存储。
2. 不把 LCC / LCC2 默认视角逻辑扩散到其他格式 Viewer。
3. 不把 `ModelViewerShell` 变成格式算法承载层。
4. 不把对象存储最新状态再写回成 阿里云 OSS 口径。
5. 不把旧对象存储命名误写成当前方案；当前统一口径始终为阿里云 OSS。

---

## 十、后续建议

1. 如要继续统一命名，可单独规划一次“OSS 命名收敛”重构，继续把代码层旧别名与文档口径完全对齐。
2. 补齐生产部署编排、OSS 自定义域、备份策略、日志与监控文档。
3. 对 GLB / IFC / PLY / OSGB 等非 LCC 格式继续补真实 Viewer，而不是长期停留在占位层。
4. 如需进一步法务/运维合规，补对象存储生命周期、访问控制、日志留存与删除策略文档。

---

> 若与历史文档片段冲突，以本文档和当前仓库实现为准；历史记录中的 `OSS`、`objectKey`、`oss-compatible.service.ts` 需要结合“阿里云 OSS 兼容命名”理解。
