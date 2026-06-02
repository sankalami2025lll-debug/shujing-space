# 数境空间官网 后端架构与部署方案（最终技术栈）

> 更新日期：2026-05-31
> 状态：技术栈已最终确定，本文档为后端开发与上线部署的第一依据。
> 适用：后端开发、部署运维、前端迁移对接。
> 前置说明：当前 `src/` 下的 **Vite + React 前端是 UI 原型基准（视觉与交互的唯一还原依据）**，后续需迁移为 Next.js；本阶段**只更新文档，不迁移、不动业务代码、不创建后端代码**。

---

## 〇、最终技术栈一览

| 层 | 选型 | 说明 |
|---|---|---|
| 服务器系统 | **Ubuntu 22.04 LTS** | 部署基线操作系统 |
| 服务器面板 | **1Panel** | 现代化 Linux 运维面板，原生面向容器化管理 |
| 部署方式 | **Docker / Docker Compose** | 所有服务（前端、后端、数据库等）一律容器化编排 |
| 前端（目标） | **Next.js**（React + TypeScript） | 最终前端框架；当前 Vite 原型为 UI 基准，后续迁移 |
| 前端（当前） | Vite + React 18 + TS + Tailwind 4 + shadcn/ui | **UI 原型基准**，仅作还原依据，不作为上线形态 |
| 后端 | **Node.js + NestJS**（TypeScript） | RESTful、模块化、依赖注入、Guard 三级权限 |
| 数据库 | **PostgreSQL** | 关系型主库，存业务数据与文件 URL |
| ORM | **Prisma** | 类型安全、迁移可控（schema 即文档） |
| 对象存储 | **Cloudflare R2** | 模型文件、图片、视频等**全部存 R2，不落服务器本地** |
| CDN / DNS / SSL / 安全 | **Cloudflare** | 边缘加速、域名解析、证书、WAF/防护 |
| 架构形态 | **前后端分离** | 前端独立部署，后端只提供 API |
| 缓存（可选二期） | Redis | 验证码、限流、热点列表缓存 |

### 核心红线（务必遵守）
1. **模型文件、图片、视频不得存服务器本地磁盘**，必须上传到 Cloudflare R2。
2. **数据库只保存**：文件 URL、模型信息、用户信息、业务数据（线索/申请/分类等）。
3. 所有密钥（R2、数据库、JWT、短信、Cloudflare API Token）只放服务器环境变量 / 容器 secret，**严禁进仓库**。
4. 前后端分离：后端不渲染页面，只出 JSON；前端通过 API 基址访问后端。

---

## 一、整体架构总览

```txt
                         [ Cloudflare ]
              DNS 解析 / CDN 边缘缓存 / SSL 证书 / WAF 安全防护
                                │
            ┌───────────────────┼─────────────────────────┐
            │                   │                          │
   静态资源/页面边缘缓存     api.shujingspace.com      assets（R2 自定义域）
            │                   │                          │
            ▼                   ▼                          ▼
   ┌─────────────────────────────────────────┐   [ Cloudflare R2 桶 ]
   │   Ubuntu 22.04 LTS 服务器（1Panel 管理） │    模型文件 / 封面图 / 视频
   │                                         │    （前端直传，后端签名授权）
   │   ┌─────────── Docker Compose ────────┐ │
   │   │  web    : Next.js (前端, SSR/SSG)  │ │
   │   │  api    : NestJS  (后端 API)       │ │
   │   │  db     : PostgreSQL              │ │
   │   │  cache  : Redis（二期可选）        │ │
   │   │  proxy  : Nginx/1Panel OpenResty  │ │
   │   └──────────────────────────────────┘ │
   └─────────────────────────────────────────┘
```

要点：
- **入口流量先经 Cloudflare**（DNS + CDN + SSL + WAF），回源到服务器。
- 服务器上所有进程都在 **Docker 容器**内，由 **Docker Compose** 统一编排，**1Panel** 负责面板化管理（容器、镜像、计划任务、备份、证书等）。
- **大文件不经服务器**：前端从后端拿到 R2 预签名地址后**直传 R2**，下载/浏览经 R2 公共域（建议挂 Cloudflare CDN 自定义域）。
- 前端 `web` 与后端 `api` 分离部署，可分别使用子域：`www.shujingspace.com`（前端）、`api.shujingspace.com`（后端）。

---

## 二、Docker / Docker Compose 部署结构

### 2.1 服务编排（示意，非最终实现）
```txt
docker-compose.yml
├─ web      Next.js 生产镜像（next start，监听 3000）
├─ api      NestJS 生产镜像（node dist/main.js，监听 4000）
├─ db       postgres:16，数据卷持久化，仅容器内网可达
├─ cache    redis:7（二期），仅容器内网可达
└─ proxy    反向代理（或直接用 1Panel 的 OpenResty 网站）
```

### 2.2 网络与端口约束
- `db` / `cache` **不暴露宿主机公网端口**，仅在 Compose 内部网络供 `api` 访问。
- `web`(3000) / `api`(4000) 仅监听 `127.0.0.1`，由 1Panel 反代 + Cloudflare 对外。
- 对外仅放行 80 / 443（经 Cloudflare）与受限 SSH。

### 2.3 数据持久化与备份
- PostgreSQL 数据落 Docker named volume（如 `pg_data`），由 1Panel 计划任务定时 `pg_dump` 备份并可上传到 R2。
- **服务器本地不存业务文件**，因此服务器侧主要备份对象是「数据库 + 环境配置」。

### 2.4 配置与密钥
- 各服务通过 `.env`（Compose `env_file`）注入环境变量；`.env` 不入库，仓库只放 `.env.example`。
- Cloudflare API Token、R2 密钥等仅在服务器 / 容器内，前端不接触任何长期密钥。

---

## 三、本地开发目录结构

前后端分离，建议两个独立工程（可同仓多目录，也可拆仓）：

```txt
公司官网首页设计/
├─ src/                      # ★ 当前 Vite UI 原型（基准，本阶段不动）
├─ 页面功能注释文档/
├─ docs/
│  ├─ dev-checkpoint.md
│  ├─ frontend-acceptance-checklist.md
│  └─ backend-architecture-plan.md   # 本文档
│
├─ web/                      # ☆ 未来：Next.js 前端（迁移后落地，本阶段不创建）
│  └─ （从 src/ 原型迁移而来，保持相同 UI/文案/交互）
│
├─ server/                   # ☆ 未来：NestJS 后端（本阶段不创建）
│  ├─ prisma/
│  │  ├─ schema.prisma        # PostgreSQL 模型定义
│  │  ├─ migrations/
│  │  └─ seed.ts              # 把 communityData 灌入开发库
│  ├─ src/
│  │  ├─ main.ts
│  │  ├─ common/             # Guards / 拦截器 / 异常过滤 / DTO
│  │  ├─ config/             # 读取并校验环境变量
│  │  ├─ prisma/             # PrismaService
│  │  └─ modules/
│  │     ├─ auth/            # /api/auth/*
│  │     ├─ users/           # 个人中心
│  │     ├─ models/          # 模型列表/详情/点赞/收藏
│  │     ├─ uploads/         # R2 预签名、上传回执
│  │     ├─ categories/      # 分类管理（后台）
│  │     ├─ training/        # 训练数据服务申请
│  │     ├─ contact/         # 联系线索
│  │     ├─ admin/           # 后台：审核/用户/分类/申请/线索
│  │     └─ site-config/     # 全站配置
│  ├─ Dockerfile
│  ├─ .env.example
│  └─ package.json
│
├─ deploy/                   # ☆ 未来：部署编排（本阶段不创建）
│  ├─ docker-compose.yml
│  ├─ docker-compose.prod.yml
│  └─ nginx/ 或 1Panel 反代配置说明
└─ ...
```

> 本阶段（文档阶段）**不创建** `web/`、`server/`、`deploy/`，以上仅为后续落地的目标结构约定。

---

## 四、数据库表设计（PostgreSQL）

类型采用 PG 风格：`bigserial` 主键、`text`/`varchar`、`jsonb`、`timestamptz`、布尔；枚举用 PG enum 或 `text + CHECK`。**所有文件相关字段只存 URL / key，不存二进制。**

### 1. `users` 用户
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| phone | varchar(20) unique null | 手机号 |
| email | varchar(120) unique null | 邮箱 |
| password_hash | varchar(255) null | bcrypt；验证码注册可空 |
| nickname | varchar(60) | 显示名 |
| company | varchar(120) null | 公司 |
| role_type | varchar(40) null | 角色/需求类型（注册表单） |
| role | text CHECK in (`user`,`admin`) | 系统权限，默认 user |
| avatar_url | varchar(255) null | 头像（R2 URL） |
| status | text CHECK in (`active`,`disabled`) | 账号状态 |
| created_at / updated_at | timestamptz | |

### 2. `categories` 分类（后台分类管理用）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| name | varchar(40) unique | 实景三维 / BIM 模型 / 构件级模型 / 具身智能机器人训练场景 |
| slug | varchar(40) unique | 英文标识 |
| sort | int default 0 | 排序权重 |
| is_active | boolean default true | 是否启用 |
| created_at / updated_at | timestamptz | |

### 3. `models` 模型
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| user_id | bigint FK→users | 发布者 |
| category_id | bigint FK→categories null | 分类 |
| type | varchar(40) | 冗余类型名（与分类一致，便于展示/兼容原型） |
| title | varchar(120) | 标题 |
| tags | jsonb | 标签数组 |
| scenes | jsonb | 应用场景多选 |
| description | text | 简介 |
| cover_url | varchar(255) | 封面图 R2 URL |
| model_url | varchar(255) null | 模型资源 / 外部 Viewer 地址 → 前端 `viewerUrl` |
| viewer_type | varchar(30) | iframe / sketchfab / native / none |
| allow_iframe | boolean default true | 是否允许 iframe 内嵌（兜底用） |
| file_format | varchar(20) | glb/gltf/ifc/3dtiles/点云 |
| views_count | int default 0 | 浏览量 |
| likes_count | int default 0 | 点赞量 |
| favorites_count | int default 0 | 收藏量 |
| visibility | text CHECK in (`public`,`private`,`review`) | 公开/仅自己/审核后公开 |
| status | text CHECK in (`draft`,`pending`,`published`,`rejected`) | 审核状态 |
| reject_reason | text null | 驳回原因（后台审核） |
| created_at / updated_at | timestamptz | |

> 索引：`(type, status)`、`(status, created_at desc)`、`(user_id)`、`title` 可建 `pg_trgm` 模糊索引支持搜索。

### 4. `model_files` 上传文件登记（指向 R2）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| user_id | bigint | 上传者 |
| kind | text CHECK in (`model`,`cover`,`video`) | 文件用途 |
| original_name | varchar(255) | 原始文件名 |
| r2_key | varchar(255) | R2 对象 key |
| url | varchar(255) | 可访问 URL（R2 公共域 / CDN 域） |
| size | bigint | 字节 |
| mime | varchar(80) | MIME 类型 |
| created_at | timestamptz | |

### 5. `favorites` 收藏 / 6. `likes` 点赞
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| user_id | bigint | |
| model_id | bigint | |
| created_at | timestamptz | |
| 唯一约束 | `(user_id, model_id)` | 防重复 |

### 7. `training_applications` 训练数据服务申请
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| user_id | bigint null | 登录则记录 |
| contact_name | varchar(60) | 联系人 |
| contact_way | varchar(120) | 手机/微信 |
| company | varchar(120) | 公司 |
| robot_type | varchar(40) | 机器人类型 |
| train_tasks | jsonb | 训练任务多选 |
| scene_desc | text | 场景需求描述 |
| status | text CHECK in (`submitted`,`contacted`,`evaluating`,`quoted`,`closed`) | 申请状态 |
| created_at / updated_at | timestamptz | |

### 8. `contact_leads` 联系线索
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| name | varchar(60) | 姓名 |
| contact_way | varchar(120) | 手机/微信 |
| company | varchar(120) null | 公司 |
| email | varchar(120) null | 邮箱 |
| scene | varchar(40) null | 应用场景 |
| data_types | jsonb | 数据类型多选 |
| stage | varchar(40) null | 项目阶段 |
| budget | varchar(40) null | 预算范围 |
| message | text | 需求描述 |
| status | text CHECK in (`new`,`contacted`,`qualified`,`quoted`,`won`,`lost`) | 线索状态 |
| created_at / updated_at | timestamptz | |

### 9. `verification_codes` 验证码（无 Redis 时用表，二期迁 Redis）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | |
| target | varchar(120) | 手机号/邮箱 |
| scene | text CHECK in (`register`,`login`,`reset`) | 用途 |
| code_hash | varchar(255) | 验证码哈希 |
| expires_at | timestamptz | 过期（如 5 分钟） |
| used | boolean default false | 是否已用 |
| created_at | timestamptz | 60s 限频依据 |

### 10. `site_configs` 全站配置（Footer 联系方式、备案号等）
| 字段 | 类型 | 说明 |
|---|---|---|
| key | varchar(60) PK | phone/email/address/icp 等 |
| value | text | 配置值 |
| updated_at | timestamptz | 后台维护 |

> `refresh_tokens`（存哈希 + 过期 + 撤销）可在鉴权二期加入，用于真正注销。

---

## 五、API 接口清单

统一前缀 `/api`，统一响应体 `{ code, message, data }`，统一分页 `page / pageSize`。

### 认证 Auth
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/auth/register` | 游客 | 注册（手机/邮箱 + 验证码 + 密码 + 协议） |
| POST | `/api/auth/login` | 游客 | 密码或验证码登录，返回 JWT |
| POST | `/api/auth/send-code` | 游客 | 发送验证码（60s 限频） |
| POST | `/api/auth/reset-password` | 游客 | 找回密码 |
| POST | `/api/auth/logout` | 用户 | 退出登录 |
| GET | `/api/auth/me` | 用户 | 当前登录用户（NavBar 登录态） |

### 模型 Models
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/models` | 游客 | 列表，`type/keyword/sort/page/pageSize`，返回 `list+total` |
| GET | `/api/models/:id` | 游客 | 详情，含 `model_url`(viewerUrl)、`viewer_type`、`allow_iframe` |
| POST | `/api/models` | 用户 | 发布模型（关联已上传 R2 文件） |
| POST | `/api/models/:id/submit-review` | 用户 | 提交审核 |
| POST/DELETE | `/api/models/:id/like` | 用户 | 点赞/取消 |
| POST/DELETE | `/api/models/:id/favorite` | 用户 | 收藏/取消 |
| POST | `/api/models/:id/share` | 游客 | 记录分享（可选） |

### 文件上传 Uploads（R2 直传）
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/uploads/presign` | 用户 | 申请 R2 预签名上传地址（参数：kind、文件名、mime、size） |
| POST | `/api/uploads/callback` | 用户 | 上传完成回执，登记 `model_files` 并返回可访问 URL |

### 个人中心 Users
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/users/me` | 用户 | 个人信息 |
| GET | `/api/users/me/models` | 用户 | 我的模型 |
| GET | `/api/users/me/favorites` | 用户 | 我的收藏 |
| GET | `/api/users/me/published` | 用户 | 我的发布 |
| GET | `/api/users/me/applications` | 用户 | 我的申请 |

### 训练数据服务申请 Training
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/training-applications` | 游客/用户 | 提交申请（仅具身智能机器人训练场景） |
| GET | `/api/training-applications/my` | 用户 | 我的申请 |

### 联系线索 Contact
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/contact/leads` | 游客 | 提交线索 |
| GET | `/api/contact/options` | 游客 | 表单选项配置 |

### 分类 Categories
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/categories` | 游客 | 启用中的分类列表（前端筛选用） |

### 全站配置 Site
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/site-config` | 游客 | Footer 联系方式、备案信息 |

### 后台管理 Admin（仅 admin）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/models?status=pending` | 模型审核列表 |
| PATCH | `/api/admin/models/:id/status` | 审核通过/驳回（带 reject_reason） |
| GET | `/api/admin/users` | 用户管理列表 |
| PATCH | `/api/admin/users/:id/status` | 启用/禁用用户、调整角色 |
| GET/POST/PUT/DELETE | `/api/admin/categories` | 分类管理（增删改查、排序、启停） |
| GET | `/api/admin/training-applications` | 数据服务申请管理 |
| PATCH | `/api/admin/training-applications/:id/status` | 更新申请状态 |
| GET | `/api/admin/leads` | 联系表单管理 |
| PATCH | `/api/admin/leads/:id/status` | 更新线索状态 |
| PUT | `/api/admin/site-config` | 维护全站配置 |

---

## 六、后台管理系统

需覆盖以下 5 大模块（用户要求）：

| 模块 | 功能要点 | 关联接口/表 |
|---|---|---|
| 模型审核 | 待审列表、查看详情/预览、通过/驳回（驳回填原因）、状态流转 | `models` / `/api/admin/models/*` |
| 用户管理 | 用户列表、搜索、启用/禁用、角色调整（user/admin） | `users` / `/api/admin/users/*` |
| 分类管理 | 分类增删改、排序、启停（驱动前端筛选项） | `categories` / `/api/admin/categories` |
| 数据服务申请管理 | 申请列表、详情、状态流转（submitted→…→closed） | `training_applications` / `/api/admin/training-applications/*` |
| 联系表单管理 | 线索列表、详情、状态流转（new→…→won/lost） | `contact_leads` / `/api/admin/leads/*` |

实现建议：
- 后台与前台同为 Next.js 应用的受保护路由（`/admin/*`），或独立后台应用；二者都通过同一 NestJS API + `RolesGuard(admin)` 鉴权。
- 后台所有写操作记录操作人与时间，便于审计（可加 `audit_logs` 表，二期）。

---

## 七、文件存储与 viewerUrl 方案（Cloudflare R2）

### 7.1 上传流程（前端直传，后端只签名）
1. 前端选择文件 → 调 `POST /api/uploads/presign`（带 kind/文件名/mime/size）。
2. 后端校验登录、格式白名单、大小上限 → 生成 R2 **预签名 PUT 地址**返回。
3. 前端用预签名地址**直传 R2**（文件不经过 NestJS、不落服务器磁盘）。
4. 前端上传成功后调 `POST /api/uploads/callback` → 后端登记 `model_files`，返回可访问 URL。
5. 发布模型时 `POST /api/models` 关联 `cover_url`/`model_url`。

### 7.2 访问与 CDN
- R2 桶绑定 **Cloudflare 自定义域**（如 `assets.shujingspace.com`），经 CDN 边缘缓存加速。
- 私有资源用预签名 GET（带时效）；公开资源用公共域直链。

### 7.3 校验（文档 07 要求）
- 服务端二次校验：类型白名单（glb/gltf/ifc/3dtiles/点云、封面 jpg/png/webp、视频 mp4）、大小上限、文件名安全（防穿越）、登录权限。

### 7.4 viewerUrl / model_url
- 前端字段 `viewerUrl` ↔ 数据库 `models.model_url`，由 `GET /api/models/:id` 下发，替代当前写死的 Sketchfab 测试链接。
- `viewer_type` 区分查看器来源；`allow_iframe=false` 时前端走「在新窗口打开」兜底，避免 X-Frame-Options/CSP 导致空白。
- `model_url` 入库前做 URL 校验（协议 https 白名单、域名白名单）。

### 7.5 红线复述
- **模型文件、图片、视频一律存 R2，禁止落服务器本地磁盘**；数据库只存 URL/key 与业务信息。

---

## 八、环境变量设计

`.env.example` 入库（占位），真实 `.env` 仅在服务器 / 容器，不入库。

### 后端（NestJS）
| 变量 | 本地开发 | 生产（容器） | 说明 |
|---|---|---|---|
| `NODE_ENV` | development | production | |
| `PORT` | 4000 | 4000 | 仅内网 |
| `DATABASE_URL` | postgresql://postgres:pwd@localhost:5432/shujing_dev | postgresql://shujing:**强密码**@db:5432/shujing | PG 连接串（生产指向 Compose 服务名 `db`） |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev 串 | **随机长串** | JWT 密钥 |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | 2h / 7d | 2h / 7d | |
| `CORS_ORIGIN` | http://localhost:3000 | https://www.shujingspace.com | 允许来源 |
| `R2_ACCOUNT_ID` | 沙箱/留空 | **真实** | Cloudflare 账号 ID |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | 沙箱 | **真实** | R2 凭证 |
| `R2_BUCKET` | shujing-dev | shujing | 桶名 |
| `R2_ENDPOINT` | https://<acc>.r2.cloudflarestorage.com | 同左 | S3 兼容端点 |
| `R2_PUBLIC_BASE` | https://assets-dev... | https://assets.shujingspace.com | 公共访问域 |
| `MAX_MODEL_SIZE_MB` / `MAX_COVER_SIZE_MB` | 500 / 5 | 500 / 5 | 上传上限 |
| `SMS_*` | 沙箱 | **真实** | 短信验证码 |
| `REDIS_URL`（二期） | redis://localhost:6379 | redis://cache:6379 | |

### 前端（Next.js）
| 变量 | 本地 | 生产 | 说明 |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | http://localhost:4000/api | https://api.shujingspace.com/api | 后端 API 基址 |
| `NEXT_PUBLIC_ASSETS_BASE_URL` | https://assets-dev... | https://assets.shujingspace.com | R2 资源域 |

> Cloudflare API Token、R2 密钥仅后端持有；前端只持有公开的 `NEXT_PUBLIC_*`，绝不接触长期密钥。

---

## 九、开发顺序

遵循「每次只做一个明确模块、做完即验证」：

1. **文档阶段（当前）**：固化最终技术栈与架构（本文档）、更新 `AGENTS.md` 与 `dev-checkpoint.md`。不动业务代码。
2. **后端脚手架**：初始化 `server/`（NestJS + Prisma + PostgreSQL）、统一响应/异常/校验、Swagger、`.env.example`、Dockerfile。
3. **数据库建模与种子**：`schema.prisma`（第四节全部表）→ 迁移 → `seed.ts` 灌入 `communityData`。
4. **认证模块**：`/api/auth/*` + JWT + 验证码。
5. **模型读接口**：`/api/models`、`/api/models/:id`、`/api/categories`。
6. **R2 上传 + 模型发布**：`/api/uploads/presign|callback` + `POST /api/models`。
7. **互动与个人中心**：点赞/收藏 + `/api/users/me/*`。
8. **表单线索类**：`/api/contact/*`、`/api/training-applications`。
9. **后台管理**：模型审核、用户管理、分类管理、申请管理、线索管理。
10. **前端迁移（Next.js）**：以 `src/` Vite 原型为 UI 基准，逐页迁移到 `web/`（Next.js），保持视觉/文案/交互一致，并接入上述 API（受控表单 + loading/success/error 三态）。
11. **容器化与部署**：编写 `deploy/docker-compose.yml`，在 Ubuntu 22.04 + 1Panel 上拉起 web/api/db（/cache），接 Cloudflare DNS+CDN+SSL+WAF，R2 绑定自定义域，冒烟测试。
12. **二期优化**：Redis 限流缓存、iframe 兜底、监控告警、数据库定时备份到 R2、审计日志。

---

## 十、前端迁移说明（Vite 原型 → Next.js）

- **当前 `src/` 的 Vite + React 前端是 UI 原型基准**：它定义了数境空间官网的视觉风格、页面层级、中文文案与交互逻辑，是 Figma 导出后的还原结果，**为后续 Next.js 版本的唯一还原依据**。
- 迁移要求：
  1. 不在本阶段迁移；本阶段只更新文档。
  2. 迁移时**保持 UI 风格、文案语气、模块顺序、主按钮含义不变**（AGENTS.md 红线）。
  3. 复用现有 `components/ui/`（shadcn/ui）与 Tailwind 设计体系。
  4. 用 `useState` 模拟的路由切换迁移为 Next.js 路由（`/`、`/community`、`/models`、`/models/:id`、`/about`、`/contact`、`/auth`、`/user/*`、`/admin/*`）。
  5. 迁移与接口接入同步：把 `communityData.ts` 静态数据替换为 API 数据，所有表单补受控 + 三态。
- 在 Next.js 版本上线并验收通过前，**Vite 原型仍是验收基准（见 `frontend-acceptance-checklist.md`）**，不得删除。

---

## 十一、风险点

1. **R2 / Cloudflare 配置复杂度**：R2 凭证、S3 兼容端点、CORS、自定义域绑定、预签名时效需逐项验证；前端直传需正确配置 R2 桶 CORS，否则上传失败。
2. **大文件直传**：模型文件可达数百 MB，需用 R2 分片/多段上传与断点续传策略，并设置合理超时与失败重试。
3. **跨域**：前后端分离 + 独立子域会有 CORS；统一规划 `CORS_ORIGIN` 与凭证模式（Bearer Header 优先，规避 Cookie CSRF）。
4. **ICP 备案与 Cloudflare 解析**：国内访问 + 国内服务器需 ICP 备案；使用 Cloudflare 解析时需确认备案与境内访问合规、回源稳定性。
5. **容器编排与数据安全**：`db`/`cache` 不暴露公网端口；数据库密码、JWT、R2、Cloudflare Token 仅容器内注入；定时备份数据库（可上传 R2）。
6. **登录态联动改造**：接入真实登录后，NavBar 登录态、个人中心、发布/收藏权限、AuthPage 文案与跳转需联动，属跨页改动，迁移时按页拆分逐页验证。
7. **iframe 内嵌被拒**：外部 Viewer 可能禁止内嵌，需 `allow_iframe` + 「新窗口打开」兜底；上线前替换全部测试链接为真实地址。
8. **数据迁移清洗**：`communityData.ts` 的 `views`("2.1k")、`time`("3天前") 为展示字符串，灌库需转 `views_count:int`、`created_at:timestamptz`。
9. **单机部署单点**：一期单服务器无高可用，需 1Panel 配置容器自启、磁盘/日志监控、备份策略，防止磁盘写满与服务中断。
10. **短信成本与防刷**：验证码需 60s 限频 + IP 限流 + 图形验证码，防恶意刷量产生费用。

---

> 本文档为最终技术栈下的架构与部署第一依据；与历史方案（如早期 MySQL + 宝塔 + 本地存储设想）不一致处，**以本文档为准**。
