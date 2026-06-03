# 数境空间官网 阶段开发检查点

> 更新日期：2026-06-03（部署前准备阶段 3 小收口已完成：根目录 `.gitignore` 已忽略 `deploy/.env.prod` 与 `deploy/.env.*.local`，新增 `deploy/docker-compose.prod.local.yml` 供本地冒烟端口映射；部署前准备阶段 1 已落地：新增 `web/Dockerfile`、`deploy/docker-compose.prod.yml`、`deploy/.env.prod.example`；模型库“全部模型”搜索状态同步 bug 已修复；Admin 前端阶段 5 总体验收与文档收口完成；Admin 前端第一版完成；Admin 前端阶段 4 用户 / 分类 / 站点配置已接入；Admin 前端阶段 3 联系线索与训练申请已接入；Admin 前端阶段 2 模型管理页已接入；Admin 前端阶段 1 后台壳子 + 管理员守卫已落地；上线前安全与一致性修复 2A–2G 收口 + OSS 最小兼容配置已落地 + 个人中心封面显示收口）
> 范围：仅记录已实际落地的改动与事实，供后续 Agent 续接。

## 🚩 最终检查点（重开新对话前，先读本节）

> 本节为「重开新对话」的交接快照。下方各节为历史明细，可按需深入。

### 零、当前阶段快照（2026-06-01，Next.js 本地验收通过）

#### 本地三端地址

| 服务 | 地址 | 说明 |
|------|------|------|
| **Next.js 目标前端** | http://localhost:3000 | `cd web && pnpm dev`；dev 下 `/api` 经 `next.config.ts` rewrites 转发后端 |
| **Vite 原型对照基准** | http://localhost:5173 | 根目录 `pnpm dev`；`src/` 视觉/文案/交互验收基准，**不得删除** |
| **NestJS 后端 API** | http://localhost:4000 | `cd server && pnpm dev`；Next/Vite 均以 `/api` 同源访问 |

#### Next.js 本地运行与样式

- ✅ **`web/` 本地运行已恢复正常**（`3000` + `4000` + DB 联调通过）。
- ✅ **全局样式问题已解决**：自 Vite `src/styles/` 迁移 `web/styles/{fonts,tailwind,theme}.css`，`globals.css` 链式引入；Tailwind 扫描 `app/` / `components/` / `lib/`；shadcn CSS 变量与 `@layer base` 已生效（详见「第 11 步·全局样式修复」「〇之启·十六·全局样式」）。
- ⚠️ **样式修复后须清缓存重启才生效**：结束占用 **3000** 的旧 `next dev` 进程 → 删除 `web/.next` → `cd web && pnpm dev` → 硬刷新浏览器。

#### Admin 前端阶段 1（后台壳子 + 管理员守卫，2026-06-03）

- ✅ **`/admin` 后台入口已落地**：新增 `web/app/admin` 路由组，默认页为后台概览占位。
- ✅ **后台统一壳子已完成**：新增 `web/components/admin/admin-shell.tsx`，包含后台品牌区、黑白灰侧边导航、顶部管理员信息栏与主内容区域。
- ✅ **管理员体验守卫已完成**：新增 `web/components/admin/admin-guard.tsx`，复用现有 `AuthProvider` 与 `User.role`：
  - 未登录访问 `/admin` → toast「请先登录管理员账号」+ `router.replace('/auth')`
  - 已登录但非 admin → 展示 403 无权限页
  - admin → 正常进入后台
- ✅ **后台模块导航已建好**：概览、模型管理、用户管理、分类管理、联系线索、训练申请、站点配置均有可点击路由占位页，点击不报错。
- ✅ **官网入口已补充**：`NavBar` 对 `role=admin` 用户显示「管理后台」入口；`SiteChrome` 在 `/admin*` 下隐藏用户侧 NavBar，避免双导航叠层。
- ⚠️ **当前仍仅为壳子阶段**：尚未对接 `/api/admin/models`、`/api/admin/users` 等真实列表/表格与写操作。

#### Admin 前端阶段 2（模型管理页 /admin/models，2026-06-03）

- ✅ **`/admin/models` 已接入真实接口**：新增 `web/lib/api/admin-models.ts`，对接：
  - `GET /api/admin/models`
  - `GET /api/admin/models/:id`
  - `PATCH /api/admin/models/:id/status`
  - `DELETE /api/admin/models/:id`
- ✅ **模型列表表格已落地**：展示 `id / 标题 / 类型 / 作者 / 分类 / status / visibility / 浏览量 / 点赞数 / 收藏数 / 创建时间 / 操作`。
- ✅ **筛选与分页可用**：已支持状态筛选（all / pending / published / rejected / draft）、关键词搜索、上一页 / 下一页切换。
- ✅ **审核流已可用**：
  - 审核通过：确认后调用 `action=approve`
  - 驳回：弹层填写 `rejectReason` 后调用 `action=reject`
  - 错误时统一 `toast.error(后端 message)`，成功后 `toast.success` 并刷新列表
- ✅ **后台删除入口已接入**：调用 `DELETE /api/admin/models/:id`，删除成功后刷新列表；当前仍为**软删除**，OSS / R2 文件**不会立即删除**。
- ✅ **详情弹层已接入**：支持查看单个模型的后台详情字段（含审核状态、可见性、驳回原因、删除原因等）。
- ⚠️ **当前范围说明**：模型管理页已完成，但其它后台页面（用户 / 分类 / 线索 / 训练申请 / 站点配置）仍是占位壳子。

#### Admin 前端阶段 3（联系线索 / 训练申请，2026-06-03）

- ✅ **`/admin/leads` 已接入真实接口**：新增 `web/lib/api/admin-leads.ts`，对接：
  - `GET /api/admin/leads`
  - `PATCH /api/admin/leads/:id/status`
- ✅ **`/admin/training` 已接入真实接口**：新增 `web/lib/api/admin-training.ts`，对接：
  - `GET /api/admin/training-applications`
  - `PATCH /api/admin/training-applications/:id/status`
- ✅ **联系线索后台页已完成**：支持列表、状态筛选、详情弹层、loading / error / empty 三态、行内状态更新与成功/失败 toast。
- ✅ **训练申请后台页已完成**：支持列表、状态筛选、详情弹层、loading / error / empty 三态、行内状态更新与成功/失败 toast。
- ✅ **后台导航已收口到 `/admin/training`**：同时兼容旧的 `/admin/training-applications` 路由，避免阶段 1 遗留链接失效。
- ⚠️ **浏览器手工联调项延期**：`/admin/models`、`/admin/leads`、`/admin/training` 的 admin / 非 admin 访问、真实列表加载、状态流转与 toast 展示，统一放到 **Admin 总体验收阶段**。
- ⚠️ **二期明确不做**：批量操作、导出 Excel、复杂权限系统。

#### Admin 前端阶段 4（用户 / 分类 / 站点配置，2026-06-03）

- ✅ **`/admin/users` 已接入真实接口**：新增 `web/lib/api/admin-users.ts`，对接：
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:id/status`
- ✅ **用户管理后台页已完成**：支持搜索、角色/状态筛选、分页、行内角色调整、启用/禁用与 loading / error / empty 三态；列表严格脱敏，不显示 `passwordHash`。
- ✅ **`/admin/categories` 已接入真实接口**：新增 `web/lib/api/admin-categories.ts`，对接：
  - `GET /api/admin/categories`
  - `POST /api/admin/categories`
  - `PUT /api/admin/categories/:id`
  - `DELETE /api/admin/categories/:id`
- ✅ **分类管理后台页已完成**：支持分类列表、新增分类、编辑分类、启用/停用、删除未引用分类；若分类被模型引用，直接透传后端错误 message 提示。
- ✅ **`/admin/site-config` 已接入真实接口**：新增 `web/lib/api/admin-site-config.ts`，对接：
  - `GET /api/admin/site-config`
  - `PUT /api/admin/site-config`
- ✅ **站点配置后台页已完成**：支持读取并保存 `phone / email / address / icp / companyName / footerText` 六个白名单字段；保存成功后前台 Footer 后续刷新即可反映最新配置。
- ⚠️ **浏览器手工联调项延期**：`/admin/users`、`/admin/categories`、`/admin/site-config` 的 admin 真实登录加载、增改停用、保存结果、错误 toast 展示，统一放到 **Admin 总体验收阶段**。
- ⚠️ **二期明确不做**：批量操作、审计日志、导出 Excel、复杂权限系统。

#### Admin 前端阶段 5（总体验收与文档收口，2026-06-03）

- ✅ **Admin 前端第一版完成**：已完成页面：
  - `/admin`
  - `/admin/models`
  - `/admin/leads`
  - `/admin/training`
  - `/admin/users`
  - `/admin/categories`
  - `/admin/site-config`
- ✅ **本轮 CLI 质量门禁通过**：
  - `cd web && pnpm lint`
  - `cd web && pnpm build`
  - `cd server && pnpm lint`
  - `cd server && pnpm build`
  - `cd server && pnpm test`
- ✅ **后端自动化测试结果**：当前 `server` 共 5 组测试、19 条用例，全部通过：
  - `admin-models.service.spec.ts`
  - `users.service.spec.ts`
  - `interactions.service.spec.ts`
  - `uploads.service.spec.ts`
  - `models.service.spec.ts`
- ✅ **管理员初始化机制已按文档实测**：使用 `pnpm admin:init` + `ADMIN_*` 环境变量创建本地验收管理员；弱密码关键词（如 `admin`）会被脚本拒绝，符合预期。
- ✅ **Admin 主链路已做真实 API 验收**：
  - 普通用户访问 `/api/admin/*` 返回 `403`
  - `/api/admin/models`：列表 / 详情 / approve / reject / soft delete 跑通；删除后公开详情 `404`
  - `/api/admin/leads`：列表 / 状态筛选 / 状态更新跑通
  - `/api/admin/training-applications`：列表 / 状态筛选 / 状态更新跑通
  - `/api/admin/users`：列表 / 搜索 / 分页 / 启用禁用 / 角色调整跑通
  - `/api/admin/categories`：新增 / 编辑 / 启停 / 删除未引用分类跑通；删除被引用分类会返回后端错误 message
  - `/api/admin/site-config`：读取 / 保存 / 公共 `/api/site-config` 读取新值 / 恢复原值 跑通
- ✅ **前台站点配置联动已验证**：Admin 保存 `site-config` 后，公共 `/api/site-config` 可立即读取到新配置；随后已恢复为原值。
- ✅ **用户侧关键路由未被 Admin 改动破坏**：生产预览下 `/models`、`/models/me`、`/contact`、`/auth` 均返回 `200` 页面壳。
- ✅ **阶段 5 收口修复**：
  - 修复 `/admin` 的 hydration mismatch：`web/components/admin/admin-guard.tsx` 先统一渲染“正在校验管理员身份”，避免 SSR/CSR 首屏文案不一致。
  - 修复本地验收环境问题：`next dev` 并发会破坏 `web/.next`，总体验收最终以 `pnpm build` + `pnpm start -- --port 3001` 的稳定预览为准。
  - 修复模型库搜索状态同步 bug：`web/components/pages/model-library-page.tsx` 中点击“全部模型”会同步清空 `searchInput` 与实际请求 `keyword`，回到第 1 页并重新请求全部模型；空搜索点击“搜索”也会按空 keyword 恢复全量列表。
  - 补充 `/admin/users` 角色变更提示：`web/components/admin/admin-users-page.tsx` 在修改用户 `role` 成功后提示“角色已更新，对方需退出并重新登录后生效”；仅改 `status` 时仍提示“用户状态已更新”。
- ℹ️ **当前权限生效机制说明**：
  - JWT access token 内包含 `role`，后端后台接口守卫当前按 token 中的 `role` 判定 admin 权限。
  - 管理员在 `/admin/users` 中变更其他账号角色后，数据库 `role` 会更新，但对方手中的旧 token 不会自动刷新。
  - 被变更账号需退出并重新登录，拿到新的 access token 后，新的角色权限才会生效。
  - 后续如需“角色变更即时生效”，可考虑让后端按 `token.sub` 每次查询数据库最新 `role`，或引入 `tokenVersion` / 强制下线机制。
- ⚠️ **当前仍未实现（二期 / backlog）**：
  - 审计日志
  - 批量操作
  - Excel 导出
  - 回收站恢复
  - OSS / R2 文件清理
  - 更细粒度权限
  - 分类迁移
  - Admin 操作日志

#### 质量门禁快照（CLI，2026-06-02 第一阶段后）

| 命令 | 状态 | 说明 |
|------|------|------|
| `cd server && pnpm lint` | ✅ 可执行 / 0 error 0 warning | 已补 eslint + `.eslintrc.js`（温和规则） |
| `cd web && pnpm lint` | ✅ 可执行 / 0 error / 13 warning | 已补 eslint + eslint-config-next + `.eslintrc.json`；告警均非阻断，未改业务代码（详见「〇之启·十七」） |
| `cd server && pnpm build` | ✅ 通过 | nest build，仅编译，不含 lint/test |
| `cd web && pnpm build` | ✅ 通过 | next build，仅编译，不含 test |
| `cd server && pnpm test` | ✅ 通过 | 当前有 1 组 `uploads.service.spec.ts` 单测（3/3 通过）；**整体覆盖仍不足**，待继续补关键路径测试 |
| `web` 自动化测试 | ❌ 未配置 | 无测试脚本/框架 |

#### 验证口径说明（重要，避免误读历史记录）

- **`ReadLints`** = Cursor/IDE 静态诊断，**不等于** CLI `pnpm lint`；CLI lint 在第一阶段（2026-06-02）才首次补齐可执行。
- **`pnpm build`** = TypeScript/Next/Vite 编译通过，**不等于** ESLint 通过，也不含测试。
- **「冒烟通过/全过」** = 开发期**人工/脚本级 HTTP 联调**（多为 PowerShell `Invoke-RestMethod -NoProxy`，临时脚本测试后已删除），**不等于** `pnpm test` 自动化测试，**不代表测试覆盖率**。
- 下方各历史节（「〇之巅」～「〇之启」）中的「ReadLints 无错误 / 冒烟全过」均按上述口径理解。

#### 上线前安全与一致性修复（2A–2G，当前阶段总览）

> 代码审查后的**上线前加固**子阶段：优先 server 配置/鉴权/一致性，**不改 Vite `src/`**；明细见「〇之启·十八」～「〇之启·二十三」。本节为交接总表，重开对话时优先对照。

##### 已完成（2A–2G）

| 编号 | 主题 | 范围摘要 | 明细节 |
|------|------|----------|--------|
| **2A** | JWT 生产密钥强校验 | `NODE_ENV=production` 时 `JWT_ACCESS_SECRET` 长度 ≥32、禁 dev/占位词；弱密钥**阻止启动** | 〇之启·十八 |
| **2B** | `send-code` IP 限流 | 仅 `POST /api/auth/send-code`：`ThrottlerGuard` 60s/5 次/IP；保留 target+scene 60s 业务限频；其它 auth 接口不受影响 | 〇之启·十九 |
| **2C** | 管理员初始化机制 | `pnpm admin:init` + `ADMIN_*` 环境变量；bcrypt 入库；**非** seed 占位 admin 生产入口 | 〇之启·二十 |
| **2D** | `viewerUrl` 域名白名单 | 外链发布入库前 https + host 白名单（`VIEWER_URL_ALLOWED_HOSTS`）；R2 文件发布路径不校验 | 〇之启·二十一 |
| **2E** | 模型浏览量打点 | `POST /api/models/:id/view` 仅 published+public +1；Next 详情页打开打点一次；GET 详情保持只读 | 〇之启·二十二 |
| **2F** | 作者查看自己的非公开模型详情 | `GET /api/models/:id`：作者可看本人全状态模型；游客/非作者仍仅 published+public；无权限统一 **404**；作者响应含 `status/visibility/rejectReason`；**列表口径不变** | 〇之启·二十三 |
| **2G** | R2 上传安全增强 | `callback` 必须 **HeadObject 成功** 才写 `model_files`；size/mime 以对象存储 HeadObject 为准；超上限/非法 Content-Type 拒绝；**无本地兜底**；presign 仍校验扩展名/大小 | 〇之启·二十四 |

- **2A–2D、2G**：仅 `server/` 配置与校验（+ 文档），无前端 UI 变更。
- **2E**：`server/` + `web/` 打点封装与详情 `useEffect`（**无新增 UI**）。
- **2F**：`server/` 详情可见性 + `web/lib/types.ts` 类型兼容（**未改详情页 UI**）。
- **补记（2026-06-02）**：上传模块配置层已支持 **阿里云 OSS 等 S3 兼容对象存储**；`R2_*` 变量名仅为历史保留，当前实际可用于 S3 兼容对象存储。**阿里云 OSS 真实上传验收已通过**；后续若切回 Cloudflare R2，仍需单独复验真实凭证与桶 CORS。

##### 仍未处理（上线前 backlog）

| 项 | 状态 | 说明 |
|----|------|------|
| **真实对象存储凭证与桶 CORS 端到端验收** | ⚠️ 部分完成 | **阿里云 OSS 已完成验收**：presign → 浏览器 PUT → callback → `POST /api/models` 跑通；**Cloudflare R2 尚未复验** |
| **孤儿 model_files / 上传会话表** | ❌ 二期待办 | 2G 未做 presign→callback 绑定表与定时清理 |
| **大文件多段上传** | ❌ 二期待办 | 仍为单次预签名 PUT |
| **Admin 后台前端** | ✅ 第一版完成 | `/admin`、`/admin/models`、`/admin/leads`、`/admin/training`、`/admin/users`、`/admin/categories`、`/admin/site-config` 已接入并完成阶段 5 总体验收 |
| **关键路径自动化测试** | ⚠️ 覆盖不足 | `server` 当前仅 1 组 uploads 单测；历史「冒烟」多为人工/临时脚本 HTTP 联调；`web` 仍未配置测试 |

##### 本阶段下一步建议（主线）

1. **如需双存储兼容，补做 Cloudflare R2 真实凭证与桶 CORS 复验**（阿里 OSS 已通过）。
2. **部署前准备**：补全生产域名、Cloudflare、1Panel、Docker/Compose 编排与 HTTPS 策略。
3. **生产环境变量检查**：数据库、JWT、短信、对象存储、管理员初始化、`VIEWER_URL_ALLOWED_HOSTS`、CORS 白名单逐项核对。
4. **数据库备份策略**：确定 PostgreSQL 自动备份、恢复演练与 1Panel 备份保留周期。
5. **OSS / R2 生产收口**：确认生产域名、桶 CORS、回源策略、文件访问域名与回调链路。
6. **二期**：孤儿文件清理、多段上传、生产 `trust proxy`（配合 2B IP 限流）、后台批量操作 / 审计日志 / Excel 导出等。

> 其它上线项（生产部署、真实短信、生产 `trust proxy` 配合 2B IP 限流等）仍见「一·续」与 `backend-architecture-plan.md`，不在 2A–2G 表内展开。

#### 当前已完成

- ✅ **上线前安全与一致性修复 2A–2G 已完成**（含上传 callback 必须 HeadObject 确认；总表见上节）。
- ✅ **Next.js 用户侧页面迁移完成**（`web/` 步骤 0–8C + 全局样式）。
- ✅ **Admin 前端阶段 1 已完成**：`/admin` 后台入口、AdminShell、AdminGuard、模块导航占位页与管理员可见的官网入口均已落地；当前只完成后台壳子，业务表格未接。
- ✅ **Admin 前端阶段 2 已完成**：`/admin/models` 已接入真实接口，支持模型列表、状态筛选、详情查看、审核通过、填写驳回原因、软删除与成功/失败 toast。
- ✅ **Admin 前端阶段 3 已完成**：`/admin/leads` 与 `/admin/training` 已接入真实接口，支持列表、状态筛选、详情查看、状态更新与成功/失败 toast；浏览器手工联调统一延后到 Admin 总体验收阶段。
- ✅ **Admin 前端阶段 4 已完成**：`/admin/users`、`/admin/categories`、`/admin/site-config` 已接入真实接口，支持用户启停与角色调整、分类增改启停删除、站点配置读取与保存；浏览器手工联调统一延后到 Admin 总体验收阶段。
- ✅ **Admin 前端阶段 5 已完成**：Admin 前端第一版已完成总体验收与文档收口；主链路已做真实 API 验收，`web/server` lint/build/test 均通过，部署前阻断项已清零。
- ✅ **部署前准备阶段 1 已完成（生产 Docker 产物与 Compose 规划落地）**：
  - 已新增 `web/Dockerfile`：采用 Next.js 生产构建流程，镜像内执行 `pnpm build`，运行期使用 `pnpm start --hostname 0.0.0.0 --port 3000`。
  - 已新增 `deploy/docker-compose.prod.yml`：当前推荐生产编排为 `postgres` + `server` + `web` 三服务；`postgres` 使用 `postgres:16` + volume 持久化；`server/web` 仅 `expose` 内网端口，不直接暴露公网。
  - 已新增 `deploy/.env.prod.example`：收口 PostgreSQL、NestJS、Next.js、OSS/R2、Admin 初始化所需生产变量占位，**未写入任何真实密钥**。
  - 生产访问模式已固定为：`https://你的正式域名/` → `web:3000`，`https://你的正式域名/api/*` → `server:4000/api/*`，由 **1Panel / OpenResty** 配置域名、HTTPS 与反向代理；`NEXT_PUBLIC_API_BASE_URL=/api`。
  - 上线流程建议已固定：先启动 `postgres`，再执行 `server` 容器内 `pnpm prisma:deploy`，随后执行 `pnpm admin:init`，最后启动 `server` 与 `web`，完成反代与 SSL 配置。
  - 生产环境明确不建议执行 `seed`；管理员请统一使用 `admin:init` 创建；OSS/R2 桶 CORS 需加入正式站点域名；`JWT_ACCESS_SECRET` 必须使用强随机值。
- ✅ **部署前准备阶段 3 已完成（部署产物小收口）**：
  - 根目录 `.gitignore` 已新增忽略：`deploy/.env.prod`、`deploy/.env.*.local`，避免生产 / 本地部署环境变量误提交。
  - 已新增 `deploy/docker-compose.prod.local.yml`：仅供**本地 Docker 生产模拟冒烟**使用，为 `server` 映射 `4000:4000`、为 `web` 映射 `3000:3000`。
  - 本地测试推荐命令已固定为：`docker compose -f docker-compose.prod.yml -f docker-compose.prod.local.yml --env-file .env.prod up -d`。
  - 生产策略保持不变：正式服务器仍只使用 `deploy/docker-compose.prod.yml`，容器端口不直接暴露公网，继续由 **1Panel / OpenResty** 做 `/` → `web:3000`、`/api` → `server:4000/api` 反向代理。
- ✅ **已迁移页面/模块**：Home（`/`）、About（`/about`）、Contact（`/contact`）、Auth（`/auth`）、Community（`/community`）、Models 列表（`/models`）、ModelDetail（`/models/[id]`）、PersonalCenter（`/models/me`）、UploadModal、TrainingModal、NavBar + AppProviders。
- ✅ **API 接入已完成**（Next `web/lib/api/*` 与 Vite 对齐）：auth、models/categories、点赞/收藏、users/me、contact、training-applications、site-config、uploads 发布链路（viewerUrl 已验；R2 直传代码路径保留）。
- ✅ **上传模块配置层已兼容阿里云 OSS**：`server/src/modules/uploads/r2.service.ts` 现支持 `R2_REGION` / `R2_FORCE_PATH_STYLE`，`R2_ENDPOINT` 仍优先显式填写，`R2_ACCOUNT_ID` 仅作为 Cloudflare R2 fallback；**不改前端、不改上传业务流程**。
- ✅ **个人中心封面显示已收口（运行态确认）**：
  - 静态代码排查：后端 VM 已映射 `coverUrl`（`model.vm.ts` / `users.vm.ts`），前端 `personal-center-page.tsx` 的 `CoverPreview` 已读取并渲染 `coverUrl`，有值时显示图片、为空或加载失败回退渐变/图标占位。
  - 运行态数据库只读查询：`models` 表最新 20 条中除接口测试模型（id=12）外，`cover_url` 均为空串；`model_files (kind='cover')` 有 4 条封面记录，其中 3 条为 uid=22 用户的 OSS 真实 URL，1 条为 uid=12 的测试占位 URL。
  - OSS 封面 URL 验证：`https://shujingspace.oss-cn-shenzhen.aliyuncs.com/cover/22/...` 返回 HTTP 200，可正常访问。
  - 用户重新发布带封面的模型后，`/models/me` 个人中心卡片可正常显示封面。
  - **根因**：旧模型 `models.cover_url` 为空（发布时未关联 `coverFileId` 或发布时间早于封面链路完成），非当前代码 bug。
  - **后续处理**：新发布模型选择封面即可正常显示；旧数据如需显示封面，可在确认封面 `model_files.url` 与模型对应关系后，手动 `UPDATE models SET cover_url = '<OSS URL>' WHERE id = <目标模型ID>`。
- ✅ **小问题阶段 1（全站 toast 样式 + 删除确认流程）已完成**：
  - `web/components/providers/app-providers.tsx` 已将全站 `Toaster` 收口为统一配置：顶部居中、最多 3 条、支持关闭按钮。
  - `web/components/ui/sonner.tsx` + `web/styles/theme.css` 已统一 toast 视觉风格：深色半透明背景、细白灰边框、圆角、轻阴影/模糊，成功仅用轻微冰蓝点缀，错误仅用低饱和红点缀；各页面原有 `toast.success / toast.error` 调用保持不变。
  - 联系表单提交成功已补充统一 success toast，登录成功 / 模型发布成功 / 删除成功会复用同一套全站样式。
  - `web/components/pages/model-detail-page.tsx` 的删除流程已校正：继续沿用 `window.confirm`，但仅在用户确认后才调用 `DELETE /api/users/me/models/:id`；取消时不发请求、不弹成功、不跳转；成功只在接口成功后 toast；失败仅显示错误。
  - 删除按钮已补 `stopPropagation()` 与 `deletePending` 禁用态，避免重复点击；**本阶段未替换为站内确认弹窗**，后续可升级为统一风格 `AlertDialog`。
- ✅ **小问题阶段 2（删除确认升级为站内轻量弹窗）已完成**：
  - `web/components/pages/model-detail-page.tsx` 已移除 `window.confirm`，改为页内轻量删除确认弹窗：深色半透明遮罩、黑灰面板、细白灰边框、圆角、低饱和红色危险按钮，视觉与官网黑白灰科技风保持一致。
  - 点击「删除模型」按钮时仅打开确认弹窗；点击「取消」只关闭弹窗，不调用 `DELETE /api/users/me/models/:id`、不 toast 成功、不跳转。
  - 点击「确认删除」后才调用删除接口；接口成功后才 toast「模型已删除」并跳转 `/models/me`；接口失败仅显示错误 toast。
  - 删除请求进行中，确认按钮会进入 loading，取消按钮、遮罩关闭、右上角关闭和 `Esc` 关闭全部禁用，避免状态混乱。
  - 当前删除仍为**软删除**；前台不可恢复；相关 OSS / R2 文件**不会立即删除**。
- ✅ **模型删除管理阶段 1（后端软删除基础能力）已完成**：
  - `models` 表已新增软删除字段：`deleted_at`、`deleted_by`、`delete_reason`；迁移：`20260602135405_add_model_soft_delete`。
  - 已新增 `DELETE /api/users/me/models/:id`：仅登录用户可删除自己的模型；只做软删除；重复删除幂等。
  - 已新增 `DELETE /api/admin/models/:id`：仅 admin 可删除任意模型；支持可选 `deleteReason`；只做软删除；重复删除幂等。
  - 本阶段**明确不做**：删除 `model_files`、删除 `likes/favorites`、删除真实 OSS/R2 文件、前端删除按钮。
- ✅ **模型删除管理阶段 2（`deletedAt` 查询过滤与接口口径收口）已完成**：
  - 公开模型列表 `/api/models` 已统一过滤 `deletedAt = null`。
  - 公开模型详情 `/api/models/:id` 已统一口径：游客、非作者、作者本人都不能查看已软删除模型；已删除统一 `404`，**本阶段不做回收站**。
  - 浏览量 `/api/models/:id/view` 已统一过滤 `deletedAt = null`，已删除模型不能继续累加浏览量。
  - 点赞 / 收藏已统一口径：已删除模型不能新增点赞/收藏；取消点赞 / 取消收藏保留幂等处理。
  - 个人中心 `/api/users/me/models`、`/api/users/me/published`、`/api/users/me/stats` 默认不包含 `deletedAt != null` 的模型。
  - 我的收藏 `/api/users/me/favorites` 保留收藏记录；若模型已软删除，则返回 `isAvailable = false`，前端应视为失效收藏，不再进入公开详情。
  - 后台 `/api/admin/models` 默认仅展示未删除模型；`/api/admin/models/:id` 仍允许查看已删除模型，并返回 `deletedAt / deletedBy / deleteReason` 便于审计。
  - 本阶段继续**明确不做**：回收站、物理硬删除、删除真实 OSS/R2 文件、删除 `model_files`、删除 `likes/favorites`。
- ✅ **模型删除管理阶段 3（Next 删除入口迁移到作者详情页）已完成**：
  - `web /models/me` 的「我的模型」卡片已移除删除入口，保留卡片点击进入详情页的路径，不影响「我的收藏 / 我的发布 / 我的申请」。
  - `web /models/[id]` 已新增作者专属删除入口；仅当前登录用户满足 `auth.user.id === detail.userId` 时显示，游客与非作者不显示。
  - 删除前会弹确认文案：删除后模型将不再展示，相关文件暂不会立即从对象存储删除。
  - 确认后调用 `DELETE /api/users/me/models/:id`；删除成功后 toast 提示“模型已删除”，并跳转 `/models/me`。
  - 当前前端接入仍为**软删除**；真实 OSS/R2 文件不会立即删除。
  - Admin 前端删除按钮仍**未做**；admin 回收站 / restore 仍属二期待办。
- ✅ **模型删除管理阶段 4（总体验收与文档收口）已完成**：
  - 已完成第一版删除管理验收：`server pnpm lint/build/test`、`web pnpm lint/build` 全部通过。
  - HTTP 冒烟已验证：用户删除自己的模型成功；用户删除他人模型失败；admin 删除任意模型成功；普通用户访问 admin 删除接口返回 `403`；未登录删除接口返回 `401`；删除后 `/api/models`、`/api/models/:id`、`/api/users/me/models`、`/api/users/me/stats` 口径符合预期；`/api/health` 返回 `db: up`。
  - 当前删除管理第一版结论：**仅软删除模型记录**，不做 restore / 回收站，不做物理硬删除，不删除 `model_files`，也**不会立即删除 OSS/R2 文件**。
  - 当前仍未实现：**Admin 后台前端删除按钮**、站内统一确认弹窗、删除审计日志、恢复模型、硬删除、对象存储文件清理。

#### 当前未完成

| 项 | 状态 |
|----|------|
| 真实对象存储文件直传端到端 | ⚠️ 阿里 OSS 已通过；Cloudflare R2 尚未复验 |
| 后台 Admin 前端 | ✅ Admin 第一版完成：`/admin`、`/admin/models`、`/admin/leads`、`/admin/training`、`/admin/users`、`/admin/categories`、`/admin/site-config` 已完成验收收口 |
| 线上生产部署 | ❌ Docker/Cloudflare/域名/生产短信 |
| Admin 回收站 / restore | ❌ 二期待办 |
| 关键路径自动化测试 | ⚠️ `server` 已有 `users/models/admin/uploads/interactions` 单测；`web` 仍无自动化用例 |
| `/models/me` hydration mismatch | ⚠️ 待单独定位并修复 |
| BIM/IFC 原生 Viewer | ❌ 尚未接入 |

#### 建议下一步（当前主线）

1. **如需双存储兼容，补做 Cloudflare R2 真实凭证与桶 CORS 复验**（阿里 OSS 已通过）。
2. **部署前准备**：1Panel + Docker 部署脚本、生产环境变量、域名 / HTTPS / Cloudflare 策略。
3. **数据安全**：数据库备份与恢复演练、对象存储生产域名与 CORS 收口。
4. **后台二期规划**：批量操作、审计日志、Excel 导出、回收站 / restore。
3. **模型删除管理二期**：设计恢复模型 / 回收站、物理硬删除、OSS/R2 文件清理、删除审计日志。
4. **交互收口**：将当前原生 `confirm` 升级为站内统一确认弹窗。
5. **专项问题拆单**：单独修复 `/models/me` hydration mismatch。
6. **模型展示能力**：推进 BIM/IFC 原生 Viewer 接入。
7. **补齐关键路径自动化测试**：继续扩展 `web` 与更高层集成验收。

> 可选：按 `docs/frontend-acceptance-checklist.md` 在 **`:3000`** 做浏览器全量勾选；UI 差异可对照 **`:5173`**。2A–2F 已落地项见上表，无需重复开发。

### 一、当前阶段已完成

- **前端静态阶段**：首页 Home、NavBar、ModelCommunity、ModelLibrary、AboutUs、AuthPage、ContactPage 已完成主要页面交互修复 + 全量中文注释（详见第二节）。
- **iframe Viewer 技术验证已完成**：`ModelDetailPage` 支持 `viewerUrl` 时 iframe 内嵌外部三维 Viewer、无链接回退占位 UI（当前 Sketchfab 链接仅技术验证，详见第二节第 11 项）。
- **前端验收清单**：`docs/frontend-acceptance-checklist.md` 已创建（全站手动验收清单）。
- **最终技术栈已确定**：Ubuntu 22.04 + 1Panel + Docker/Compose + Next.js（**生产目标前端**）+ NestJS（后端）+ PostgreSQL + Cloudflare R2 + Cloudflare CDN/DNS/SSL/WAF；前后端分离。**`src/` Vite 原型保留为 UI 对照基准**；**`web/` Next.js 用户侧页面已迁完（步骤 0–8C）**（详见「一·续三」、`AGENTS.md`）。
- **后端架构方案**：`docs/backend-architecture-plan.md` 已创建（架构/部署/建表/接口/环境变量的第一依据）。
- **NestJS 后端骨架已完成**：`server/`（NestJS 10 + Prisma 6 + zod）骨架落地，含统一响应/异常/校验、Swagger、健康检查、Dockerfile（详见「〇之中」节）。
- **本地编排**：`deploy/docker-compose.dev.yml` 已创建。
- **PostgreSQL Docker 本地库已跑通**：`postgres:16` 容器 `pg_isready` 通过。
- **Prisma 10 张业务表已建模并迁移**：`schema.prisma` 落地 10 张表 + 9 个 Prisma enum；首个迁移 `20260531144140_init_schema` 已应用（详见「〇之下」节）。
- **seed.ts 已导入初始数据**：幂等灌入 4 分类 / 8 用户（1 admin + 7 作者）/ 10 模型 / 4 站点配置，并对齐自增序列（详见「〇之下」「〇之上」节）。
- **`/api/auth/*` 认证模块第一版已完成**：JWT（access-only）+ bcryptjs + 验证码 mock；BigInt 序列化已处理；唯一约束 P2002 已捕获（详见「〇之上」节）。
- **认证接口冒烟均已通过**：`send-code` / `register` / `login` / `me` / `reset-password` / `logout` 全流程及负向用例均通过。
- **`/api/categories` + `/api/models` 模型/分类读接口已完成**：`GET /api/categories`、`GET /api/models`（type/keyword/sort/page/pageSize）、`GET /api/models/:id` 三接口落地并全量冒烟通过（详见「〇之巅」节）。
- **R2 上传 + 模型发布接口第一版已完成**（开发顺序第 6 步，详见「〇之顶」节）：
  - `POST /api/uploads/presign` 已完成：校验扩展名白名单 + 大小上限，生成安全 key 并返回 R2 预签名直传地址。
  - `POST /api/uploads/callback` 已完成：校验 key 归属，登记 `model_files` 并返回可访问 URL。
  - `POST /api/models` 已完成：按 `type` 反查分类、按 `fileId` 反查上传文件，写入模型并返回详情。
  - `JwtAuthGuard` 已保护上述三接口（均需 Bearer Token）。
  - `model_files` 已保存 `r2Key / url / mime / size / originalName`。
  - `models` 已保存 `modelUrl / coverUrl / viewerType / allowIframe`（DB 只存元信息，不存二进制）。
  - 冒烟通过：未登录访问 → **401**；非法扩展名 → **400**；空 R2 配置 → **503 且无本地兜底**；越权 callback → **403**。
  - 冒烟通过：dummy R2 下 presign / callback / create model 全链路（`viewerType=native`、`fileFormat=glb`、URL 为 R2 域）。
  - 冒烟通过：`GET /api/models` 可查到新发布模型；`GET /api/models/:id` 字段完整（含 `viewerUrl/viewerType/allowIframe`）。
  - `GET /api/health` 仍 `db:up`；`pnpm build` Exit code 0、ReadLints 无错误。
- **第 7 步·第一阶段（点赞/收藏 + 读接口附带互动状态）已完成**（详见「〇之极」节）：
  - `OptionalJwtAuthGuard` 已落地：有效 Token 解析挂 `req.user`，无/失效 Token 静默放行（游客态），**不抛 401**。
  - `GET /api/models`、`GET /api/models/:id` 已改用 `OptionalJwtAuthGuard`：**游客仍可访问**；登录态额外附带 `isLiked` / `isFavorited`（游客不返回该两字段）。
  - 列表 isLiked/isFavorited **批量查询**（按当前页 modelId `in` 查 likes/favorites 构造 Set），**无 N+1**。
  - `POST/DELETE /api/models/:id/like`、`POST/DELETE /api/models/:id/favorite` 已落地，均需 `JwtAuthGuard`；**事务**内维护明细表 + `likesCount/favoritesCount`，**幂等**（重复点赞/收藏不重复加），**取消不为负**（仅存在明细才减 + `>=0` 兜底）。
  - 互动仅允许对「已发布 + 公开」模型操作，否则 **404**。
  - 冒烟全过：游客详情无 isLiked；点赞 368→369、重复点赞仍 369、取消回 368、再取消仍 368；收藏 0→1→幂等 1→取消 0→再取消 0；未登录点赞/收藏 → **401**；点赞不存在模型 → **404**；非数字 id → **400**；游客列表正常（`total=12`，无 isLiked）。
  - `pnpm build` Exit code 0、ReadLints 无错误。
- **第 7 步·第二阶段（个人中心 `/api/users/me/*`）已完成**（详见「〇之巅·二」节）：
  - 新建 `UsersModule`，5 个接口全部挂 `JwtAuthGuard`：`GET /api/users/me/models`（本人全部状态，`status=all/draft/pending/published/rejected` 过滤）、`/me/published`（仅 published）、`/me/favorites`（含 `isFavorited/isAvailable/favoritedAt`）、`/me/applications`（无数据返回空数组）、`/me/stats`（六项计数）。
  - 所有查询严格 `where:{ userId }`，**禁止越权**；id/计数均 BigInt→number。
  - **不实现**：编辑资料 / 删除模型 / 审核 / 训练申请提交；个人信息复用 `GET /api/auth/me`。
  - 冒烟全过：游客访问 5 个 `me/*` 全 **401**；A 发布 public(published)+review(pending) 后 `me/models(all)=2`、`?status=published=1`、`?status=pending=1`、`rejected=0`、`draft=0`；`me/published` 与 `?status=published` id 一致；收藏 seed#1 后 `me/favorites` 含该项（`isFavorited=true/isAvailable=true/favoritedAt` 有值），取消后归零；`me/applications` 空数组 `total=0`；`me/stats` = models2/published1/pending1/rejected0/favorites0/applications0 且与各列表 total 对齐；用户 B 看不到 A 数据（0/0/0）；非法 status → **400**；`/api/health` 仍 `db:up`。
  - `pnpm build` Exit code 0、ReadLints 无错误。
  - **第 7 步互动 + 个人中心整体收尾，下一步进入第 8 步（表单线索类）。**
- **第 8 步·阶段一（联系线索 ContactModule）已完成**（详见「〇之渊」节）：
  - `POST /api/contact/leads`（游客可提交，无 Guard）：DTO 校验 name/contactWay 必填、email 选填须合法、message ≤2000、其余字段长度对齐 `contact_leads`；`status` 固定 `new`；`dataTypes` 以 Json 数组入库；可选字段未填存 null；回执仅 `{id,status,createdAt}`。
  - `GET /api/contact/options`（游客可访问）：返回 `scenes/dataTypes/stages/budgets` 四组选项，逐字对齐前端 `ContactPage.tsx` 写死文案（后端常量 `contact.constants.ts`，单一数据源）。
  - 冒烟全过：`options` 返回 4 组选项；游客提交成功（`id=1,status=new`）；缺 name → **400**、缺 contactWay → **400**、非法 email → **400**；`/api/health` 仍 `db:up`。
  - `pnpm build` Exit code 0、ReadLints 无错误。
- **第 8 步·阶段二（训练数据服务申请 TrainingModule）已完成**（详见「〇之滨」节）：
  - `POST /api/training-applications`（`OptionalJwtAuthGuard`，游客/用户均可）：DTO 校验 contactName/contactWay/company/robotType/sceneDesc 必填、trainTasks 选填数组、长度对齐 `training_applications`；`status` 固定 `submitted`；`trainTasks` 以 Json 数组入库；**登录则回填 userId，游客为 null**；回执仅 `{id,status,createdAt}`。仅服务「具身智能机器人训练场景」，无扩展类型字段。
  - `GET /api/training-applications/my`（`JwtAuthGuard`）：未登录 → 401；严格 `where:{userId}`；复用 `toMyApplicationVm`，**与 `GET /api/users/me/applications` 字段/排序完全一致**。
  - 冒烟全过：游客提交 `id=1,status=submitted`；用户 A 提交 `id=2`；缺 sceneDesc/contactName/company → **400**；未登录 `/my` → **401**；A 的 `/my` `total=1,ids=[2]`（含本人、**不含游客 id=1，证明游客 userId=null**）；`/my` 与 `users/me/applications` 的 total/id 集/字段集三者一致；`/api/health` 仍 `db:up`。
  - `pnpm build` Exit code 0、ReadLints 无错误。
  - **第 8 步（表单线索类）整体收尾，下一步进入第 9 步（后台管理 Admin）。**
- **第 9 步·后台管理 Admin 已完成**（详见「〇之巅·三」节）：
  - 新建 `AdminModule`（`imports:[AuthModule]`），按域拆 5 个 Controller + 5 个 Service，全部 `/api/admin/*` 类级挂 `JwtAuthGuard + RolesGuard + @Roles('admin')`：未登录 → **401**、普通用户 → **403**。
  - **模型审核**：`GET /api/admin/models`（全状态，status/type/keyword/分页）、`GET /api/admin/models/:id`、`PATCH /api/admin/models/:id/status`（approve 仅 pending→published；reject 仅 pending→rejected 且 rejectReason 必填；非 pending 审核 → 400）。
  - **用户管理**：`GET /api/admin/users`（keyword/role/status/分页，**VM 脱敏不含 passwordHash**）、`PATCH /api/admin/users/:id/status`（启用/禁用 + 调角色；**禁止禁用/降级当前登录管理员自己** → 400）。
  - **分类管理**：`GET/POST/PUT/DELETE /api/admin/categories`（后台全量含未启用 + modelCount；name/slug 重复 → 409；删除被模型引用分类 → 400，引导停用 isActive=false）。
  - **联系线索管理**：`GET /api/admin/leads`（status/keyword/分页）、`PATCH /api/admin/leads/:id/status`（LeadStatus 枚举）。
  - **训练申请管理**：`GET /api/admin/training-applications`（status/keyword/分页，含申请人/游客区分）、`PATCH /api/admin/training-applications/:id/status`（TrainingStatus 枚举）。
  - 冒烟全过（13 项）：401/403/admin 列表；approve→published、reject→rejected+reason、非 pending 重审 400、reject 缺 reason 400；用户列表无 passwordHash、禁用/降级自己 400、禁用普通用户 200；分类列表/新增(201)/重复 409/停用/删除未引用 200/删除被引用 400；线索列表+改状态+非法状态 400；申请列表+改状态；`/api/health` 仍 `db:up`。
  - **不实现**：audit_logs 审计、后台前端页面（按本次约定）。
  - `pnpm build` Exit code 0、ReadLints 无错误。
  - **第 9 步（后台管理）整体收尾。**
- **站点配置 SiteConfigModule 已完成**（第 9 步补充，详见「〇之巅·四」节）：
  - `GET /api/site-config`（游客）：返回 6 个白名单字段 `phone/email/address/icp/companyName/footerText`，缺失键回退默认值（默认值取自前端 Footer 写死文案）。
  - `GET /api/admin/site-config`（admin）：读取当前配置；`PUT /api/admin/site-config`（admin）：`{items:[{key,value}]}` 批量 upsert，key 限白名单字段，幂等。
  - 两个 admin 接口类级 `JwtAuthGuard + RolesGuard + @Roles('admin')`：未登录 → **401**、普通用户 → **403**。
  - 冒烟全过：游客 GET 200 含 6 字段；未登录 GET/PUT → 401；普通用户 GET/PUT → 403；admin 读取/批量更新成功且游客 GET 反映新值；非白名单 key → 400、空 items → 400；`/api/health` 仍 `db:up`。
  - 不改 `schema.prisma`（`site_configs` 表已存在）、不做后台前端页面、不改前端 `src/`。
  - `pnpm build` Exit code 0、ReadLints 无错误。
  - **site-config 收尾，下一步进入第 10 步（前端迁移 Next.js）。**
- **第 10 步·前置阶段一（前端 API 网络层基建）已完成**（2026-06-01，`src/lib/`，详见「〇之始·前端接入」节）：
  - 在**当前 Vite 原型**内先行落地前端访问后端的基础设施（不迁移 Next.js、不接具体页面业务、不改任何页面 UI / 业务逻辑）。
  - 新增 `.env.example`（`VITE_API_BASE_URL=/api`）；`vite.config.ts` 增加 dev proxy `/api → http://localhost:4000`（`changeOrigin`），规避 Vite(5173) 与后端(4000) 跨域。
  - 新增网络层：`src/lib/token.ts`（get/set/clearToken，localStorage `sj_token`）、`src/lib/http.ts`（统一读 `VITE_API_BASE_URL`、自动带 Bearer、解析 `{code,message,data}`、`code!==0` 或 HTTP 非 2xx 抛 `ApiError`、401 清 token）、`src/lib/types.ts`（`ApiResponse/PaginatedResponse/User/Category/ModelListItem/ModelDetail/SiteConfig` 等）、`src/lib/useRequest.ts`（loading/error/data/run/reset 三态 + 竞态保护）、`src/lib/format.ts`（`formatViews/formatRelativeTime/coverStyleByType`，补回后端不返回的封面视觉/数值/时间展示）、`src/lib/api/siteConfig.ts`（`getSiteConfig` 连通性验证 + 后续 Footer 复用）。
  - `src/app/App.tsx` 仅新增全站 `<Toaster/>`（复用既有 `components/ui/sonner`，sonner 已在依赖）；各页面提前 return 分支以共享元素挂载，未改页面 UI/逻辑。`src/vite-env.d.ts` 补 `VITE_API_BASE_URL` 类型。
  - 验证：`pnpm build` Exit code 0（1614 模块）、ReadLints 无错误；`pnpm dev`(5173) + 后端(4000) 同时运行下，经代理 `GET http://localhost:5173/api/site-config` 返回 `{code:0,...}`，与直连 4000 一致，连通性通过。
  - **未接任何页面业务、未调用 toast、未删除 `communityData.ts`（仍为验收基准）。下一步可按计划接入登录态地基与站点配置等页面。**
- **第 10 步·前置阶段二（登录态地基 + AuthPage 接 `/api/auth/*`，即第 10B）已完成**（2026-06-01，`src/`，详见「〇之续·登录态地基」节）：
  - 新增 `src/lib/api/auth.ts`（封装 `send-code/register/login/reset-password/me/logout` 六接口，公开接口 `auth:false`）、`src/app/AuthContext.tsx`（`AuthProvider` + `useAuth`：`user/isAuthed/bootstrapping/setAuth/logout/refresh`，挂载时若有 token 调 `GET /auth/me` 自举恢复登录态）。
  - `src/lib/types.ts` 给 `User` 补 `roleType?`（对齐后端 `me` 返回）。
  - `src/app/App.tsx` 用 `<AuthProvider>` 包裹（拆出 `AppContent`），给 `AuthPage` 注入 `onNavigateModels`（成功跳模型库，方案 B）。
  - `src/app/AuthPage.tsx` 全表单改受控 + 接入真实接口 + loading/error/success 三态（sonner toast）：登录（密码/验证码）、注册、找回密码（发码 scene=reset + 重置）；**发码成功后才启动 60s 倒计时**；**开发环境 `devCode` 用 toast 提示**便于联调；登录/注册成功 `setAuth` 保存 token 后跳模型库。
  - `src/app/NavBar.tsx` 用 `useAuth` 条件渲染：未登录「注册/登录」；已登录「用户昵称 + 退出登录」（PC 与移动端均覆盖），退出后返回首页 + toast。
  - 验证：`pnpm build` Exit code 0（1618 模块，较前 +4）、ReadLints 无错误；经 Vite 代理(5173)→后端(4000) 跑通 send-code / register / me / login(password) / login(code) / reset-password+新密码登录 / logout 全流程（`code:0`），错误密码负向 → 401。
  - **未触碰后端 `server/`、未接模型库/上传/个人中心、未删 `communityData.ts`。临时联调脚本 `server/__smoke_auth.ps1` 测试后已删除，不入库。**
- **第 10 步·阶段三～七（10C–10G，Vite 页面接后端）已完成**（2026-06-01，详见「〇之衍」「〇之澜」「〇之澂」「〇之埠」「〇之港」节）：
  - **10C**：`ModelLibrary` 列表/详情接 `GET /api/categories`、`GET /api/models`、`GET /api/models/:id`。
  - **10D**：点赞/收藏写接口 + 个人中心五接口 `GET /api/users/me/*`。
  - **10E**：`ContactPage` 接 `GET /api/contact/options`、`POST /api/contact/leads`；`TrainingModal` 接 `POST /api/training-applications`。
  - **10F**：`ModelCommunity` 精选接 `GET /api/models`；全站 Footer/联系侧栏接 `GET /api/site-config`（`SiteConfigContext`）。
  - **10G**：`UploadModal` 接 `POST /api/uploads/presign|callback` + `POST /api/models`；**viewerUrl 外链发布已在本环境验证**；R2 文件直传待凭证（见下「上传发布状态」）。
- **第 10H·全站前后端联调验收与文档收尾已完成**（2026-06-01，**仅文档**，未改 `src/`、`server/`）：
  - 更新 `docs/frontend-acceptance-checklist.md`：已接后端项标注为「🔌 真实接口验收」；区分 UI 验收与接口验收；补充未完成项（R2 直传 / Next.js / 后台前端 / 线上部署）。
  - 更新 `docs/dev-checkpoint.md`：归档前端页面层已接入 API 清单、上传发布状态、未完成项与建议验收顺序（见下「一·续」「一·续二」「二·补」）。
  - **本步不执行浏览器全量勾选验收**（留验收人按清单逐项填写）；不清理 dev 库、不配置 R2、不启动 Next.js 迁移。
- **第 11 步·阶段 0–2（Next.js web/ 骨架 + API 连通性）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/` Vite 原型、`server/` 后端）：
  - 新建 `web/` Next.js 15 App Router 工程（TypeScript + Tailwind CSS 4 + `@/*` 别名）。
  - 配置 `NEXT_PUBLIC_API_BASE_URL=/api`（`web/.env.example` / `web/.env.local`）；`next.config.ts` dev rewrites：`/api/:path* → http://localhost:4000/api/:path*`。
  - 自 Vite `src/lib/` 平移最小网络层：`lib/http.ts`（env 改为 `NEXT_PUBLIC_API_BASE_URL`）、`token.ts`、`types.ts`、`lib/api/siteConfig.ts`。
  - Smoke 页：`web/app/page.tsx` + `components/site-config-smoke.tsx`，浏览器调用 `GET /api/site-config` 展示 `companyName/phone/email`（**非正式首页 UI**）。
  - **未迁移**：NavBar、AuthContext、Home/Community/Models 等业务页面；Vite `src/` 仍为 UI 验收基准。
  - 验证：`web/` 内 `pnpm install` + `pnpm build` Exit code 0；`pnpm dev`(3000) 下 `curl --noproxy http://127.0.0.1:3000/api/site-config` 返回 `{code:0,...}`（经 rewrites 转发 4000，与直连后端一致）。
  - **下一步**：~~步骤 3（Providers + layout）~~ → 逐页迁移 About/Contact/Auth/Home/Community/Models（见下「步骤 3」）。
- **第 11 步·阶段 3（Next.js AppProviders 基础层）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/` Vite 原型、`server/` 后端）：
  - 新增 `web/components/providers/app-providers.tsx`（`ThemeProvider` 固定 `dark` + `AuthProvider` + `SiteConfigProvider` + 全站 `<Toaster/>`）。
  - 新增 `web/components/providers/auth-provider.tsx`（自 Vite `AuthContext.tsx` 平移：`getToken` 自举、`getMe`、`setAuth`、`logout`、`bootstrapping`）。
  - 新增 `web/components/providers/site-config-provider.tsx`（自 Vite `SiteConfigContext.tsx` 平移：`DEFAULT_SITE_CONFIG` 兜底 + `GET /api/site-config`）。
  - 新增 `web/lib/api/auth.ts`（供 AuthProvider 自举，后续 AuthPage 复用）。
  - 新增 `web/components/ui/sonner.tsx`；`web/package.json` 增加 `sonner@2.0.3`、`next-themes@0.4.6`。
  - 改 `web/app/layout.tsx`：`<html className="dark" suppressHydrationWarning>` + 包裹 `<AppProviders>`。
  - 改 `web/app/globals.css`：补 `--popover` / `--border` 等 sonner 所需 CSS 变量子集。
  - 改 `web/components/site-config-smoke.tsx`：改读 `useSiteConfig()` / `useAuth()`（避免与 Provider 重复请求）；`/` 仍为连通性 smoke 页，**非正式首页**。
  - **未迁移**：NavBar、AuthPage、Home/Community/Models 等业务页面 UI。
  - 验证：`web/` 内 `pnpm install` + `pnpm build` Exit code 0；`pnpm dev` 下 `http://localhost:3000/` HTTP 200；`GET /api/site-config` 经 rewrites `{code:0}`；页面展示「步骤 3」+ Provider 加载站点配置 + Auth 自举摘要；`layout` 使用 `suppressHydrationWarning` 规避 next-themes 类名 hydration 警告。
  - **下一步**：~~步骤 4 起逐页迁移 About / Contact~~ → 步骤 4A NavBar + 路由壳已完成（见下）；步骤 4B+ 逐页迁入正式 UI。
- **第 11 步·阶段 4A（Next.js NavBar + 基础路由壳）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/layout/NavBar.tsx`（自 Vite `NavBar.tsx` 迁移：`next/link` + `usePathname`/`useRouter`，保留 PC/移动端样式、菜单滚动锁定、登录态展示与退出）。
  - 新增 `web/components/layout/site-chrome.tsx`（`/auth` 不挂载 NavBar，与 Vite AuthPage 独立顶栏一致；其余路由 `pt-16 md:pt-[72px]`）。
  - 新增 `web/components/layout/page-placeholder.tsx`；路由占位：`/`、`/community`、`/models`、`/about`、`/contact`、`/auth`。
  - 新增 `web/public/logo.png`（自 `src/imports/____logo_1_.png` 复制）；`web/package.json` 增加 `lucide-react`。
  - 改 `web/app/layout.tsx` 挂载 `SiteChrome`；删除步骤 0–2 的 `site-config-smoke.tsx`（首页改为占位壳）。
  - **未迁移**：About/Contact/Home 等正式页面内容、AuthPage 表单 UI。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`pnpm dev` 下各路由 HTTP 200，NavBar 链接可跳转，`/auth` 无顶栏 NavBar。
  - **下一步**：~~步骤 4B About~~ → Contact / Auth / Home / Community / Models 正式 UI。
- **第 11 步·阶段 4B（Next.js AboutUs 正式页）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/pages/about-us.tsx`（自 Vite `AboutUs.tsx` 迁移：移除内嵌 NavBar、改用 `Link` 路由、`useSiteConfig` Footer；保留 HeroRightVisual 预留组件）。
  - 新增 `web/public/about-hero.png`（自 `src/imports/____-1.png`）；改 `web/app/about/page.tsx` 挂载正式页。
  - Hero 负 margin + `pt-16` 与 Vite 全屏 Hero + 固定 NavBar 叠层对齐。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/about` 含「让真实世界」「核心能力」「我们是谁」等原文案。
  - **下一步**：~~步骤 4C Contact~~ → Auth / Home / Community / Models 正式 UI。
- **第 11 步·阶段 4C（Next.js ContactPage 正式页）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/pages/contact-page.tsx`（自 Vite `ContactPage.tsx` 迁移；`Link` 路由；`useSiteConfig` Footer/侧栏）。
  - 新增 `web/lib/api/contact.ts`（`getContactOptions`、`createLead`）。
  - 改 `web/app/contact/page.tsx`；表单保留 loading / success / error 三态与 `GET /api/contact/options`、`POST /api/contact/leads`。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/contact` 约 7.27 kB 客户端包。
  - **下一步**：~~步骤 4D AuthPage~~ → Home / Community / Models 正式 UI。
- **第 11 步·阶段 4D（Next.js AuthPage 正式页）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/pages/auth-page.tsx`（自 Vite `AuthPage.tsx` 迁移；独立顶栏；`useAuth` + `web/lib/api/auth.ts`）。
  - 改 `web/app/auth/page.tsx`；`/auth` 不挂载全站 NavBar（`SiteChrome` 已有逻辑）。
  - 登录/注册成功 `router.push('/models')`；Logo/返回官网 `Link` → `/`。
  - 保留：Tab、密码切换、验证码登录、60s 倒计时、协议勾选、找回密码/重置密码、loading/error/success 三态。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/auth` 约 6.2 kB 客户端包。
  - **下一步**：~~Home 首页~~ → Community / ModelLibrary 正式 UI。
- **第 11 步·阶段 5（Next.js Home 首页正式页）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/pages/home-page.tsx`（自 Vite `App.tsx` 首页分支迁移：Hero、业务平台、业务场景、CTA、Footer；`Link`/`useRouter` 替代 `setPage`；`useSiteConfig` Footer）。
  - 新增 `web/components/home/video-modal.tsx`（Esc/遮罩/关闭钮/模拟播放；首页业务平台/业务场景弹窗不显示「浏览模型」，具身智能仅「申请训练数据服务」→ `/contact`）。
  - 新增 `web/lib/home-content.tsx`（`platformCards` / `scenarioCards` / `scenarios` 静态数据）。
  - 新增 `web/public/home-hero.png`（自 `src/imports/_______.png` 复制）。
  - 改 `web/app/page.tsx`：挂载正式首页，移除 `PagePlaceholder`。
  - 保留修复：`items-stretch` 业务平台卡片对齐；场景卡 `p-0` + `absolute inset-0` 顶图铺满（工程改造等）。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/` 路由约 7.98 kB 客户端包。
  - **下一步**：~~ModelCommunity~~ → ModelLibrary 正式 UI。
- **第 11 步·阶段 6（Next.js ModelCommunity 模型社区入口页）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/pages/model-community.tsx`（自 Vite `ModelCommunity.tsx` 迁移；移除内嵌 NavBar；`Link` 路由）。
  - 新增 `web/lib/api/models.ts`、`web/lib/format.ts`、`web/lib/community-data.ts`（精选回退 + typeTagColor）。
  - 新增 `web/public/community-hero.png`（自 `src/imports/____.png`）；新增 `web/app/models/[id]/page.tsx`（详情路由壳，非 ModelLibrary 正式 UI）。
  - 改 `web/app/community/page.tsx`：挂载正式页。
  - 精选模型：`GET /api/models?page=1&pageSize=6&sort=recommended`；失败回退 `community-data` 前 6 条。
  - 跳转：`/models`、`/models/[id]`、`/contact`；服务能力区保留桌面 2+2+1 顺序（「数字孪生平台接入」+ 底部「具身智能空间训练数据处理」）。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/community` 约 9.08 kB；`/models/[id]` 动态路由 ƒ。
  - **下一步**：~~7B 详情~~ → ~~7C 点赞/收藏 + TrainingModal~~ → UploadModal / PersonalCenter。
- **第 11 步·阶段 8A（Next.js PersonalCenter 个人中心 `/models/me`）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/lib/api/users.ts`：`getMyModels` / `getMyPublished` / `getMyFavorites` / `getMyApplications` / `getMyStats`（五个只读接口）。
  - 新增 `web/components/pages/personal-center-page.tsx`（自 Vite `PersonalCenter` 迁移；四 Tab 懒加载 + 三态 + stats 角标；`isAvailable=false` 灰显禁止进详情）。
  - 新增 `web/app/models/me/page.tsx`（独立路由；静态段 `me` 优先于 `[id]`）。
  - 改 `web/components/pages/model-library-page.tsx`：「个人中心」入口 `router.push('/models/me')`；未登录 toast + `/auth`。
  - 未登录直达 `/models/me`：`bootstrapping` 结束后 toast + `router.replace('/auth')`。
  - 卡片进详情：`router.push('/models/[id]')`；「发布新模型」占位卡保留（UploadModal 未迁）。
  - **未迁**：`UploadModal`（发布模型按钮仍为 toast 占位）。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/models/me` 动态路由 ƒ。
  - **下一步**：UploadModal 迁移。
- **第 11 步·阶段 8B（Next.js UploadModal 发布模型）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/lib/api/uploads.ts`（`presignUpload`/`uploadCallback`/`putFileToPresignedUrl`/`uploadFileToR2`；presign **503** 映射固定文案「R2 对象存储未配置，请先配置对象存储」，无本地兜底）。
  - 扩展 `web/lib/api/models.ts`：`createModel` → `POST /api/models`。
  - 扩展 `web/lib/model-library-constants.ts`：`SCENE_OPTIONS`、`VISIBILITY_OPTIONS`、`VISIBILITY_MAP`。
  - 新增 `web/components/models/upload-modal.tsx`（自 Vite `UploadModal` 迁移；受控表单 + viewerUrl iframe 发布 + R2 直传代码路径保留）。
  - 改 `web/components/pages/model-library-page.tsx`：「发布模型」已登录打开弹窗；未登录 toast + `/auth`；`onPublished` → `loadModels(1,false)`；关闭卸载重置表单。
  - **viewerUrl 外链发布**：不选模型文件、填 `https://` 在线查看链接 → `viewerType=iframe` + `allowIframe=true` → `POST /api/models` 成功后可刷新列表。
  - **R2 文件路径代码保留**：选模型/封面 → presign → 浏览器 PUT → callback → create；无 R2 时 presign **503** 固定提示，**不伪造成功、不落本地**。
  - **真实文件直传端到端**：❌ 待 R2 凭证 + 桶 CORS 后验收。
  - **未改**：`/models/[id]`、`TrainingModal`；个人中心「发布新模型」入口于 8C 完成。
  - 验证：`web/` 内 `pnpm build` Exit code 0；ReadLints 无错误；`/models` 约 8.09 kB。
  - **下一步**：真实 R2 直传验收 / 后台 Admin 前端 / 浏览器全量验收。
- **第 11 步·阶段 8C（Next.js 个人中心「发布新模型」入口）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 改 `web/components/pages/personal-center-page.tsx`：「我的模型」Tab 虚线卡点击打开已有 `UploadModal`；未登录 toast + `/auth`；`onPublished` → `loadModels()` + `getMyStats()` 刷新列表与角标；关闭卸载重置表单。
  - **未改**：`upload-modal.tsx` UI/发布逻辑、`model-library-page.tsx` 列表页发布入口、R2 503 提示逻辑。
  - 验证：`web/` 内 `pnpm build` Exit code 0；ReadLints 无错误。
  - **下一步**：见下「二、下一步任务」（浏览器全量验收为主）。
- **第 11 步·用户侧迁移收口（Next.js web/ 步骤 0–8C 已全部完成，2026-06-01）**：
  - **已完成模块清单**（详见各阶段明细与「一·续三」）：
    - 骨架与 API 基础层（`http`/`token`/`types`、`NEXT_PUBLIC_API_BASE_URL`、dev rewrites）
    - AppProviders（Auth + SiteConfig + Toaster）
    - NavBar + SiteChrome
    - Home / About / Contact / AuthPage
    - ModelCommunity
    - `/models` 列表、`/models/[id]` 详情
    - 点赞 / 收藏（列表卡片 + 详情收藏）
    - TrainingModal
    - `/models/me` 个人中心
    - UploadModal（`/models` 顶栏 + `/models/me` 虚线卡 8C）
  - **viewerUrl 发布**：✅ Vite + Next.js 均可验收（`POST /api/models` + iframe）。
  - **R2 文件直传代码路径**：✅ 已保留；❌ 真实凭证 + CORS 端到端未验。
  - **Vite `src/`**：保留不删，作 UI 对照基准。
  - **验收文档**：已更新 `docs/frontend-acceptance-checklist.md`（Next **:3000** 主验 + Vite **:5173** 对照）。
  - **本步仅文档**，未改 `web/` 业务代码、`src/`、`server/`。
- **第 11 步·全局样式修复（Next.js `web/` Tailwind / shadcn 主题，2026-06-01）**：
  - **根因**：页面组件已迁，但 `web/app/globals.css` 仍为迁移阶段 3 占位 stub，未从 Vite `src/styles/` 迁移 `fonts.css` / `tailwind.css` / `theme.css`；缺少 `@source` 显式扫描与 shadcn `@theme inline` 变量。
  - **修改**：新增 `web/styles/{fonts,tailwind,theme}.css`（内容与 Vite 对齐，`@source` 指向 `app/`、`components/`、`lib/`）；`globals.css` 改为链式 `@import`；`package.json` 补 `tw-animate-css@1.3.8`；`layout.tsx` 注释更新（仍 `import ./globals.css`）。
  - **未改**：`src/`、`server/`、各页面/业务组件逻辑与文案；`postcss.config.mjs` 已正确无需改。
  - **验证**：`web/` 内 `pnpm install` + `pnpm build` Exit code 0；产物 CSS 含 `--color-background`、`bg-background`、`border-border`、`.h-7`、`.flex`；`/`、`/community`、`/models` HTTP 200 + stylesheet 链接正常。
  - **遗留**：`web/components/ui/` 仍仅 `sonner.tsx`（shadcn 组件库未全量复制，不影响当前页 direct Tailwind）。
  - **本地验收（2026-06-01）**：验收人清 `.next` 并重启 `pnpm dev` 后，**`:3000`** 页面样式与 Vite 原型一致（Logo/NavBar/按钮/卡片/间距/黑白灰科技风正常）；详见「零、当前阶段快照」。
- **第 11 步·阶段 7C（Next.js ModelLibrary 点赞/收藏 + TrainingModal）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 扩展 `web/lib/api/models.ts`：`likeModel` / `unlikeModel` / `favoriteModel` / `unfavoriteModel`（POST|DELETE `/api/models/:id/like|favorite`）。
  - 新增 `web/lib/api/training.ts`：`createTrainingApplication` → `POST /api/training-applications`（游客/登录均可，登录态自动带 Bearer 回填 userId）。
  - 扩展 `web/lib/model-library-constants.ts`：`ROBOT_TYPES`、`TRAIN_TASKS`（TrainingModal 表单选项）。
  - 改 `web/components/models/model-card.tsx`：点赞/收藏写接口 + `isLiked`/`isFavorited` 初始化 + 乐观更新/回滚 + 未登录 `toast` + 跳转 `/auth`。
  - 改 `web/components/pages/model-detail-page.tsx`：收藏写接口 + `showTraining` 挂载 `TrainingModal`（具身智能训练场景详情按钮触发）。
  - 新增 `web/components/models/training-modal.tsx`：自 Vite `TrainingModal` 迁移；loading/error/success 三态；遮罩/X/成功关闭。
  - ~~**未迁**：`PersonalCenter`~~ → 8A 已完成；**仍待迁**：`UploadModal`（顶栏「发布模型」仍为 toast 占位）。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/models` 约 4.62 kB；`/models/[id]` 约 5.67 kB 动态路由；ReadLints 无错误。
  - **下一步**：~~PersonalCenter~~ → UploadModal 迁移。
- **第 11 步·阶段 7B（Next.js ModelLibrary `/models/[id]` 详情页）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/pages/model-detail-page.tsx`（自 Vite `ModelDetailPage` 迁移）。
  - 改 `web/app/models/[id]/page.tsx`：替换占位壳，挂载正式详情。
  - 接口：`GET /api/models/:id`；404/无效 id 友好空态 + 返回 `/models`。
  - Viewer：`viewerUrl` + `allowIframe` + `viewerType!==none` → iframe（sandbox/allow 与 Vite 一致）；无内嵌条件 → 占位 +「在新窗口打开」兜底。
  - 保留：全屏、重置视角（viewKey）、分享、侧栏元信息（title/tags/scenes/description/author/views/favorites/createdAt）、相关推荐（`GET /api/models` 取 4 条排除当前）。
  - ~~**未迁**：收藏写接口、TrainingModal（7C）~~ → 7C 已完成。
  - 验证：`pnpm build` Exit code 0；`/models/[id]` 约 4.13 kB 动态路由。
- **第 11 步·阶段 7A（Next.js ModelLibrary `/models` 列表页）已完成**（2026-06-01，**仅 `web/` + 文档**，未改 `src/`、`server/`）：
  - 新增 `web/components/pages/model-library-page.tsx`、`web/components/models/model-card.tsx`。
  - 新增 `web/lib/api/categories.ts`、`web/lib/model-library-constants.ts`；扩展 `web/lib/format.ts`（`formatRelativeTime`）。
  - 改 `web/app/models/page.tsx`：正式列表 UI（替换占位壳）。
  - 接口：`GET /api/categories`（失败回退 `MODEL_TYPES`）、`GET /api/models`（type/keyword/sort/page/pageSize/total、加载更多）。
  - 封面：`coverUrl` 为空时渐变+图标占位；有 `coverUrl` 时显示图片+遮罩。
  - 卡片跳转：`Link` → `/models/[id]`（详情仍为步骤 6 占位壳，7B 替换）。
  - ~~**未迁**：详情正式 UI（7B）、点赞/收藏（7C）、TrainingModal（7C）、PersonalCenter（8A）、UploadModal（8B）~~ → 均已完成后。
  - 验证：`web/` 内 `pnpm build` Exit code 0；`/models` 约 4.9 kB。

### 一·续、前端页面层已接入 API（10H 归档，Vite `src/lib/api/*`）

| 模块 | 后端路径（前缀 `/api`） | 前端封装 | 主要使用处 |
|------|-------------------------|----------|------------|
| **auth** | `send-code` / `register` / `login` / `reset-password` / `me` / `logout` | `api/auth.ts` | `AuthPage`、`AuthContext`、`NavBar` |
| **models** | `GET /models`、`GET /models/:id`、`POST /models` | `api/models.ts` | `ModelLibrary`、`ModelCommunity`、`UploadModal` |
| **categories** | `GET /categories` | `api/categories.ts` | `ModelLibrary` 分类筛选 |
| **likes / favorites** | `POST|DELETE /models/:id/like`、`/favorite` | `api/models.ts` | 列表卡片、`ModelDetailPage` |
| **users/me** | `GET /users/me/models|published|favorites|applications|stats` | `api/users.ts` | `PersonalCenter` |
| **contact** | `GET /contact/options`、`POST /contact/leads` | `api/contact.ts` | `ContactPage` |
| **training-applications** | `POST /training-applications` | `api/training.ts` | `TrainingModal`（登录态带 token 回填 userId） |
| **site-config** | `GET /site-config` | `api/siteConfig.ts` | `SiteConfigContext` → 首页/社区/关于/联系/模型库 Footer |
| **uploads + model publish** | `POST /uploads/presign`、`POST /uploads/callback` + 浏览器 PUT R2 + `POST /models` | `api/uploads.ts` + `api/models.ts`（Vite `src/` + Next.js `web/`） | `UploadModal` |

**未接入前端（后端已有）**：全部 `/api/admin/*`（无后台管理页面）；`GET /api/health`（运维）；`GET /training-applications/my`（口径已由 `users/me/applications` 覆盖）。

**仍为静态/降级**：首页 Hero/VideoModal 无业务 API；`communityData.ts` 保留 **类型配色 + 接口失败时精选/分类降级**（非主数据源）。

### 一·续二、上传发布当前状态（10H 归档）

| 能力 | 状态 |
|------|------|
| **viewerUrl 外链发布** | ✅ 已可用（Vite `src/` + Next.js `web/`）：填 `https://` 在线查看链接 + `viewerType=iframe`，`POST /api/models` 成功后在 `GET /api/models` 可见。 |
| **R2 文件上传代码路径** | ✅ 已保留（Vite + Next.js）：`presign` → 浏览器 `PUT` 预签名 URL → `callback` → `createModel(modelFileId/coverFileId)`；实现于 `*/lib/api/uploads.ts` + `UploadModal`。 |
| **无真实 R2 凭证时** | `POST /api/uploads/presign` 返回 **503**；前端映射固定提示「R2 对象存储未配置，请先配置对象存储」，**无本地兜底、不伪造上传**。 |
| **真实文件直传端到端** | ❌ 未完成：需服务器注入 **R2 凭证** + R2 桶 **CORS** 允许浏览器 PUT；配置前勿将「选模型/封面文件发布」计为验收通过。 |
| **其它说明** | 选封面/模型文件会走 presign，无 R2 时即失败；成功态文案仍写「审核通过后展示」，与 `visibility=public` 立即可见存在产品口径差（UI 未改）。 |

### 一·续三、Next.js `web/` 用户侧迁移清单（步骤 0–8C，2026-06-01 收口）

| 步骤 | 模块 | 路由 / 文件 | 状态 |
|------|------|-------------|------|
| 0–2 | 骨架 + API 连通 | `web/` 工程、`lib/http.ts` 等 | ✅ |
| 3 | AppProviders | `app-providers` / `auth-provider` / `site-config-provider` | ✅ |
| 4A | NavBar + 路由壳 | `NavBar.tsx` / `site-chrome.tsx` | ✅ |
| 4B | About | `/about` | ✅ |
| 4C | Contact | `/contact` | ✅ |
| 4D | AuthPage | `/auth` | ✅ |
| 5 | Home + VideoModal | `/` | ✅ |
| 6 | ModelCommunity | `/community` | ✅ |
| 7A | 模型库列表 | `/models` | ✅ |
| 7B | 模型详情 | `/models/[id]` | ✅ |
| 7C | 点赞/收藏 + TrainingModal | `model-card` / `model-detail-page` | ✅ |
| 8A | 个人中心 | `/models/me` | ✅ |
| 8B | UploadModal | `upload-modal.tsx` + `/models` 入口 | ✅ |
| 8C | 个人中心发布入口 | `/models/me` 虚线卡 | ✅ |
| — | **全局样式** | `styles/` + `globals.css` + shadcn 主题 | ✅ |

**用户侧未迁 / 未做（非页面遗漏）**：

| 项 | 状态 |
|----|------|
| 真实 R2 文件直传端到端 | ❌ 待 R2 凭证 + 桶 CORS |
| 后台 Admin 前端 | ❌ `/api/admin/*` 无 UI |
| 线上生产部署 | ❌ Docker/Cloudflare/域名/生产短信 |

### 一·补、风险点 / dev 库（延续）

- **本地无真实 R2 凭证**：浏览器「直传 R2」环节未真实端到端验证（后端 dummy/空配置下 presign 503 已验）。
- **上线前置**：注入真实 R2 凭证 + R2 桶 CORS + `R2_PUBLIC_BASE` 可访问域。
- **dev 库测试残留**：测试模型 **id≥11**（含 10G 冒烟 id=17/18 等）、联调注册用户、线索/申请冒烟行；验收前可按需 `migrate reset` + `seed` 或手动清理。
- **孤儿 `model_files`**：上传登记但未发布的文件暂无清理，留二期。
- **大文件**：当前单次预签名 PUT；多段上传留二期。
- **审核流**：`public`→`published` 直接公开；`review`→`pending` 需 **admin API** 审核，无前台管理页。

### 二、下一步任务（Next.js 本地验收通过后）

> **Vite 用户侧 API 接入已闭环（10A–10G）**；**Next.js 用户侧页面迁移 + 全局样式 + 本地 `:3000` 验收已闭环**。下列为**当前主线**。

1. **配置真实 Cloudflare R2 凭证与桶 CORS**（`R2_*` 环境变量 + R2 控制台 CORS 允许浏览器 PUT）。
2. **验证真实文件上传**：presign 200 → 浏览器 PUT → callback → 带 `modelFileId`/`coverFileId` 发布（清单 **L21**）。
3. **后台 Admin 前端**：对接已有 `/api/admin/*`（模型审核、用户、分类、线索、申请、站点配置）。
4. **真实线上部署**（后续）：生产 Docker Compose + 1Panel + Cloudflare + 真实短信；Next 生产 `/api` 反向代理（dev rewrites 不用于生产）。
5. **可选**：按 `docs/frontend-acceptance-checklist.md` 在 **`http://localhost:3000`** 全量勾选；UI 对照 **`http://localhost:5173`**。

### 二·补、未完成项

- ❌ **真实 R2 文件直传**（浏览器 PUT + 带文件发布 + 封面 URL 展示）— 清单 L21
- ✅ **Next.js 用户侧页面迁移 + API 接入 + 全局样式 + 本地 `:3000` 验收**
- ❌ **后台 Admin 前端**（`/admin/*` UI）
- ❌ **真实线上部署**（生产环境、域名、SSL、生产短信/R2）

### 二·旧、历史任务索引（已完成，仅供追溯）

> 第 5–9 步后端、第 10A–10G 前端接入明细见本文「〇之巅」～「〇之港」各节；第 8 步表单、第 9 步 Admin 均已后端冒烟通过。

### 三、新对话启动时需先读取的文件

1. `AGENTS.md`
2. `docs/dev-checkpoint.md`（本文件）
3. `docs/backend-architecture-plan.md`
4. `server/prisma/schema.prisma`
5. `server/src/modules/auth`（认证模块实现，复用其 Guard/`@CurrentUser()`/响应风格）
6. `server/src/modules/models`（模型读接口 + 发布接口 + 点赞/收藏 `interactions.*`，读接口已附带 isLiked/isFavorited）
7. `server/src/modules/uploads`（R2 预签名/上传登记实现，发布按 fileId 反查复用）
8. `server/src/modules/users`（个人中心 `/api/users/me/*`，第 8 步训练申请 `my` 接口可对齐其口径）

### 四、关键约束提醒

- **`src/` Vite 原型不得删除**，仍为 UI 对照基准；**`web/` 为用户侧生产目标前端**，用户侧页面已迁完，后续改动保持与 Vite 视觉/文案/交互一致。
- 后端只在 `server/`、编排只在 `deploy/`；Admin 前端、R2 生产配置、线上部署为下一阶段。
- 模型文件/图片/视频一律存 Cloudflare R2，数据库只存 URL 与业务数据；密钥不入库。
- 每完成一个模块执行验证（`cd web && pnpm build` / 接口冒烟），并回写本检查点。

---

## 〇之前、最终技术栈已确定（2026-05-31）

> 本节为技术栈定稿记录。**架构与部署的第一依据为 `docs/backend-architecture-plan.md`**；`AGENTS.md` 顶部「最终技术栈」同步更新。与早期设想（如 MySQL / 宝塔 / 本地存储）冲突处，一律以新文档为准。

- **服务器**：Ubuntu 22.04 LTS，运维面板 **1Panel**。
- **部署**：所有服务一律 **Docker / Docker Compose** 容器化。
- **前端（目标）**：**Next.js**；**当前 `src/` 的 Vite + React 前端是 UI 原型基准**（视觉/文案/交互的唯一还原依据），后续需迁移为 Next.js，迁移前后保持 UI 一致，原型在 Next.js 版上线验收前不得删除。
- **后端**：Node.js + **NestJS**（TypeScript，ORM 用 Prisma）。
- **数据库**：**PostgreSQL**（只存文件 URL、模型信息、用户信息、业务数据）。
- **对象存储**：**Cloudflare R2**（模型文件 / 图片 / 视频全部存 R2，**禁止落服务器本地**）。
- **CDN / DNS / SSL / 安全防护**：**Cloudflare**。
- **架构形态**：前后端分离。
- **后台管理需覆盖**：模型审核、用户管理、分类管理、数据服务申请管理、联系表单管理。
- 本次仅更新文档，未改 `src/` 业务代码、未迁移 Next.js、未创建后端代码。

## 〇之中、后端脚手架已落地（2026-05-31，server/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 2 步。本步**只搭骨架 + 健康检查，不实现任何业务接口**；未触碰 `src/` 前端，前端构建不受影响。

- **新增目录**：`server/`（NestJS 后端，独立工程）、`deploy/`（容器编排）。
- **后端骨架**：
  - 配置文件：`package.json`（NestJS 10 + Prisma 6 + zod 等）、`tsconfig*.json`、`nest-cli.json`、`.gitignore`、`.dockerignore`、`Dockerfile`（多阶段）、`README.md`、`.env.example`、本地 `.env`。
  - 源码：`src/main.ts`（全局前缀 `/api`、`ValidationPipe`、`TransformInterceptor` 统一成功响应 `{code,message,data}`、`AllExceptionFilter` 统一异常、Helmet、CORS、Swagger `/api/docs`、优雅关闭）、`src/app.module.ts`（装配 Config/Prisma/Health，业务模块留注释占位）、`src/config/`（env 校验 + 结构化配置）、`src/prisma/`（全局 `PrismaModule` + `PrismaService`，含 `isHealthy()`）、`src/health/`（`GET /api/health`）、`src/common/`（异常过滤、响应拦截、分页 DTO、常量）。
  - Prisma：`prisma/schema.prisma` 仅含 `datasource(postgresql)` + `generator`；**完整 10 张表建模与 seed 留到第 3 步**。
- **工作区隔离**：`server/` 自带 `pnpm-workspace.yaml`（独立于根前端 pnpm 工作区），并用 `allowBuilds` 放行 Prisma/Nest/esbuild 的安装期构建脚本。
- **本地数据库**：`deploy/docker-compose.dev.yml` 起 `postgres:16`（仅监听 `127.0.0.1:5432`，命名卷 `pg_data`，含 healthcheck）。
- **验证结果（均通过）**：
  - `pnpm install`（631+ 包）、`pnpm prisma generate`（Client v6.19.3）成功。
  - `pnpm build`（`nest build`）Exit code 0；ReadLints 无错误。
  - PostgreSQL 容器 `pg_isready` 通过。
  - `node dist/main.js` 启动后 `GET /api/health` 返回 `{"code":0,"message":"ok","data":{"status":"ok","db":"up",...}}`，数据库连通正常。
- **遗留/说明**：补装了 `@types/express`（异常过滤器类型）；`curl.exe` 经系统代理访问本地端口会 502，本地直连（Invoke-WebRequest）正常，非后端问题。
- **下一步（第 3 步）**：在 `schema.prisma` 落地完整 10 张表 → `prisma migrate dev` → `seed.ts` 把 `communityData` 灌入开发库。

## 〇之下、数据库建模 + 迁移 + 种子已落地（2026-05-31，server/prisma/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 3 步。本步**只建模 + 迁移 + 种子，不实现任何业务接口**；未触碰 `src/` 前端。已确认：`color`/`pattern` 为纯前端视觉、不入库；枚举统一用 **Prisma enum**（不用 text+CHECK）。

### 修改 / 新增文件
- `server/prisma/schema.prisma`（**改**）：落地 10 张表 + 9 个枚举。
- `server/prisma/seed.ts`（**新建**）：幂等种子脚本。
- `server/prisma/migrations/20260531144140_init_schema/`（**自动生成**）：首个迁移。
- `server/package.json`（**改**）：新增 `"prisma": { "seed": "ts-node prisma/seed.ts" }`。
- `server/tsconfig.build.json`（**改**）：`exclude` 增加 `"prisma"`，避免 `seed.ts` 被 nest 编译导致 `dist` 输出层级从 `dist/main.js` 变成 `dist/src/main.js`（构建产物路径回归正常）。
- `docs/dev-checkpoint.md`（**改**）：本文件回写。

### 10 张表与枚举
- 表：`users` / `categories` / `models` / `model_files` / `favorites` / `likes` / `training_applications` / `contact_leads` / `verification_codes` / `site_configs`。
- 枚举：`UserRole(user/admin)`、`UserStatus(active/disabled)`、`ViewerType(iframe/sketchfab/native/none)`、`ModelVisibility(public/private/review)`、`ModelStatus(draft/pending/published/rejected)`、`FileKind(model/cover/video)`、`TrainingStatus`、`LeadStatus`、`VerificationScene(register/login/reset)`。
- R2 / Viewer 相关字段：`models.coverUrl`（封面 URL）、`models.modelUrl`（→前端 `viewerUrl`）、`models.viewerType`、`models.allowIframe`、`model_files.r2Key`/`url`、`users.avatarUrl`，一律只存 URL/key，不存二进制。

### 种子数据（清洗规则）
- `views`("2.1k") → `views_count`(Int)；`time`("3天前") → `created_at`(Timestamptz，基于 now 估算）。
- `author` 去重 → 7 个种子用户 + 1 个 admin（`系统管理员`，id=1）；`models.userId` 关联。
- `viewerUrl` → `models.modelUrl`，有链接（id 1、3）→ `viewerType=sketchfab`，其余 `none`。
- `color`/`pattern` 不入库；`coverUrl` 暂为空串（未接 R2）；`status=published`、`visibility=public`。
- 站点配置 `site_configs`：`contact_phone`/`contact_email`/`contact_address`/`icp` 均为「请填写」占位。
- **幂等**：全部 `upsert` + 固定主键，重复执行计数不变（实测 2 次均为 categories:4 / users:8 / models:10 / siteConfigs:4）。

### 验证结果（均通过）
- `pnpm prisma generate`（v6.19.3）成功；`prisma migrate dev --name init_schema` 应用成功，11 张表（10 业务 + `_prisma_migrations`）。
- `prisma db seed` 成功，重复执行幂等；`psql` 抽查 models 清洗值（views_count 为 int、viewer_type 正确、created_at 为日期）符合预期。
- `pnpm build`（nest build）Exit code 0；ReadLints 对 `schema.prisma`/`seed.ts` 无错误。
- `node dist/main.js` 启动后 `GET /api/health` 返回 `{"code":0,...,"db":"up"}`（绕过系统代理用 `Invoke-WebRequest -NoProxy` 访问；经代理会 502，非后端问题）。

### 遗留 / 说明
- 种子用户密码 `DEV_PASSWORD_HASH` 为开发占位哈希，**非真实可登录密码**，认证模块联调需走真实注册流程。
- `coverUrl` 为空串，待第 6 步 R2 上传流程接入后回填真实封面。
- `viewerUrl` 仍为 Sketchfab 测试链接（随种子带入），正式上线前替换为业务方真实地址。
- Windows 下若后端服务（`node dist/main.js`）在运行，会锁定 Prisma 引擎 dll 导致 `prisma generate` 报 `EPERM`；需先停掉该 node 进程再生成。
- **下一步（第 4 步）**：实现 `/api/auth/*` 认证模块（JWT + 验证码 + 权限 Guard）。

## 〇之上、认证模块 /api/auth/* 已落地（2026-05-31，server/src/modules/auth/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 4 步。已确认：refresh token 本阶段不做（access-only + 无状态 logout，二期补 `refresh_tokens` 表）；密码库用 **bcryptjs**（避免 Windows 原生编译）。未触碰 `src/` 前端。

### 新增 / 修改文件
- 新增 `server/src/modules/auth/`：`auth.module.ts`、`auth.controller.ts`、`auth.service.ts`、`verification.service.ts`、`token.service.ts`、`jwt-payload.interface.ts`、`dto/{send-code,register,login,reset-password}.dto.ts`、`guards/{jwt-auth,roles}.guard.ts`、`decorators/{current-user,roles}.decorator.ts`。
- 改 `server/src/app.module.ts`（注册 `AuthModule`）、`server/src/main.ts`（BigInt `toJSON` 全局序列化补丁）、`server/src/config/env.validation.ts` + `configuration.ts`（新增 `JWT_ACCESS_SECRET`/`JWT_ACCESS_EXPIRES`）、`server/.env`（补 dev JWT 占位串，不入库）、`server/package.json`（依赖 `@nestjs/jwt`、`bcryptjs`）。
- **改 `server/prisma/seed.ts`（重要修复）**：种子用固定主键 upsert 不会推进 Postgres identity 序列，导致 `user.create` 从 id=1 起撞主键（P2002，表现为注册报「该账号已注册」）。已在 seed 末尾对 `users/categories/models` 执行 `setval(pg_get_serial_sequence(...), MAX(id))` 对齐序列；**重新 `prisma db seed` 后序列变为 8/4/10**。后续若改种子需保留该步。

### 6 个接口（统一响应 `{code,message,data}`）
- `POST /api/auth/send-code`：发码，60s 限频、5min 过期、bcrypt 哈希入库；**开发环境返回 `devCode`+日志，生产不返回明文**。
- `POST /api/auth/register`：手机/邮箱 + 验证码 + 密码(≥6) + 协议(必须 true)；注册即登录返回 `accessToken`+`user`。
- `POST /api/auth/login`：`loginType=password|code` 两种方式；禁用账号拒登。
- `POST /api/auth/reset-password`：校验 reset 验证码后改密。
- `GET /api/auth/me`（Bearer）：返回脱敏用户（不含 `passwordHash`）。
- `POST /api/auth/logout`（Bearer）：返回 `{loggedOut:true}`，无状态由前端删 token。

### 设计要点
- JWT：HS256，payload `{sub:用户id字符串, role}`，密钥/有效期来自 env（`JWT_ACCESS_SECRET`/`JWT_ACCESS_EXPIRES=2h`）。
- 权限：`JwtAuthGuard`（解析 Bearer→`req.user`）+ `RolesGuard`+`@Roles('admin')`（供第 9 步后台复用）；`@CurrentUser()` 取登录用户。
- BigInt：`main.ts` 全局 `toJSON` 兜底 + 业务层 `toUserVm` 显式把 id 转 `number`。
- 唯一约束冲突 P2002 → 409「该账号已注册，请直接登录」。
- 验证码：`verification_codes` 表，bcrypt 哈希、一次性（`used`）、5min 过期、60s 限频；mock 不接短信。

### 验证结果（均通过）
- `pnpm install`（+@nestjs/jwt 11、bcryptjs 3）、`pnpm build` Exit code 0、ReadLints 无错误。
- 全流程冒烟（新手机号）：send-code(register)→register→me→login(password)→login(code)→send-code(reset)→reset-password→login(新密码)→logout 全部 `code:0`；`user.id` 正确序列化为 number。
- 负向用例：错误密码→401、无 token 访问 me→401、60s 内重复发码→400、错误验证码→400、未勾选协议→400。
- `GET /api/health` 仍 `db:up`。

### 遗留 / 说明
- 种子 admin（id=1）密码为占位哈希，**不可直接登录**，admin 联调需另造账号或加设密脚本。
- 验证码、登录无图形验证码 / IP 限流，防刷留二期（`@nestjs/throttler` 已在依赖，可后续启用）。
- logout 无状态，token 到期前无法服务端强制失效（refresh/撤销留二期）。
- **下一步（第 5 步）**：模型读接口 `/api/models`、`/api/models/:id` 与 `/api/categories`。

## 〇之巅、模型 / 分类读接口已落地（2026-05-31，server/src/modules/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 5 步。本步**只做模型/分类的只读查询，不实现新增/编辑/删除/审核/上传/点赞/收藏**；未触碰 `src/` 前端。游客可访问、无需 Guard。

### 新增 / 修改文件
- 新增 `server/src/modules/categories/`：`categories.module.ts`、`categories.controller.ts`、`categories.service.ts`。
- 新增 `server/src/modules/models/`：`models.module.ts`、`models.controller.ts`、`models.service.ts`、`dto/query-models.dto.ts`、`model.vm.ts`（列表/详情 VM + 映射函数，统一 BigInt→number、字段裁剪）。
- 改 `server/src/app.module.ts`：在业务模块占位处启用 `CategoriesModule`、`ModelsModule`。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 3 个接口（统一响应 `{code,message,data}`）
- `GET /api/categories`：仅 `isActive=true`，按 `sort asc, id asc` 排序；返回 `{id,name,slug,sort}`（裁剪后台字段）。
- `GET /api/models`：仅 `status=published AND visibility=public`；支持 `type`（分类名，空或「全部模型」不过滤）、`keyword`（标题 + 作者昵称，`contains` + `insensitive`）、`sort`（`latest`→createdAt desc / `views`→viewsCount desc / `favorites`→favoritesCount desc / `recommended`→暂同 latest 兜底）、`page`（默认 1）/`pageSize`（默认 12、最大 100，继承 `PaginationDto`）；返回 `{list,total,page,pageSize}`，列表项轻量（不含 description/viewerUrl，保留 viewerType）。
- `GET /api/models/:id`：仅已发布 + 公开；`:id` 用 `ParseIntPipe`（非数字 → 400），未找到/不可见 → 404「模型不存在或暂未公开」；返回完整详情，含 `viewerUrl`(← `models.modelUrl`)、`viewerType`、`allowIframe`、`scenes`、`category`、`fileFormat` 等。

### 设计要点
- **安全口径**：列表与详情统一并入 `{status:published, visibility:public}` 条件（`ModelsService.publicWhere`），游客不可见草稿/审核中/驳回/私有模型。
- **字段映射**：`viewerUrl ← modelUrl`；`author ← user.nickname`（include 取回）；`category ← {id,name,slug}`（详情 include）；BigInt（id/category.id）在 VM 显式 `Number()`；`views/time` 展示字符串不在后端拼，列表只出数值 `viewsCount` 与 ISO `createdAt`，由前端格式化；`color/pattern` 纯前端视觉，不入库不返回。
- **列表查询**：用 `prisma.$transaction([count, findMany])` 同时取 `total` 与当前页，分页 `skip=(page-1)*pageSize`。

### 验证结果（均通过）
- `pnpm build`（nest build）Exit code 0；ReadLints 对新增文件无错误。
- `node dist/main.js` 启动，路由正确挂载（`/api/categories`、`/api/models`、`/api/models/:id`）。
- 冒烟（`Invoke-WebRequest -NoProxy`，绕过系统代理；经代理会 502，非后端问题）：
  - `GET /api/categories` → 4 条，`sort` 升序。
  - `GET /api/models` → `total=10`、`page=1`、`pageSize=12`，按 createdAt 倒序（latest）。
  - `GET /api/models?type=实景三维` → `total=4`，均为实景三维。
  - `GET /api/models?keyword=BIM` → `total=3`（id 3/4 命中标题、id 6 命中作者「BIM 用户」，验证标题+作者检索且大小写不敏感）。
  - `GET /api/models?sort=views` → viewsCount 倒序（2100…650）。
  - `GET /api/models?page=2&pageSize=4` → `page=2,pageSize=4,total=10`，返回第 5–8 条。
  - `GET /api/models/1` → 含 `viewerUrl`(sketchfab)、`viewerType=sketchfab`、`allowIframe=true`、`category`、`scenes:[]` 等全部必填字段。
  - `GET /api/models/2` → `viewerUrl=null`、`viewerType=none`。
  - `GET /api/models/999` → 404；`GET /api/models/abc` → 400（ParseIntPipe 校验）。
  - `GET /api/health` 仍 `{"db":"up"}`。

### 遗留 / 说明
- **tags 关键词检索未覆盖**：`keyword` 仅匹配标题与作者昵称；`tags`（jsonb 数组）模糊检索作为已知限制，二期用原生 SQL / `pg_trgm` / jsonb 路径优化。
- **color/pattern 不返回**：前端原型卡片渐变依赖此两字段，迁移 Next.js 时由前端按 `type` 做确定性映射生成（非数据丢失）。
- **sort 为英文枚举**：前端中文按钮（最新发布/热门浏览/最多收藏/推荐模型）→ `latest/views/favorites/recommended` 的映射在前端迁移时完成。
- **recommended 暂无独立算法**：当前与 `latest` 一致按创建时间倒序兜底，待二期补推荐逻辑。
- **浏览量不自增**：本步只读，未实现 `/api/models/:id/view`；点赞/收藏写入与登录态收藏状态留第 7 步。
- **下一步（第 6 步）**：R2 上传（`/api/uploads/presign|callback`）+ 模型发布（`POST /api/models`）。

## 〇之顶、R2 上传 + 模型发布接口已落地（2026-06-01，server/src/modules/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 6 步。本步实现**前端直传 R2 的预签名授权 + 上传登记 + 模型发布**；文件实体只存 R2，不落服务器本地；未触碰 `src/` 前端。三接口均需 `JwtAuthGuard`。

### 新增 / 修改文件
- 新增 `server/src/modules/uploads/`：`uploads.module.ts`、`uploads.controller.ts`、`uploads.service.ts`、`r2.service.ts`、`upload.constants.ts`、`dto/presign.dto.ts`、`dto/upload-callback.dto.ts`。
- 新增 `server/src/modules/models/dto/create-model.dto.ts`。
- 改 `server/src/modules/models/models.controller.ts`（增 `POST /api/models` + `JwtAuthGuard`）、`models.service.ts`（增 `create()` + `findOwnedFile()`）、`models.module.ts`（`imports: [AuthModule]`）。
- 改 `server/src/app.module.ts`（注册 `UploadsModule`）。
- 改 `server/src/config/env.validation.ts`、`configuration.ts`（新增 R2_* / R2_PRESIGN_EXPIRES / MAX_*_SIZE_MB 校验与结构化）、`server/.env`（补 R2 占位，本地留空）。
- 改 `server/package.json`（新增依赖 `@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`）。
- 改 `docs/dev-checkpoint.md`（本文件回写）。

### 3 个接口（统一响应 `{code,message,data}`，均需 Bearer Token）
- `POST /api/uploads/presign`：入参 `kind(model/cover/video)/fileName/mime/size`；校验扩展名白名单 + 大小上限；服务端生成安全 key `{kind}/{userId}/{uuid}.{ext}` 并签名；返回 `uploadUrl/r2Key/publicUrl/expiresIn/requiredHeaders`。
- `POST /api/uploads/callback`：入参 `kind/r2Key/originalName/mime/size`；校验 `r2Key` 前缀属于当前用户（防越权），可选 `HeadObject` 复核（网络失败容忍），登记 `model_files`；返回 `fileId/url/r2Key/kind`。
- `POST /api/models`：入参 `title/type/scenes?/description?/visibility/modelFileId?/coverFileId?/viewerUrl?/viewerType?/allowIframe?`；按 `type` 反查 `categoryId`，按 `fileId` 反查 `model_files`（校验归属 + 用途）得 `modelUrl/coverUrl/fileFormat`；`viewerType` 缺省推断（有上传文件→native、外链→iframe、皆无→none）；返回完整详情 VM。

### 设计要点
- **R2（S3 兼容）**：`R2Service` 用 `@aws-sdk/client-s3` + `s3-request-presigner`，`region='auto'`、`forcePathStyle=true`、端点优先 `R2_ENDPOINT` 否则由 `R2_ACCOUNT_ID` 推导；预签名 `getSignedUrl` 为**本地 HMAC 计算、不连网**。
- **R2 未配置 → 503 清晰错误**：`ensureConfigured()` 缺 `R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_BASE/(R2_ENDPOINT 或 R2_ACCOUNT_ID)` 时抛 `ServiceUnavailableException`，**无本地存储兜底**。
- **数据库只存元信息**：`model_files` 存 `r2Key/url/mime/size/originalName`；`models` 存 `modelUrl/coverUrl/viewerType/allowIframe`；不存任何二进制。`viewerUrl` 仍是 `models.modelUrl` 的前端别名（详情 VM 映射）。
- **发布状态（第一版，无独立审核流）**：`visibility=public→status=published`（直接公开，故能在 `GET /api/models` 看到）、`review→pending`、`private→published`（列表因公开过滤不显示）。后台审核流转留第 9 步。
- **安全**：`fileId`/`r2Key` 必须归属当前用户；`viewerUrl` 仅接受 https（DTO `@IsUrl` 限定）；key 由服务端生成、剥离路径片段防穿越。

### 验证结果（均通过）
- `pnpm install`（+@aws-sdk/* 各 3.1057）、`pnpm build`（nest build）Exit code 0；ReadLints 对新增/修改文件无错误。
- `node dist/main.js` 启动，新路由挂载（`POST /api/models`、`/api/uploads/presign`、`/api/uploads/callback`）。
- 冒烟（`Invoke-WebRequest -NoProxy`；先以**空 R2** 验证错误路径，再以**dummy R2 env** 验证全链路）：
  - 未登录 `POST /api/uploads/presign`、`POST /api/models` → **401**。
  - presign 非法扩展名 `.exe` → **400**（扩展名白名单先于 R2 校验）。
  - 空 R2 下 presign → **503**「R2 对象存储未配置（缺少：…）」。
  - dummy R2 下：presign(model) → **200** 返回签名 `uploadUrl`+`r2Key`+`publicUrl`；callback(model) → **200** 登记 `model_files`（`HeadObject` 网络失败被容忍，按上报 size 落库）；cover 同理；`POST /api/models`（`modelFileId/coverFileId`）→ **200**，`viewerType=native`、`fileFormat=glb`、`modelUrl/coverUrl` 为 R2 公共域链接。
  - 越权 callback（他人前缀 `model/999999/...`）→ **403**。
  - 外链发布：`POST /api/models`（仅 `viewerUrl`，无需 R2）→ **200** `published`，随后 `GET /api/models?keyword=接口测试` 能查到该新模型（满足「发布后列表可见」）。
  - `GET /api/health` 仍 `db:up`。

### 遗留 / 说明
- **测试在 dev 库新增了 id=11、12 两条测试模型**（冒烟产物，非种子数据）；`seed.ts` 对 id 1–10 幂等，11/12 为残留测试数据，可按需手动清理，不影响后续。
- **本地无真实 R2 凭证**：presign 的真实「直传 R2」环节无法端到端跑通（仅验证了签名与登记逻辑）；上线前需在服务器注入真实 R2 凭证并配置桶 CORS。
- **大小校验为弱约束**：presign 按上报 size 校验；callback 已尝试 `HeadObject` 复核真实大小（无网络/无凭证时降级为上报值）。生产建议确保 `HeadObject` 可用以强校验。
- **孤儿文件**：上传登记但未发布的 `model_files` 暂无清理；定时清理留二期。
- **大文件**：当前单次预签名 PUT，数百 MB 可行；超大文件多段上传留二期。
- **下一步（第 7 步）**：点赞/收藏 + 个人中心 `/api/users/me/*`。

## 〇之极、点赞/收藏 + 读接口附带互动状态已落地（2026-06-01，server/src/modules/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 7 步·第一阶段。本步实现**点赞/收藏写接口 + 可选登录态读接口附带 isLiked/isFavorited**；个人中心 `/api/users/me/*` 留第二阶段。未触碰 `src/` 前端。`schema.prisma` 无需改动（likes/favorites/计数字段齐备）。

### 新增 / 修改文件
- 新增 `server/src/modules/auth/guards/optional-jwt-auth.guard.ts`：可选登录态守卫（游客放行、失效 Token 静默放行，不抛 401）。
- 改 `server/src/modules/auth/auth.module.ts`：`providers`/`exports` 增加 `OptionalJwtAuthGuard`。
- 新增 `server/src/modules/models/interactions.service.ts`：点赞/收藏/取消的事务逻辑（幂等 + 计数不为负 + 可见性校验）。
- 新增 `server/src/modules/models/interactions.controller.ts`：`POST/DELETE /api/models/:id/like`、`POST/DELETE /api/models/:id/favorite`（均 `JwtAuthGuard`）。
- 改 `server/src/modules/models/model.vm.ts`：新增 `ModelInteractionFlags`；`ModelListItemVm`/`ModelDetailVm` 增可选 `isLiked`/`isFavorited`；两个映射函数加可选 `interaction` 入参（仅登录态注入）。
- 改 `server/src/modules/models/models.service.ts`：`findList`/`findOne` 增可选 `userId`；新增私有 `buildInteractionMap()`（批量查 likes/favorites 构造 Set，避免 N+1）。
- 改 `server/src/modules/models/models.controller.ts`：列表/详情挂 `OptionalJwtAuthGuard` + `@CurrentUser()`，把 `user?.id` 透传给 service。
- 改 `server/src/modules/models/models.module.ts`：注册 `InteractionsController` + `InteractionsService`。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 4 个互动接口（统一响应 `{code,message,data}`，均需 Bearer Token）
- `POST /api/models/:id/like` → `{ liked:true, likesCount }`；`DELETE` 同路径 → `{ liked:false, likesCount }`。
- `POST /api/models/:id/favorite` → `{ favorited:true, favoritesCount }`；`DELETE` 同路径 → `{ favorited:false, favoritesCount }`。

### 设计要点
- **可选登录态**：新建 `OptionalJwtAuthGuard`（**不复用** `JwtAuthGuard`，后者会对游客抛 401）；读接口游客可访问，登录态才附带 `isLiked`/`isFavorited`，游客响应不含该两字段。
- **批量查询防 N+1**：列表用 `like/favorite.findMany({ where:{ userId, modelId:{ in:当前页 ids } } })` 一次取回，`Set<modelId.toString()>` 标注；详情复用同一 `buildInteractionMap`（单元素）。
- **事务一致性**：点赞/收藏在 `prisma.$transaction` 内「查明细 → 不存在才插明细 + 计数 increment」；取消「查明细 → 存在才删明细 + 计数 decrement」。
- **幂等**：重复点赞/收藏走「已存在」分支只读回当前计数、不重复加；重复取消走「不存在」分支不减。
- **计数不为负**：仅当明细存在才 decrement；并对减后结果做 `<0 → 0` 兜底（防历史脏数据）。
- **可见性**：互动前 `ensureVisibleModel` 校验目标为「已发布 + 公开」，否则 404，避免对草稿/私有/幽灵模型刷计数。
- **BigInt**：Map 键统一用 `modelId.toString()`，计数与 id 经 VM `Number()`，沿用既有规范。

### 验证结果（均通过）
- `pnpm build`（nest build）Exit code 0；ReadLints 对新增/修改文件无错误。
- `node dist/main.js` 启动，新路由挂载：`POST/DELETE /api/models/:id/like`、`POST/DELETE /api/models/:id/favorite`。
- 冒烟（pwsh 7 `Invoke-RestMethod -NoProxy` 绕系统代理；注意 **Windows PowerShell 5.1 不支持 `-NoProxy`，须用 pwsh 7**）：
  - 游客 `GET /api/models/1` → 响应**无 isLiked 字段**；登录 `GET /api/models/1`（操作前）→ `isLiked=false, isFavorited=false`。
  - 点赞：`likesCount 368→369`；重复点赞幂等仍 `369`；登录详情 `isLiked=true`；登录列表 id=1 `isLiked=true`。
  - 取消点赞：`369→368`；重复取消幂等仍 `368`（非负）。
  - 收藏：`favoritesCount 0→1`；重复收藏幂等仍 `1`；详情 `isFavorited=true`；取消 `1→0`；重复取消仍 `0`（非负）。
  - 负向：未登录点赞/收藏 → **401**；点赞不存在模型（999999）→ **404**；非数字 id（abc）→ **400**。
  - 游客 `GET /api/models` 正常（`total=12`，无 isLiked）；`GET /api/health` 仍 `db:up`。

### 遗留 / 说明
- **dev 库新增点赞/收藏明细**：冒烟用新注册用户对 id=1 做了点赞/收藏后又全部取消，计数已复原；但 `verification_codes`/`users` 多了 1 个测试账号（手机号 139 开头随机），属冒烟残留，可按需清理。
- **计数为冗余缓存**：`likesCount/favoritesCount` 与明细表理论一致由事务保证；极端并发/历史脏数据下可二期加对账脚本。
- **浏览量仍不自增**：本步未实现 `/api/models/:id/view`（留二期）。
- **临时冒烟脚本已删除**：`server/smoke-step7.ps1` 测试后已删除，不入库。
- **下一步（第 7 步·第二阶段）**：个人中心 `/api/users/me/*`（我的模型/收藏/发布/申请）。

## 〇之巅·二、个人中心 /api/users/me/* 已落地（2026-06-01，server/src/modules/users/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 7 步·第二阶段。本步实现**个人中心 5 个只读接口**；只读、严格按 userId 过滤；**不实现**编辑资料 / 删除模型 / 审核 / 训练申请提交。未触碰 `src/` 前端，`schema.prisma` 无需改动。

### 新增 / 修改文件
- 新增 `server/src/modules/users/users.module.ts`：`imports:[AuthModule]`，装配 controller/service。
- 新增 `server/src/modules/users/users.controller.ts`：5 个 `me/*` 路由，类级 `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`。
- 新增 `server/src/modules/users/users.service.ts`：四类查询 + stats，统一 `where:{ userId }`、分页、VM 映射。
- 新增 `server/src/modules/users/dto/query-my-models.dto.ts`：`extends PaginationDto` + `status`（`@IsIn` all/draft/pending/published/rejected，默认 all）。
- 新增 `server/src/modules/users/users.vm.ts`：`MyModelVm` / `MyFavoriteVm` / `MyApplicationVm` / `MeStatsVm` 及映射（BigInt→Number）。
- 改 `server/src/app.module.ts`：业务模块占位处启用 `UsersModule`。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 5 个接口（统一响应 `{code,message,data}`，均需 Bearer Token；列表统一 `{list,total,page,pageSize}`）
- `GET /api/users/me/models?status=&page=&pageSize=`：本人全部状态模型，`status` 过滤（all 不过滤）。列表项含 `status/visibility/rejectReason/updatedAt` 等审核字段。
- `GET /api/users/me/published`：等价 `me/models?status=published`。
- `GET /api/users/me/favorites`：按收藏时间倒序；项含 `isFavorited(恒 true)` / `isAvailable(= status:published && visibility:public)` / `favoritedAt` / `author`。
- `GET /api/users/me/applications`：本人训练申请，按 createdAt 倒序，无数据 → 空数组 `total:0`。
- `GET /api/users/me/stats`：一次事务并行 count，返回 `{ models, published, pending, rejected, favorites, applications }`。

### 设计要点
- **复用 JwtAuthGuard**：`UsersModule` import `AuthModule`，控制器类级 Guard；`@CurrentUser()` 取 `user.id`，service 全部 `where:{ userId }`，**杜绝越权**。
- **状态区分**：`me/models` 默认全部状态；`status` 参数切片 draft/pending/published/rejected；`me/published` 为 published 便捷别名（内部复用 `queryModels()`）。
- **收藏可用性**：收藏列表 join 模型 + 作者，`isAvailable` 标注是否仍对外可见（他人下架/转私有 → false），前端据此灰显或禁入详情。
- **统计口径一致**：`me/stats` 各 count 的 where 与对应列表一致，保证角标数与列表 `total` 对得上。
- **个人信息不重复**：未实现 `GET /api/users/me`，统一用 `GET /api/auth/me`。
- **BigInt**：所有 VM 的 id / 关联 id / 计数经 `Number()`；分页 total（count 返回 number）直接出。

### 验证结果（均通过）
- `pnpm build`（nest build）Exit code 0；ReadLints 对新增/修改文件无错误。
- `node dist/main.js` 启动，5 条路由挂载：`/api/users/me/{models,published,favorites,applications,stats}`。
- 冒烟（pwsh 7 `Invoke-RestMethod -NoProxy`；**Windows PowerShell 5.1 不支持 -NoProxy，须用 pwsh 7**）：
  - 游客访问 5 个 `me/*` → 全 **401**。
  - 用户 A 发布 `public`(→published)+`review`(→pending)：`me/models(all) total=2`；`?status=published=1`、`?status=pending=1`、`?status=rejected=0`、`?status=draft=0`；列表项含 `status/visibility/rejectReason`。
  - `me/published` 与 `?status=published` 的 id 集一致。
  - 收藏 seed#1 → `me/favorites total=1`（`isFavorited=true`、`isAvailable=true`、`favoritedAt` 有值）；取消后 `total=0`。
  - `me/applications total=0`、空数组（提交接口第 8 步才有，属预期）。
  - `me/stats` = models2/published1/pending1/rejected0/favorites0/applications0，且 `stats.models==me/models(all).total`、`stats.published==me/published.total`。
  - 用户 B 查自己 → models/favorites/applications 均 0（看不到 A 数据）。
  - 非法 `status=foo` → **400**；`GET /api/health` 仍 `db:up`。

### 遗留 / 说明
- **dev 库新增测试模型 id=13、14**（A 的 published/pending 冒烟产物，非种子）；另多 2 个测试用户（139 开头随机）。`seed` 对 id 1–10 幂等，13/14 可按需手动清理。
- **applications 本阶段只能测空**：真实数据待第 8 步提交接口（`POST /api/training-applications`）落地后端到端验证。
- **`POST /api/models` 创建响应（ModelDetailVm）不含 status 字段**：是详情 VM 既有口径（status 通过 `me/models` 列表查看），非缺陷。
- **临时冒烟脚本已删除**：`server/smoke-step7b.ps1` 测试后已删除，不入库。
- **下一步（第 8 步）**：联系线索 `/api/contact/*` + 训练数据服务申请 `/api/training-applications`。

## 〇之渊、联系线索 ContactModule 已落地（2026-06-01，server/src/modules/contact/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 8 步·阶段一。本步实现**联系我们表单的线索提交 + 表单选项配置**；两接口均为公开接口（游客可访问），`contact_leads` 表无 user_id（纯游客线索）。未触碰 `src/` 前端，`schema.prisma` 无需改动。**不实现后台管理接口（留第 9 步）**。

### 新增 / 修改文件
- 新增 `server/src/modules/contact/contact.constants.ts`：4 组表单选项常量（scenes/dataTypes/stages/budgets），逐字对齐前端 `ContactPage.tsx`，并定义 `ContactOptions` 返回结构。
- 新增 `server/src/modules/contact/dto/create-lead.dto.ts`：线索提交 DTO（name/contactWay 必填、email 选填须合法、dataTypes 字符串数组、message ≤2000、其余字段长度对齐表定义）。
- 新增 `server/src/modules/contact/contact.vm.ts`：`LeadReceiptVm` + `toLeadReceiptVm`（回执仅 `{id,status,createdAt}`，BigInt→number）。
- 新增 `server/src/modules/contact/contact.service.ts`：`createLead`（写 `contact_leads`，status 默认 new，dataTypes 以 Json 数组入库，可选字段未填存 null）+ `getOptions`（返回常量）。
- 新增 `server/src/modules/contact/contact.controller.ts`：`POST /leads`（`@HttpCode(200)`）、`GET /options`，**无 Guard**（公开）。
- 新增 `server/src/modules/contact/contact.module.ts`：装配 controller/service，无需 import AuthModule。
- 改 `server/src/app.module.ts`：业务模块接入位启用 `ContactModule`。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 2 个接口（统一响应 `{code,message,data}`）
- `POST /api/contact/leads`（游客）：入参见 `CreateLeadDto`；`status` 固定 `new`，不接收前端入参；`dataTypes` 多选以 Json 数组入库；可选字段（company/email/scene/stage/budget）未填存 null，message 未填存空串。返回 `{id,status,createdAt}`。
- `GET /api/contact/options`（游客）：返回 `{scenes,dataTypes,stages,budgets}` 四组选项。

### 设计要点
- **公开接口无 Guard**：`contact_leads` 表无 `user_id`，线索为纯游客提交，不记录登录态、不需 OptionalJwtAuthGuard。
- **status 后端固定**：DTO 不含 status 字段，由 schema 默认 `LeadStatus.new` 落库，杜绝前端伪造状态。
- **字段长度对齐**：name ≤60、contactWay/company/email ≤120、scene/stage/budget ≤40、message ≤2000，与 `contact_leads` VarChar/Text 定义一致；email 选填但填写须 `@IsEmail`。
- **dataTypes**：`@IsArray` + 每项 `@IsString`/`@MaxLength(40)` + `@ArrayMaxSize(20)`，以 `Prisma.InputJsonValue` 入库。
- **选项单一数据源**：选项暂以后端常量落地，与前端逐字对齐；二期可迁 `site_configs` 由后台维护（避免前后端文案漂移）。

### 验证结果（均通过）
- `pnpm build`（nest build）Exit code 0；ReadLints 对新增/修改文件无错误。
- `node dist/main.js` 启动，新路由挂载：`POST /api/contact/leads`、`GET /api/contact/options`。
- 冒烟（pwsh 7 `Invoke-RestMethod -NoProxy`；Windows PowerShell 5.1 不支持 `-NoProxy`，须用 pwsh 7）：
  - `GET /api/contact/options` → 返回 4 组选项，文案与前端一致。
  - 游客 `POST /api/contact/leads`（完整字段）→ 200，`{id:1,status:"new",createdAt}`。
  - 缺 name → **400**；缺 contactWay → **400**；非法 email（`not-an-email`）→ **400**。
  - `GET /api/health` 仍 `db:up`。

### 遗留 / 说明
- **dev 库新增测试线索 id=1**（冒烟产物）；`contact_leads` 无种子数据，可按需手动清理。
- **无防刷**：公开 POST 无登录门槛/限频，存在脚本批量灌库风险；二期建议 `@nestjs/throttler` + IP 限频 + 可选图形验证码。
- **选项与前端双写**：当前接口选项与前端写死选项为两处来源，前端改文案需同步；二期迁 `site_configs` 解决。
- **临时冒烟脚本已删除**：`server/smoke-step8a.ps1` 测试后已删除，不入库。
- **下一步（第 8 步·阶段二）**：训练数据服务申请 TrainingModule（`POST /api/training-applications` + `GET /api/training-applications/my`）。

## 〇之滨、训练数据服务申请 TrainingModule 已落地（2026-06-01，server/src/modules/training/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 8 步·阶段二。本步实现**具身智能机器人训练场景的数据服务申请提交 + 我的申请查询**；`POST` 游客可提交、登录态回填 userId，`GET /my` 需登录。仅服务「具身智能机器人训练场景」，**不扩展其它服务类型**。未触碰 `src/` 前端，`schema.prisma` 无需改动。**不实现后台管理接口（留第 9 步）**。

### 新增 / 修改文件
- 新增 `server/src/modules/training/training.constants.ts`：`ROBOT_TYPES` / `TRAIN_TASKS` 选项常量，逐字对齐前端 `ModelLibrary.tsx` 的 `TrainingModal`。
- 新增 `server/src/modules/training/dto/create-training-application.dto.ts`：申请提交 DTO（contactName/contactWay/company/robotType/sceneDesc 必填、trainTasks 选填字符串数组、长度对齐表定义；不含 status/userId/serviceType 等入参）。
- 新增 `server/src/modules/training/training.vm.ts`：`ApplicationReceiptVm` + `toApplicationReceiptVm`（回执仅 `{id,status,createdAt}`）；并 `re-export` 个人中心的 `MyApplicationVm` / `toMyApplicationVm`，保证 `/my` 与 `/users/me/applications` 单一口径。
- 新增 `server/src/modules/training/training.service.ts`：`createApplication`（写 `training_applications`，status 默认 submitted，trainTasks 以 Json 数组入库，userId 登录态回填/游客 null）+ `findMyApplications`（事务 count+findMany，按 userId 过滤，createdAt 倒序，复用 `PaginatedResult`）。
- 新增 `server/src/modules/training/training.controller.ts`：`POST /`（`OptionalJwtAuthGuard` + `@HttpCode(200)`）、`GET /my`（`JwtAuthGuard`）。
- 新增 `server/src/modules/training/training.module.ts`：`imports:[AuthModule]`（复用 JwtAuthGuard / OptionalJwtAuthGuard）。
- 改 `server/src/app.module.ts`：业务模块接入位启用 `TrainingModule`。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 2 个接口（统一响应 `{code,message,data}`）
- `POST /api/training-applications`（游客/用户）：入参见 `CreateTrainingApplicationDto`；`status` 固定 `submitted`、不接收前端入参；`trainTasks` 多选以 Json 数组入库；`userId` 由登录态回填、游客为 `null`。返回 `{id,status,createdAt}`。
- `GET /api/training-applications/my`（需登录）：分页查询本人申请，按 createdAt 倒序，返回 `{list,total,page,pageSize}`，列表项口径同 `users/me/applications`（同一 `toMyApplicationVm`）。

### 设计要点
- **可选登录态回填 userId**：`POST` 用 `OptionalJwtAuthGuard`，`@CurrentUser()` 取 `user?.id ?? null`；游客提交合法（`training_applications.user_id` 可空），登录提交自动归属当前用户。
- **强登录态查询**：`GET /my` 用 `JwtAuthGuard`，未登录 401；service 严格 `where:{userId}`，禁止越权读他人申请。
- **口径单一**：`/my` 列表复用个人中心 `toMyApplicationVm`，与 `GET /api/users/me/applications` 字段、排序完全一致；冒烟实测两接口 total/id 集/字段集三者相同。**`UsersService.findMyApplications` 未改动**（避免重构已验收模块）。
- **只做一种类型红线**：DTO 无 `serviceType` 等扩展字段，固定具身智能机器人训练场景；`status` 后端固定 `submitted`，杜绝前端伪造。
- **字段长度对齐**：contactName ≤60、contactWay/company ≤120、robotType ≤40、sceneDesc ≤2000，与 `training_applications` 定义一致；trainTasks 每项 ≤40、数组上限 20。

### 验证结果（均通过）
- `pnpm build`（nest build）Exit code 0；ReadLints 对新增/修改文件无错误。
- `node dist/main.js` 启动，新路由挂载：`POST /api/training-applications`、`GET /api/training-applications/my`。
- 冒烟（pwsh 7 `Invoke-RestMethod -NoProxy`；Windows PowerShell 5.1 不支持 `-NoProxy`，须用 pwsh 7）：
  - 游客 `POST` → 200，`{id:1,status:"submitted"}`。
  - 注册用户 A（手机+验证码 devCode）→ 拿 token；A `POST` → 200，`{id:2,status:"submitted"}`。
  - 缺 sceneDesc / 缺 contactName / 缺 company → **400**。
  - 未登录 `GET /my` → **401**。
  - A `GET /my` → `total=1`、`ids=[2]`（含本人 id=2、**不含游客 id=1，证明游客 userId=null**）。
  - A `GET /api/users/me/applications` → 与 `/my` 的 total、id 集、字段集（company/contactName/contactWay/createdAt/id/robotType/sceneDesc/status/trainTasks/updatedAt）完全一致。
  - `GET /api/health` 仍 `db:up`。

### 遗留 / 说明
- **dev 库新增测试申请 id=1（游客）、id=2（用户 A）**，并新增 1 个测试用户（139 开头随机，uid=16）；均为冒烟产物，可按需清理。
- **无防刷**：`POST` 游客无登录门槛/限频，存在刷量风险；二期建议 `@nestjs/throttler` + IP 限频 + 可选图形验证码（与联系线索同源风险）。
- **机器人类型/训练任务未做白名单强校验**：DTO 仅校验类型与长度，未 `@IsIn(ROBOT_TYPES/TRAIN_TASKS)`，允许「其他」及自由值；如需收口可后续加白名单校验。
- **临时冒烟脚本已删除**：`server/smoke-step8b.ps1`、`smoke-step8b-neg.ps1`、临时 `kill4000.ps1` 测试后均已删除，不入库。
- **下一步（第 9 步）**：后台管理 Admin（模型审核、用户管理、分类管理、训练申请管理、联系线索管理）。

## 〇之巅·三、后台管理 Admin 已落地（2026-06-01，server/src/modules/admin/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 9 步。本步实现**后台五大管理模块**；全部接口仅 admin 可访问。未触碰 `src/` 前端、未改 `schema.prisma`（现有 enum 已满足全部状态流转）。**本期不实现** site-config / audit_logs / 后台前端页面。

### 新增 / 修改文件
- 新增 `server/src/modules/admin/admin.module.ts`：`imports:[AuthModule]`，装配 5 个 Controller + 5 个 Service。
- 新增 `admin.vm.ts`：`AdminModelVm`/`AdminUserVm`（脱敏）/`AdminCategoryVm`（含 modelCount）/`AdminLeadVm`/`AdminApplicationVm` 及映射（统一 BigInt→number）。
- 新增 5 个 Controller：`admin-models.controller.ts`、`admin-users.controller.ts`、`admin-categories.controller.ts`、`admin-leads.controller.ts`、`admin-training.controller.ts`（类级 `@UseGuards(JwtAuthGuard, RolesGuard) + @Roles(UserRole.admin)`）。
- 新增 5 个 Service：`admin-models.service.ts`、`admin-users.service.ts`、`admin-categories.service.ts`、`admin-leads.service.ts`、`admin-training.service.ts`。
- 新增 DTO（`admin/dto/`）：`query-admin-models`、`update-model-status`、`query-admin-users`、`update-user-status`、`create-category`、`update-category`、`query-admin-leads`、`update-lead-status`、`query-admin-training`、`update-training-status`。
- 改 `server/src/app.module.ts`：业务模块接入位启用 `AdminModule`；site-config 占位注释保留（标注本期未做）。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 13 个接口（统一响应 `{code,message,data}`，全部仅 admin）
- 模型审核：`GET /api/admin/models`、`GET /api/admin/models/:id`、`PATCH /api/admin/models/:id/status`。
- 用户管理：`GET /api/admin/users`、`PATCH /api/admin/users/:id/status`。
- 分类管理：`GET/POST /api/admin/categories`、`PUT/DELETE /api/admin/categories/:id`。
- 联系线索：`GET /api/admin/leads`、`PATCH /api/admin/leads/:id/status`。
- 训练申请：`GET /api/admin/training-applications`、`PATCH /api/admin/training-applications/:id/status`。

### 设计要点
- **权限复用**：`AdminModule import AuthModule`，复用 `AuthModule` 导出的 `JwtAuthGuard`/`RolesGuard`；各 Controller 类级 `@Roles('admin')`。`JwtAuthGuard` 先解析 `req.user`，`RolesGuard` 再校验角色（未登录 401、非 admin 403）。
- **模型审核状态机**：仅 `pending` 可被审核；approve→`published` 并清空 rejectReason；reject→`rejected` 且 `rejectReason` 必填（DTO `@ValidateIf(action==='reject')`）；非 pending → 400「仅待审核状态可审核」。后台列表**不并入 publicWhere**，可见全部状态（区别于游客 `ModelsService`）。
- **用户管理脱敏 + 自锁保护**：统一走 `toAdminUserVm` 显式挑字段，**绝不返回 passwordHash**；service 用 `operatorId===targetId` 拦截「禁用自己 / 降级自己」→ 400，防自锁后台；status/role 至少传一项。
- **分类管理**：`GET` 含未启用并附 `modelCount`（一次 `groupBy` 批量统计，避免 N+1）；create/update 唯一冲突捕获 P2002 → 409；delete 先 `model.count({categoryId})`，被引用 → 400 引导停用（`isActive=false`）。
- **线索/申请管理**：状态值由 DTO `@IsEnum(LeadStatus / TrainingStatus)` 收口（用现有 Prisma enum，不自定义）；列表 status 精确过滤 + keyword 模糊（不区分大小写）+ 分页；训练申请 include user 区分游客（userId/applicant 为 null）。
- **统一规范**：列表 `$transaction([count, findMany])` 分页（继承 `PaginationDto`）；`PaginatedResult<T>` 复用 `users.service` 既有类型（沿用 training 的做法，不重构）；`:id` 用 `ParseIntPipe`（非数字 400）再转 BigInt；所有 id/count 在 VM 层 `Number()`。

### 验证结果（均通过）
- `pnpm build`（nest build）Exit code 0；ReadLints 对新增/修改文件无错误。
- `node dist/main.js` 启动，13 条 admin 路由全部挂载（`/api/admin/{models,users,categories,leads,training-applications}` 各方法）。
- 冒烟（pwsh 7 `Invoke-WebRequest -SkipHttpErrorCheck -NoProxy`；admin 账号经「注册 → DB 改 role=admin → 重新登录」获得）：
  1. 未登录 `/admin/models` → **401**；2. 普通用户 → **403**；3. admin 列表 → **200**（total=14）。
  4. approve pending → **published**；5. reject pending → **rejected** 且写入 rejectReason；6. 非 pending 重审 → **400**；reject 缺 rejectReason → **400**。
  7. 用户列表**无 passwordHash**；8. admin 禁用自己/降级自己 → **400**、禁用普通用户 → **200**。
  9. 分类列表/新增(**201**)/重复 name·slug(**409**)/停用(isActive=false)/删除未引用(**200**)、删除被引用分类(id=1,引用 8 个) → **400**。
  10. 线索列表 + 改状态(contacted) + 非法状态 → **400**；11. 申请列表 + 改状态(contacted)。
  12. `GET /api/health` 仍 `db:up`。

### 遗留 / 说明
- **dev 库新增冒烟残留**：测试模型 id=15（已 published）/16（已 rejected）；测试用户 id=17（已被禁用 disabled）/18（已提为 admin）；新增冒烟分类已删除（无残留）；既有线索 / 训练申请的 status 被改为 contacted。均为冒烟产物，`seed` 对 id 1–10 幂等，可按需手动清理。
- **admin 账号获取**：seed admin（id=1）仍为占位哈希不可登录；联调/测试需「注册普通账号 → `UPDATE users SET role='admin'` → 重新登录」拿 admin token（重新登录才会签发 admin 角色 token）。
- **临时冒烟脚本已删除**：`server/smoke-step9.ps1` 测试后已删除，不入库。
- **未实现（本期约定）**：`audit_logs` 审计、后台前端页面（site-config 已在下节补齐）。
- **本地后端进程**：冒烟期间 `node dist/main.js`（端口 4000）仍在后台运行；如需 `prisma generate`（改 schema 时）须先停掉该 node 进程，否则 Windows 下会 EPERM 锁 dll。
- **下一步**：补 `SiteConfigModule`（已完成，见「〇之巅·四」），再进入第 10 步前端迁移。

## 〇之巅·四、站点配置 SiteConfigModule 已落地（2026-06-01，server/src/modules/site-config/）

> 第 9 步补充。补齐架构文档第五节遗留的 `GET /api/site-config`（游客）与 `GET/PUT /api/admin/site-config`（admin）。配置项扩展为 6 项（在原 4 项基础上加 companyName / footerText）。未改 `schema.prisma`（`site_configs` 表已存在）、不做后台前端页面、未触碰 `src/` 前端。

### 新增 / 修改文件
- 新增 `server/src/modules/site-config/site-config.constants.ts`：白名单与映射「公开字段名 ↔ DB key ↔ 默认值 ↔ 长度上限」（单一数据源）。6 项：`phone↔contact_phone`、`email↔contact_email`、`address↔contact_address`、`icp↔icp`、`companyName↔company_name`、`footerText↔footer_text`。
- 新增 `site-config.vm.ts`：`SiteConfigVm`（6 字段）+ `toSiteConfigVm`（默认值兜底 → 库值覆盖，忽略白名单外键）。
- 新增 `dto/update-site-config.dto.ts`：`UpdateSiteConfigDto { items:[{key,value}] }`，key `@IsIn(白名单)`，items 1–20 项，`@ValidateNested` + `@Type`。
- 新增 `site-config.service.ts`：`getConfig`（findMany → 整形）、`updateConfig`（field→dbKey 映射 + 按定义长度二次校验 + 事务内逐项 upsert + 同 key 去重）。
- 新增 `site-config.controller.ts`：`GET /api/site-config`（公开，无 Guard）。
- 新增 `admin-site-config.controller.ts`：`GET/PUT /api/admin/site-config`（类级 `JwtAuthGuard + RolesGuard + @Roles('admin')`）。
- 新增 `site-config.module.ts`：`imports:[AuthModule]`，装配两个 Controller + 一个 Service。
- 改 `server/src/app.module.ts`：启用 `SiteConfigModule`（替换原占位注释）。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 3 个接口（统一响应 `{code,message,data}`）
- `GET /api/site-config`（游客）：返回 `{phone,email,address,icp,companyName,footerText}`，缺失键回退默认值。
- `GET /api/admin/site-config`（admin）：同结构读取（复用 getConfig）。
- `PUT /api/admin/site-config`（admin）：入参 `{items:[{key,value}]}`，key 限白名单 6 字段；事务批量 upsert，返回更新后完整配置。

### 设计要点
- **白名单单一数据源**：`SITE_CONFIG_FIELD_DEFS` 统一定义对外字段名、DB 键、默认值、长度上限；读写都走它，杜绝任意键泄露 / 注入。
- **默认值取自前端 Footer**：`companyName`/`footerText` 默认值与 `App.tsx` 现有写死文案一致，首次读取即合理；`phone/email/address/icp` 默认「请填写」（与 seed 一致）。
- **DB 键对齐 seed**：沿用 seed 已有 `contact_phone/contact_email/contact_address/icp`；新增 `company_name/footer_text` 由 PUT 首次写入时自动 `create`（upsert），无需改 seed。
- **批量幂等 upsert**：`$transaction` 内逐项 upsert（存在更新、不存在创建）；同一 key 多次出现以最后一次为准。
- **权限**：admin 控制器复用 `AuthModule` 导出的 Guard；GET 公开无 Guard。

### 验证结果（均通过）
- `pnpm build` Exit code 0；ReadLints 对新增/修改文件无错误。
- `node dist/main.js` 启动，3 条路由挂载：`GET /api/site-config`、`GET/PUT /api/admin/site-config`。
- 冒烟（pwsh 7 `Invoke-WebRequest -SkipHttpErrorCheck -NoProxy`）：
  - 游客 `GET /api/site-config` → 200，含 6 字段（初始 4 项「请填写」+ companyName/footerText 默认值）。
  - 未登录 GET/PUT `/api/admin/site-config` → **401**；普通用户 GET/PUT → **403**。
  - admin GET → 200；admin PUT（phone/email/companyName/footerText/icp 批量）→ 200，返回新值；随后游客 GET 反映新 phone/email（验证落库）。
  - 非白名单 key → **400**；空 items → **400**；`/api/health` 仍 `db:up`。

### 遗留 / 说明
- **dev 库站点配置已被冒烟改写**：4 个原始键值由「请填写」改为测试值，并新增 `company_name`/`footer_text` 两行；重跑 `prisma db seed` 会把原 4 键覆盖回「请填写」（seed 不含新两键，不影响）。
- **前端尚未接入**：5 个页面 Footer 仍写死「请填写」与版权文案；待第 10 步前端迁移时改为读 `GET /api/site-config`（含新增 ICP 渲染位）。
- **临时冒烟脚本已删除**：`server/smoke-siteconfig.ps1` 测试后已删除，不入库。
- **下一步（第 10 步）**：前端迁移 Next.js（以 Vite 原型为 UI 基准，接入已完成的全部后端接口 + 受控表单三态）。

## 〇之始·前端接入、前端 API 网络层基建已落地（2026-06-01，src/lib/）

> 对应「九、开发顺序」第 10 步前置：在迁移 Next.js 之前，先在当前 Vite 原型内打通「前端调用已完成后端」的基础设施。本步**只做基建**：不接任何页面业务、不改页面 UI 与业务逻辑、不动后端 `server/`、不删除 `communityData.ts`（仍为验收基准）。

### 新增 / 修改文件
- 新增 `.env.example`（前端）：`VITE_API_BASE_URL=/api`，并说明可改直连 `http://localhost:4000/api`。
- 改 `vite.config.ts`：新增 `server.proxy`，`/api → http://localhost:4000`（`changeOrigin:true`），规避 Vite(5173)↔后端(4000) 跨域；生产由 Cloudflare/反代处理，不依赖此配置。
- 新增 `src/lib/token.ts`：`getToken/setToken/clearToken`，localStorage 键 `sj_token`，含 `typeof window` 与 try/catch 兜底。
- 新增 `src/lib/http.ts`：核心请求封装。读 `VITE_API_BASE_URL`（缺省 `/api`）；自动带 `Authorization: Bearer`（`auth` 默认 true，公开接口可传 false）；解析 `{code,message,data}`，仅返回 `data`；HTTP 非 2xx 或 `code!==0` 抛 `ApiError(message,code,status)`；401 先 `clearToken()`；兼容空响应体；导出 `http.get/post/put/patch/delete`。
- 新增 `src/lib/types.ts`：`ApiResponse<T>`、`PaginatedResponse<T>`、`User`、`AuthResult`、`Category`、`ModelListItem`、`ModelDetail`、`SiteConfig` 等，字段对齐后端 VM。
- 新增 `src/lib/useRequest.ts`：通用三态 Hook，返回 `{data,loading,error,run,reset}`，手动触发（manual），含 requestId 竞态保护，错误统一收敛为 `ApiError`。
- 新增 `src/lib/format.ts`：`formatViews`（数值→「2.1k」）、`formatRelativeTime`（ISO→「N天前/N周前/N个月前」）、`coverStyleByType`（按 type 推导封面渐变 + 纹理，补回后端不返回的 `color/pattern`）。
- 新增 `src/lib/api/siteConfig.ts`：`getSiteConfig()` 调 `GET /site-config`（公开，`auth:false`），用于连通性验证与后续 Footer 复用。
- 改 `src/app/App.tsx`：仅新增全站 `<Toaster richColors position="top-center" />`（复用既有 `components/ui/sonner`）；因各页面以 `useState` 模拟路由存在多处提前 return，用共享 `toaster` 元素在每个返回分支挂载，**未改任何页面 UI/业务逻辑**。
- 改 `src/vite-env.d.ts`：补 `ImportMetaEnv.VITE_API_BASE_URL` 类型声明。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 设计要点
- **单一访问入口**：所有页面后续只通过 `src/lib/api/*`（基于 `http.ts`）访问后端，不直接散写 fetch；错误统一 `ApiError`，三态统一 `useRequest`，提示统一 sonner。
- **同源代理优先**：本地用 `/api` + Vite 代理，零跨域；后端 dev `CORS_ORIGIN` 已含 `5173`，如需直连也可用。
- **展示适配前置**：`format.ts` 解决后端「数值/ISO 时间/无 color-pattern」与原型「字符串展示/渐变封面」的落差，保证接页面后视觉不回归。
- **可平移 Next**：`src/lib/` 与类型设计与框架无关，迁移 Next.js 时可整体平移（token 模块已留 `typeof window` 守卫）。

### 验证结果（均通过）
- `pnpm build`（vite v6.3.5）Exit code 0，`✓ 1614 modules transformed`（较此前 1610 增 4 个 lib 模块）；ReadLints 对全部新增/修改文件无错误。
- `pnpm dev`(5173) + 后端(4000) 同时运行：经代理 `GET http://localhost:5173/api/site-config` → `200 {code:0,message:"ok",data:{phone/email/address/icp/companyName/footerText}}`，与直连 `http://localhost:4000/api/site-config` 结果一致，**代理连通性通过**。

### 遗留 / 说明
- 本步**未接任何页面业务、未调用 toast**；`communityData.ts` 静态数据保留作为验收基准，未删除。
- `.env.local` 需开发者自行复制 `.env.example` 生成（不入库）；缺省时 `http.ts` 兜底 `/api`，行为不受影响。
- 真实 R2 直传、登录态联动（NavBar/个人中心）等留后续页面接入步骤。
- 临时连通性脚本 `__smoke_proxy.ps1` 测试后已删除，不入库。
- **下一步**：登录态地基（`AuthContext` + `api/auth.ts` + AuthPage 接 `/auth/*` + NavBar 登录态），再逐页接入。

## 〇之续、登录态地基 + AuthPage 接 /api/auth/*（第 10B）已落地（2026-06-01，src/）

> 对应「九、开发顺序」第 10 步前置二。在当前 Vite 原型内打通**登录态全链路**：API 封装 → 全站登录态上下文 → AuthPage 真实接口 + 三态 → NavBar 登录态显示。**只改前端 + 本检查点，不动后端 `server/`**；不接模型库/上传/个人中心；不删 `communityData.ts`（仍为验收基准）。登录/注册成功后跳模型库（方案 B，与「正在进入模型库」文案一致）。

### 新增 / 修改文件
- 新增 `src/lib/api/auth.ts`：封装 6 个认证接口——`sendCode/register/login/resetPassword`（公开，`auth:false`）、`getMe/logout`（带 Bearer）；入参类型严格对齐后端 DTO（register 的 `account/code/password/company?/roleType?/agreed`；login 的 `account/loginType/password?/code?`；send-code 的 `target/scene`；reset 的 `account/code/newPassword`）。
- 新增 `src/app/AuthContext.tsx`：`AuthProvider` + `useAuth`，对外 `user/isAuthed/bootstrapping/setAuth/logout/refresh`。**启动自举**：挂载时若 `getToken()` 存在则调 `GET /auth/me` 恢复登录态，失败（含 401）兜底 `clearToken()`+清空 user；`setAuth` 写 token + 设 user；`logout` 调接口（容错）+ 清 token + 清 user。
- 改 `src/lib/types.ts`：`User` 增 `roleType?: string | null`（后端 `me` 实际返回该字段）。
- 改 `src/app/App.tsx`：默认导出 `App` 用 `<AuthProvider>` 包裹，原主体抽为 `AppContent`；`AuthPage` 注入 `onNavigateModels={() => nav.models()}`。
- 改 `src/app/AuthPage.tsx`：新增 `onNavigateModels` prop；登录/注册/找回密码表单**全部受控**；接入 `send-code/login/register/reset-password`；三态用本地 loading 布尔 + sonner `toast`（错误优先取 `ApiError.message`）；**发码成功后才 `setCountdown(60)`**；**开发环境 `devCode` 用 toast 展示**；登录/注册成功 `setAuth` 后 `onNavigateModels()`；找回密码弹窗重构为「账号 + 重置验证码(独立倒计时) + 新密码 + 重置」真实流程。
- 改 `src/app/NavBar.tsx`：`useAuth` 条件渲染右侧操作区——未登录「注册/登录」，已登录「昵称(UserRound 图标) + 退出登录」，PC 与移动端菜单均覆盖；`handleLogout` 退出后 `close()` + toast + `onNavigateHome()`。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 设计要点
- **token 机制复用既有基建**：`token.ts`（localStorage `sj_token`）+ `http.ts`（自动 Bearer、401 自动 `clearToken`）；AuthContext 仅在其上维护内存态与自举。
- **公开接口不带 token**：`send-code/register/login/reset-password` 用 `auth:false`，避免无谓携带；`me/logout` 带 Bearer。
- **倒计时与发码解耦**：仅接口成功才启动倒计时；登录/注册共用 `countdown`，找回密码弹窗用独立 `forgotCountdown`，互不影响。
- **错误三态统一**：所有失败 `toast.error(ApiError.message)`（后端中文文案，如「账号或密码错误」「验证码错误」「该账号已注册」）；成功 `toast.success`，登录态写入后跳转。
- **UI 不变**：仅在 NavBar 右侧操作区按登录态切换内容，沿用既有按钮样式；其余视觉/文案/布局未改。

### 验证结果（均通过）
- `pnpm build`（vite v6.3.5）Exit code 0，`✓ 1618 modules transformed`（较前 1614 增 4 个 lib/上下文模块）；ReadLints 对全部新增/修改文件无错误。
- 联调（`pnpm dev` 5173 经 Vite 代理 → 后端 4000，随机手机号避免撞库）全流程 `code:0`：
  - `send-code(register)` 返回 `devCode`；`register` 注册即登录返回 `accessToken`+`user`；`GET /auth/me`（Bearer）恢复登录态（含 `roleType/role`）。
  - `login(password)`、`send-code(login)`+`login(code)`、`send-code(reset)`+`reset-password`+新密码 `login(password)`、`logout` 全部通过。
  - 负向：错误密码 `login` → **401**。

### 遗留 / 说明
- **dev 库新增 1 个测试用户**（联调随机手机号注册，密码经重置流程改过），属冒烟残留，可按需清理。
- **《用户协议》《隐私政策》仍为视觉占位**：本阶段未接协议弹窗/页面（按约定）。
- **登录态仅前端 access-only**：token 默认 2h，过期后任意请求 401 → `http.ts` 自动清 token，AuthContext 下次 `refresh`/操作时归零（无服务端强制失效）。
- **临时联调脚本 `server/__smoke_auth.ps1` 已删除**，不入库。
  - **未接**：模型库/上传/个人中心的登录态联动（如收藏、发布、`/users/me/*`）留后续逐页接入步骤。
  - **下一步**：按计划逐页接入后端（如模型列表/详情接 `GET /api/models`、个人中心接 `/api/users/me/*`、联系/训练表单接 `/api/contact/leads`、`/api/training-applications`）。
- **第 10 步·阶段三（ModelLibrary 接模型读接口，即第 10C）已完成**（2026-06-01，`src/`，详见「〇之衍·模型库接入」节）：
  - 新增 `src/lib/api/categories.ts`（`getCategories` → `GET /api/categories`，公开 `auth:false`）、`src/lib/api/models.ts`（`getModels` → `GET /api/models`，`getModelDetail` → `GET /api/models/:id`；`ModelSort` 枚举与 `GetModelsParams`）。
  - `src/lib/types.ts` 给 `ModelListItem`（详情 `ModelDetail` 继承）补 `coverUrl: string`（对齐后端列表/详情 VM 实际返回）。
  - `src/app/ModelLibrary.tsx` 列表/详情数据源由 `communityData` 静态数据改为后端接口：分类来自 `GET /api/categories`（前端补「全部模型」，失败回退静态 `MODEL_TYPES`）；搜索 `keyword`（点击「搜索」/回车提交，后端按标题+作者检索）；排序中文→英文映射（最新发布/热门浏览/最多收藏/推荐模型→latest/views/favorites/recommended）；「加载更多」按 `page/pageSize` 分页累加，数量用后端 `total`；点击卡片按 id 拉 `GET /api/models/:id` 进详情。
  - 封面 `color/pattern` 后端不返回，统一用 `format.ts` 的 `coverStyleByType(type,id)` 推导渐变；`viewsCount`→`formatViews`、`createdAt`→`formatRelativeTime` 展示；详情 iframe 由 `viewerUrl && allowIframe && viewerType!=='none'` 决定，有链接但不允许内嵌时给「在新窗口打开」兜底。
  - loading（首屏骨架卡片 / 详情 Loader）/ error（toast + 重试按钮 / 详情错误空状态）/ empty（未找到相关模型 / 模型不存在）三态齐全；列表请求 `listReqIdRef` 竞态保护。
  - **本阶段不接点赞/收藏写接口**（卡片/详情 liked/saved 仍为前端视觉态）；个人中心仍用 `communityData` 占位（留 `/api/users/me/*`）；`communityData.ts` 未删除（个人中心数据源 + 降级 + 验收基准）。未触碰后端 `server/`。
  - 验证：`pnpm build`（vite v6.3.5）Exit code 0、`✓ 1621 modules`（较前 1618 增 3）；ReadLints 无错误。经 Vite 代理(5173)→后端(4000) 冒烟全过：分类 4 项；列表 `total=13/page/pageSize`；`keyword=BIM` total=3（命中标题与作者「BIM 用户」）；`type=实景三维` total=6；`sort=views` 降序（2100→1200）；`page=2&pageSize=4` 返回 4 条；详情 id=1 `viewerType=sketchfab/allowIframe=true/viewerUrl` 有值、id=2 `viewerType=none`；id=999999→404；空关键词 total=0。

## 〇之衍·模型库接入、ModelLibrary 接模型读接口（第 10C）已落地（2026-06-01，src/）

> 对应「九、开发顺序」第 10 步阶段三。在当前 Vite 原型内把**模型库列表页的列表/详情数据源由静态 `communityData` 切换为后端接口**（`GET /api/categories`、`GET /api/models`、`GET /api/models/:id`）。**只改前端 + 本检查点，不动后端 `server/`**；不接点赞/收藏写接口；不删 `communityData.ts`（个人中心数据源 + 降级 + 验收基准）。

### 新增 / 修改文件
- 新增 `src/lib/api/categories.ts`：`getCategories()` → `GET /api/categories`（公开 `auth:false`），返回 `Category[]`，name 作为分类按钮文案。
- 新增 `src/lib/api/models.ts`：`getModels(params)` → `GET /api/models`（type/keyword/sort/page/pageSize），返回 `PaginatedResponse<ModelListItem>`；`getModelDetail(id)` → `GET /api/models/:id`，返回 `ModelDetail`；导出 `ModelSort` 枚举与 `GetModelsParams`。auth 默认 true（登录态自动带 Bearer，后端 `OptionalJwtAuthGuard` 游客也可访问）。
- 改 `src/lib/types.ts`：`ModelListItem` 增 `coverUrl: string`（`ModelDetail` 继承），对齐后端列表/详情 VM 实际返回。
- 改 `src/app/ModelLibrary.tsx`：列表/详情接后端（见下「设计要点」）；`UploadModal`/`TrainingModal` 未改；`PersonalCenter` 仍用 `communityModels` 静态占位（onView 改为传 id）。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 设计要点
- **分类筛选**：挂载时 `getCategories()`，成功则 `["全部模型", ...names]` 覆盖筛选按钮；失败静默回退静态 `MODEL_TYPES`，不打断页面。`activeType` 存分类名，「全部模型」→ `type` 不传。
- **搜索**：搜索框值 `searchInput` 与提交值 `keyword` 分离；点击「搜索」或回车才 `setKeyword`（后端按标题+作者昵称检索，**不含标签**，属已知限制）。
- **排序**：`SORT_MAP` 把中文按钮映射后端枚举（最新发布/热门浏览/最多收藏/推荐模型 → latest/views/favorites/recommended）；切换即重载第 1 页。删除原 `parseViews/sorted` 前端模拟排序。
- **分页**：`loadModels(targetPage, append)`；切换分类/排序/搜索 → 第 1 页替换；「加载更多」→ `page+1` 追加；`canLoadMore = list.length < total`，到底禁用并显示「已加载全部模型」。数量改用后端 `total`。`listReqIdRef` 做竞态保护，仅最后一次请求结果写状态。
- **详情**：卡片点击只存 `detailId`，`useEffect([detailId])` 拉 `getModelDetail`；详情页接收 `ModelDetail`；相关推荐由主页面从已加载 `list` 排除当前 id 取前 4（后端暂无 `/related`）。`initialModelId`（社区页跳入）→ `setDetailId` 直开详情。
- **iframe Viewer**：`canEmbed = !!viewerUrl && allowIframe && viewerType!=='none'`；满足则 `<iframe src={viewerUrl}>`（sandbox/allow 同原型），否则回退占位 UI；有链接但不允许内嵌时给「在新窗口打开」兜底（用 `allowIframe` 收口空白风险）。
- **视觉补偿**：后端不返回 `color/pattern`，卡片/详情/相关推荐封面统一用 `coverStyleByType(type, id)` 推导渐变；`viewsCount`→`formatViews`（「2.1k」）、`createdAt`→`formatRelativeTime`（「2天前」）；`tags/scenes` 用 `toTagArray` 守卫为数组防脏数据。
- **三态**：列表 loading 骨架卡片、error toast+「重新加载」、empty「未找到相关模型」；详情 loading（Loader2）、error/404「模型不存在或暂未公开」+「返回模型列表」。
- **本阶段不接点赞/收藏写接口**：卡片/详情 `liked/saved` 仍为本地视觉态；登录态 `isLiked/isFavorited` 暂不读取（留 10D）。

### 验证结果（均通过）
- `pnpm build`（vite v6.3.5）Exit code 0，`✓ 1621 modules transformed`（较前 1618 增 3）；ReadLints 对全部新增/修改文件无错误。
- 冒烟（pwsh 7 `Invoke-RestMethod -NoProxy`，经 **Vite 代理 5173 → 后端 4000**，即前端真实访问路径）：
  - `GET /api/categories` → 4 项（reality-3d/bim/component/robot-training）。
  - `GET /api/models` → `total=13`、`page=1`、`pageSize=12`、本页 12 条；`coverUrl` 为空串（未接 R2，前端用渐变占位）、`viewsCount/createdAt` 正常。
  - `?keyword=BIM` → total=3（含作者「BIM 用户」命中）；`?type=实景三维` → total=6；`?sort=views` → 2100→1200 降序；`?page=2&pageSize=4` → page=2、4 条。
  - `GET /api/models/1` → `viewerType=sketchfab`、`allowIframe=true`、`viewerUrl` 有值（详情页将走 iframe）；`/2` → `viewerType=none`、`viewerUrl` 空（走占位）。
  - `GET /api/models/999999` → 404；`?keyword=zzzznomatch` → total=0（空状态）。

### 遗留 / 说明
- **后端 keyword 不含 tags**：原前端「按标签搜索」失效，属后端已知限制（二期 `pg_trgm`/jsonb），本阶段未改后端。
- **dev 库残留测试模型**：`total=13` 含早期冒烟产物（如「A published model」等 id≥11），非种子数据，可按需清理，不影响功能。
- **coverUrl 暂为空串**：未接 R2，封面继续用 `coverStyleByType` 渐变占位，不渲染 `<img>`；待 R2 真实封面再切换。
- **相关推荐用同列表近似**：后端无 `/related`，从当前已加载列表取；当列表为空（如直开详情且列表未加载完）相关推荐可能为空，已做 `related.length>0` 守卫隐藏该区。
- **个人中心仍静态**：`/api/users/me/*` 未接，PersonalCenter 仍读 `communityModels`（onView 已改传 id，点击可进真实详情）。
- **点赞/收藏未持久化**：留第 10D（写接口 + 登录态 isLiked/isFavorited）。
  - **临时冒烟脚本 `__smoke_10c.ps1` 测试后已删除，不入库。**
  - **下一步**：可接 10D（点赞/收藏写接口 + 登录态互动状态）或个人中心 `/api/users/me/*`，或继续接联系/训练表单三态。
- **第 10 步·阶段四（点赞/收藏写接口 + PersonalCenter 接后端，即第 10D）已完成**（2026-06-01，`src/`，详见「〇之澜·互动与个人中心接入」节）：
  - `src/lib/api/models.ts` 扩展 4 个互动写接口：`likeModel/unlikeModel/favoriteModel/unfavoriteModel`（`POST|DELETE /api/models/:id/like|favorite`，需 Bearer）。
  - 新增 `src/lib/api/users.ts`：`getMyModels/getMyPublished/getMyFavorites/getMyApplications/getMyStats`（个人中心 5 个只读接口）。
  - `src/lib/types.ts` 新增 `LikeResult/FavoriteResult/MyModel/MyFavorite/MyApplication/MeStats`（对齐后端 VM；日期按 ISO string）。
  - `ModelLibrary.tsx`：`ModelCard` 点赞/收藏改真实接口（用 `isLiked/isFavorited` 初始化、乐观更新 + 接口校正 + 失败回滚 + 防连点）；详情页 `ModelDetailPage` 收藏改真实接口（点赞维持仅列表卡片，详情无点赞按钮，未改布局）；未登录点击点赞/收藏/个人中心 → toast「请先登录后再操作」+ 跳 AuthPage（`onNavigateAuth`）；`PersonalCenter` 四 Tab 全接 `/api/users/me/*` + Tab 角标取 `me/stats`，三态齐全，「我的收藏」`isAvailable=false` 灰显且禁止进详情。
  - **未接**：上传发布（`POST /api/models`、`/api/uploads/*`）、联系表单（`/api/contact/leads`）、训练申请提交（`POST /api/training-applications`）——均保留占位态。`communityData.ts` 仅保留 `typeTagColor` 配色映射（不再作为 PersonalCenter 数据源），仍为验收基准。
  - 验证：`pnpm build`（vite v6.3.5）Exit code 0、`✓ 1622 modules`（较前 1621 增 1）；ReadLints 无错误。经 Vite 代理(5173)→后端(4000) 冒烟全过：点赞 368→369、重复点赞幂等仍 369、取消 368；收藏 0→1、带 token 详情 `isFavorited=true`（刷新保持）、取消 0；未登录点赞 → **401**；`me/favorites` 收藏后 `total=1`（`isAvailable=true/isFavorited=true/favoritedAt` 有值）；`me/{models,published,applications,stats}` 均正常返回。

## 〇之澜·互动与个人中心接入、点赞/收藏 + PersonalCenter 接后端（第 10D）已落地（2026-06-01，src/）

> 对应「九、开发顺序」第 10 步阶段四。在当前 Vite 原型内把**模型点赞/收藏改为后端写接口**（登录态持久化），并把**个人中心四个 Tab 由静态/写死数据切换为后端 `/api/users/me/*`**。**只改前端 + 本检查点，不动后端 `server/`**；不接上传发布、不接联系表单与训练申请提交；`communityData.ts` 仅保留配色映射，仍为验收基准。

### 新增 / 修改文件
- 改 `src/lib/api/models.ts`：新增 `likeModel(id)`/`unlikeModel(id)`/`favoriteModel(id)`/`unfavoriteModel(id)`，对应 `POST|DELETE /api/models/:id/like|favorite`（auth 默认 true 带 Bearer，未登录后端 401）。
- 新增 `src/lib/api/users.ts`：`getMyModels({status?,page?,pageSize?})`、`getMyPublished`、`getMyFavorites`、`getMyApplications`、`getMyStats`，统一返回后端分页结构 / 统计对象。
- 改 `src/lib/types.ts`：新增 `LikeResult`/`FavoriteResult`/`MyModel`/`MyFavorite`/`MyApplication`/`MeStats`，字段严格对齐后端 `users.vm.ts` 与互动接口返回（后端 `Date` 经 JSON 序列化为 ISO 字符串，前端按 `string` 声明）。
- 改 `src/app/ModelLibrary.tsx`：
  - `ModelCard`：新增 `isAuthed`/`onRequireAuth` 入参；`liked/saved` 用 `model.isLiked/isFavorited ?? false` 初始化，`likes` 用 `model.likesCount` 初始化；列表刷新时用 `useEffect` 同步最新后端字段；`handleLike/handleSave` 乐观更新（先切 UI + 角标 ±1）→ 调接口 → 用返回值校正 → 失败回滚 + `toast.error`；`likePending/savePending` 防连点。
  - `ModelDetailPage`：新增 `isAuthed`/`onRequireAuth`；收藏按钮接 `favoriteModel/unfavoriteModel`，`favs` 计数本地态随操作更新；切换模型时同步收藏态/计数。**点赞仅在列表卡片接入**（详情页原型无点赞按钮，未加按钮、未改布局）。
  - 新增 `Async<T>` 三态容器 + `TabState` 渲染外壳（loading 骨架 / error+重试 / empty 空态 / 数据）。
  - `PersonalCenter`：用 `useAuth` 取昵称；挂载拉 `getMyStats` 作 Tab 角标；四 Tab 懒加载（首次进入才请求、已加载缓存、错误经「重新加载」重试）；「我的模型/我的发布」用 `modelStatusMeta` 映射审核状态中文角标，「我的申请」用 `applicationStatusMeta`；「我的收藏」`isAvailable=false` 灰显 + 「已下架」标签 + 禁止点击进详情。
  - 主组件 `ModelLibrary`：`useAuth` 取 `isAuthed`；`requireAuth`（toast +`onNavigateAuth`）；把 `isAuthed/requireAuth` 透传给卡片与详情；「个人中心」入口未登录 → `requireAuth()`，登录才 `setShowPersonal(true)`。
  - `communityData` 的 import 由 `{ communityModels, typeTagColor }` 收窄为 `{ typeTagColor }`（个人中心不再依赖静态数据）。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 设计要点
- **登录态初始化**：列表/详情读接口在登录态下后端附带 `isLiked/isFavorited`，前端据此初始化按钮，**刷新后状态保持**；游客无该字段 → `?? false`。
- **乐观更新 + 校正 + 回滚**：点击即时反馈，成功用后端 `liked/likesCount`、`favorited/favoritesCount` 校正，异常回滚本地态与计数并 toast；后端幂等保证重复点赞/收藏不重复计数、取消不为负。
- **未登录拦截**：点赞/收藏/个人中心入口统一 `requireAuth()` → 提示 +跳 AuthPage（落实文档「未登录跳注册/登录页」）。
- **个人中心三态 + 角标**：每 Tab 独立 loading/error/empty；Tab 角标数取 `me/stats`，与各列表 `total` 同源对齐。
- **收藏可用性**：`me/favorites` 的 `isAvailable` 标注模型是否仍 published+public，false 时灰显并禁止进入详情，避免点进 404。
- **UI 不回归**：沿用既有卡片/行/弹窗样式与配色，仅替换数据源与交互绑定；封面继续用 `coverStyleByType` 渐变占位。

### 验证结果（均通过）
- `pnpm build`（vite v6.3.5）Exit code 0，`✓ 1622 modules transformed`（较前 1621 增 1）；ReadLints 对全部新增/修改文件无错误。
- 冒烟（pwsh 7 `Invoke-RestMethod -NoProxy`，经 **Vite 代理 5173 → 后端 4000**，即前端真实访问路径；新注册随机手机号用户）：
  - 点赞 `368→369`；重复点赞幂等仍 `369`；取消点赞 `369→368`。
  - 收藏 `0→1`；带 token `GET /api/models/1` → `isFavorited=true`（**刷新保持**）；取消收藏 `1→0`。
  - 未登录 `POST /api/models/1/like` → **401**。
  - `me/favorites`（收藏后）`total=1`，项含 `id=1/isAvailable=true/isFavorited=true/favoritedAt`；取消后清零。
  - `me/models`、`me/published`、`me/applications`、`me/stats`（新用户均 0）正常返回，结构正确。

### 遗留 / 说明
- **点赞仅列表卡片**：详情页原型无点赞按钮，本期未新增（避免改 Figma 布局）；如需详情点赞需先确认 UI 设计。
- **个人中心无加载更多**：各 Tab 一次取 `pageSize=50`，数据量大时需补分页（二期）。
- **乐观更新与并发**：极端快速连点已用 pending 防护；多标签页并发下以最后一次后端返回为准。
- **上传/表单未接**：发布模型、联系线索、训练申请提交仍为占位（本期约定不接）。
- **临时冒烟脚本 `__smoke_10d.ps1`、`__smoke_10d_fav.ps1` 测试后已删除，不入库。**
- **dev 库新增 2 个测试用户**（冒烟随机手机号注册），点赞/收藏计数已复原，属冒烟残留可按需清理。
- **下一步**：可接上传发布（`POST /api/models` + `/api/uploads/*`）、联系/训练表单三态，或推进 Next.js 迁移。
- **第 10 步·阶段五（ContactPage + TrainingModal 接表单接口，即第 10E）已完成**（2026-06-01，`src/`，详见「〇之澂·表单接入」节）：
  - 新增 `src/lib/api/contact.ts`（`getContactOptions` → `GET /api/contact/options`，公开 `auth:false`；`createLead` → `POST /api/contact/leads`，公开 `auth:false`）、`src/lib/api/training.ts`（`createTrainingApplication` → `POST /api/training-applications`，auth 默认 true：登录回填 userId、游客匿名）。
  - `src/lib/types.ts` 新增 `ContactOptions/CreateLeadPayload/LeadReceipt/CreateTrainingApplicationPayload/ApplicationReceipt`（严格对齐后端 DTO 与回执）。
  - `ContactPage.tsx`：5 个文本字段（name/contactWay/company/email/message）改受控（原 4 个 select/标签已受控）；挂载拉 `GET /contact/options` 覆盖业务场景/数据类型/项目阶段/预算四组选项，失败静默回退本地默认数组（文案与后端逐字一致）；「提交需求」接 `POST /contact/leads`，含 name/contactWay 前端必填校验、submitting loading 态、成功切既有成功态、失败 `toast.error(后端文案)`；「返回表单」清空字段。
  - `ModelLibrary.tsx` 的 `TrainingModal`：5 个字段（contactName/contactWay/company/robotType 默认首项/sceneDesc）改受控（trainTasks 已受控）；「提交申请」接 `POST /training-applications`，含 4 项必填校验、loading、成功切既有成功态、失败 toast；登录态自动带 token 回填 userId（可在个人中心「我的申请」查看）。
  - **未接**：上传发布（`POST /api/models`、`/api/uploads/*`）、后台管理；UploadModal 仍为占位。未改整体 UI 风格、文案、模块顺序；未触碰后端 `server/`；`communityData.ts` 未删。
  - 验证：`pnpm build`（vite v6.3.5）Exit code 0、`✓ 1624 modules`（较前 1622 增 2）；ReadLints 无错误。经 Vite 代理(5173)→后端(4000) 冒烟全过：options 返回 4 组；游客 lead `id=4,status=new`；缺 name → **400**、非法 email → **400**；游客训练申请 `id=6,status=submitted`；登录用户训练申请 `id=7` 且 `GET /training-applications/my` total=1 含 id=7（**userId 回填验证**）；缺 sceneDesc → **400**。

## 〇之澂·表单接入、ContactPage + TrainingModal 接后端表单接口（第 10E）已落地（2026-06-01，src/）

> 对应「九、开发顺序」第 10 步阶段五。在当前 Vite 原型内把**联系我们表单**接 `GET /api/contact/options` + `POST /api/contact/leads`，把**训练数据服务申请弹窗**接 `POST /api/training-applications`。**只改前端 + 本检查点，不动后端 `server/`**；不接上传发布、不接后台管理；不改整体 UI 风格。

### 新增 / 修改文件
- 新增 `src/lib/api/contact.ts`：`getContactOptions()` → `GET /api/contact/options`（公开 `auth:false`）、`createLead(payload)` → `POST /api/contact/leads`（公开 `auth:false`）。
- 新增 `src/lib/api/training.ts`：`createTrainingApplication(payload)` → `POST /api/training-applications`（auth 默认 true，登录带 Bearer 回填 userId，游客匿名）。
- 改 `src/lib/types.ts`：新增 `ContactOptions`、`CreateLeadPayload`、`LeadReceipt`、`CreateTrainingApplicationPayload`、`ApplicationReceipt`，字段严格对齐后端 `CreateLeadDto`/`CreateTrainingApplicationDto` 与回执 VM。
- 改 `src/app/ContactPage.tsx`：详见下「设计要点」。
- 改 `src/app/ModelLibrary.tsx`：仅改内部 `TrainingModal`（导入 `createTrainingApplication`，其余区块未动）。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 设计要点
- **ContactPage 受控化**：新增 `name/contactWay/company/email/message` 5 个受控 state（原 `selectedScene/selectedDataTypes/selectedStage/selectedBudget` 已受控）。提交组装 `CreateLeadPayload`，**可选空字段转 `undefined` 不传**（避免空邮箱触发 `@IsEmail` 校验）。
- **ContactPage 选项接入**：四组选项改为 state，默认值取本地 `DEFAULT_*`（文案与后端 `contact.constants.ts` 逐字一致）；挂载 `useEffect` 调 `getContactOptions()` 成功则覆盖，失败静默回退、不弹错（同 ModelLibrary 接 `getCategories` 策略）。原内联的业务场景/预算数组改为 `sceneOptions.map`/`budgetOptions.map`。
- **TrainingModal 受控化**：新增 `contactName/contactWay/company/robotType(默认 ROBOT_TYPES[0])/sceneDesc` 受控 state（`selectedTasks` 已受控）。
- **三态统一**：两表单各加 `submitting` 布尔——提交按钮 `disabled` + `Loader2` 旋转 + 文案「提交中…」；`try/catch` 失败 `toast.error(ApiError.message)`（后端中文文案），停留表单可重试；成功才置 `submitted=true` 复用既有成功态 UI。ContactPage「返回表单」额外 `resetForm()` 清空字段。
- **必填校验**：前端先校验（ContactPage：name/contactWay；TrainingModal：contactName/contactWay/company/sceneDesc）→ toast 阻断，再由后端 DTO 兜底。
- **游客 vs 登录**：联系线索两者一致（无 token）；训练申请带 token 时后端回填 userId、申请进入个人中心「我的申请」，游客匿名（userId=null）。两表单均**不强制登录**（符合文档：游客可提交），不调用 `requireAuth`。
- **UI 不回归**：仅替换数据源 + 绑定受控值 + 提交逻辑 + loading 文案，未改样式、文案、模块顺序。

### 验证结果（均通过）
- `pnpm build`（vite v6.3.5）Exit code 0，`✓ 1624 modules transformed`（较前 1622 增 2）；ReadLints 对全部新增/修改文件无错误。
- 冒烟（pwsh 7 `Invoke-WebRequest -NoProxy -SkipHttpErrorCheck`，经 **Vite 代理 5173 → 后端 4000**，即前端真实访问路径）：
  - `GET /api/contact/options` → 返回 `scenes/dataTypes/stages/budgets` 四组选项。
  - 游客 `POST /api/contact/leads`（完整字段）→ 200，`{id,status:"new",createdAt}`。
  - 缺 name → **400**（"name 不能为空"）；非法 email（`not-an-email`）→ **400**（"email 必须为合法邮箱"）。
  - 游客 `POST /api/training-applications` → 200，`{id,status:"submitted"}`。
  - 登录用户（注册随机手机号拿 token）`POST /api/training-applications` → 200；`GET /api/training-applications/my` → `total=1` 含该 id（**证明 userId 回填**）。
  - 缺 sceneDesc → **400**（"sceneDesc 不能为空"）。

### 遗留 / 说明
- **公开接口无防刷**：`contact/leads`、`training-applications` 游客可提交，存在脚本灌库风险（后端已知，二期 `@nestjs/throttler` + IP 限频 + 可选图形验证码）。
- **选项双写**：`contact/options` 与 ContactPage 本地默认数组两处文案，需保持一致；二期后端迁 `site_configs` 由后台维护可彻底消除漂移。
- **TrainingModal 不预填登录信息**：登录态未自动回填联系人/手机（保持原型字段为空，由用户填写）；如需体验优化可二期补。
- **dev 库新增冒烟残留**：联系线索 id≈3/4、训练申请 id≈4–7 及 1 个随机手机号测试用户，均为冒烟产物，可按需清理。
  - **临时冒烟脚本 `server/__smoke_10e.ps1` 测试后已删除，不入库。**
  - **下一步**：上传发布（`POST /api/models` + `/api/uploads/*`，需真实 R2）、ModelCommunity 精选模型接入，或推进 Next.js 迁移。
- **第 10 步·阶段六（ModelCommunity 精选模型 + Footer/站点配置接入，即第 10F）已完成**（2026-06-01，`src/`，详见「〇之埠·精选模型与站点配置接入」节）：
  - 新增 `src/app/SiteConfigContext.tsx`（`SiteConfigProvider` + `useSiteConfig`）：挂载时拉一次 `GET /api/site-config` 全站共享，初始值/异常回退用 `DEFAULT_SITE_CONFIG`（取自各页 Footer 写死文案），后端空串字段逐项以默认兜底，避免空白闪烁。
  - `src/app/App.tsx`：根组件在 `<AuthProvider>` 内再包 `<SiteConfigProvider>`；首页 Footer 联系方式/公司名/版权改读 `useSiteConfig`，新增 icp 备案号渲染位（空值不显示）。
  - `src/app/ModelCommunity.tsx`：精选模型由静态 `communityModels.slice(0,6)` 改为 `GET /api/models?page=1&pageSize=6&sort=recommended`，用 `coverStyleByType/formatViews` 补封面渐变与浏览量；异常/空数据静默回退 `FALLBACK_FEATURED`（本地静态前 6）；Footer 同接 `useSiteConfig`。
  - `src/app/AboutUs.tsx`、`src/app/ContactPage.tsx`（侧栏 + Footer）、`src/app/ModelLibrary.tsx`：Footer/侧栏联系方式统一改读 `useSiteConfig`，均补 icp 渲染位。
  - **未接**：上传发布（`POST /api/models`、`/api/uploads/*`）；未改 UI 风格/页面结构/文案；未触碰后端 `server/`；`communityData.ts` 未删（精选回退 + 配色 + 验收基准）。
  - 验证：`pnpm build`（vite v6.3.5）Exit code 0、`✓ 1626 modules`（较前 1624 增 2）；ReadLints 无错误。经 Vite 代理(5173)→后端(4000) 冒烟：`GET /api/site-config` 返回 6 字段（phone/email/companyName/footerText/icp 有值、address 仍「请填写」）；`GET /api/models?page=1&pageSize=6&sort=recommended` 返回 6 条、total=13。
- **第 10 步·阶段七（UploadModal 发布接入，无 R2 可验证版，即第 10G）已完成**（2026-06-01，`src/`，详见「〇之港·发布接入」节）：
  - 新增 `src/lib/api/uploads.ts`（`presignUpload`/`uploadCallback`/`putFileToPresignedUrl`/`uploadFileToR2`；presign **503** 映射固定文案「R2 对象存储未配置，请先配置对象存储」，无本地兜底）。
  - 扩展 `src/lib/api/models.ts`（`createModel` → `POST /api/models`）；`src/lib/types.ts` 补 `FileKind/PresignResult/UploadCallbackResult/CreateModelPayload`。
  - `ModelLibrary.tsx` 的 `UploadModal`：受控表单 + 在线查看链接（viewerUrl）+ 模型/封面文件选择；完整链路 presign→PUT→callback→create 代码保留；**本环境重点验证仅 viewerUrl（viewerType=iframe）发布**；发布按钮未登录 → `requireAuth`；成功 `onPublished`→`loadModels(1,false)`；三态 submitting/toast/成功 UI。
  - **未接真实 R2**：选文件 presign 503 明确提示；不要求 PUT R2 成功；不伪造上传。未改 `server/`。
  - 验证：`pnpm build` Exit code 0、`✓ 1627 modules`（较前 1626 增 1）；ReadLints 无错误。冒烟（5173→4000）：viewerUrl 发布 id=18、`viewerType=iframe`；keyword 列表 total=1；presign **503**；未登录 create **401**。

## 〇之港·发布接入、UploadModal 发布（第 10G，无 R2 可验证版）已落地（2026-06-01，src/）

> 对应「九、开发顺序」第 10 步阶段七。在**无真实 Cloudflare R2 凭证**条件下，把发布弹窗接入后端上传/发布契约；**可验证**：仅 `viewerUrl`（https）外链发布 + 列表刷新 + presign 503 提示 + 未登录拦截；**不可验证**：presign 200 后浏览器 PUT R2 与带 `modelFileId` 的 native 发布（待 R2 + 桶 CORS）。**只改前端 + 本检查点，不动 `server/`**。

### 新增 / 修改文件
- 新增 `src/lib/api/uploads.ts`：`presignUpload`（503→`R2_NOT_CONFIGURED_MESSAGE`）、`uploadCallback`、`putFileToPresignedUrl`（浏览器直传 PUT）、`uploadFileToR2`（完整三步行）。
- 改 `src/lib/api/models.ts`：新增 `createModel(payload)` → `POST /api/models`。
- 改 `src/lib/types.ts`：新增 `FileKind`、`PresignResult`、`UploadCallbackResult`、`CreateModelPayload`。
- 改 `src/app/ModelLibrary.tsx`：`UploadModal` 全量接入；`VISIBILITY_MAP` 中文→`public/private/review`；发布按钮 `requireAuth`；`onPublished` 回调刷新列表。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 设计要点
- **外链发布（无 R2）**：不选模型文件、填 `https://` 的 `viewerUrl` → `POST /api/models` 带 `viewerType=iframe`、`allowIframe=true`；`visibility=public` 时立刻出现在 `GET /api/models`。
- **文件发布（代码保留）**：选模型/封面 → `uploadFileToR2` → 得 `modelFileId/coverFileId` → create；R2 未配置时 **presign 503**，前端固定文案，**不** callback、**不** create、**不** 本地兜底。
- **登录门**：与点赞/个人中心一致，`requireAuth()` + toast，未登录不打开弹窗。
- **三态**：`submitting` + `Loader2`「发布中…」；失败 `toast.error(ApiError.message)`；成功 `toast.success` + 既有成功态 + `onPublished()`。
- **UI 最小增补**：表单内增加「在线查看链接」一行；模型/封面区绑定 hidden file input，样式 class 未改。

### 验证结果（均通过）
- `pnpm build`（vite v6.3.5）Exit code 0，`✓ 1627 modules transformed`（较前 1626 增 1）；ReadLints 无错误。
- 冒烟（pwsh 7 `Invoke-WebRequest -SkipHttpErrorCheck -NoProxy`，经 **Vite 代理 5173 → 后端 4000**）：
  - 新用户 register→token；`POST /api/models`（仅 `viewerUrl`+`viewerType=iframe`+`public`）→ **200**，`id=18`，`viewerType=iframe`。
  - `GET /api/models?keyword=<marker>` → **total=1**，含新模型。
  - `POST /api/uploads/presign`（`.glb`）→ **503**，body 含 R2 未配置（前端映射为固定用户文案）。
  - 无 token `POST /api/models` → **401**。

### 遗留 / 说明
- **PUT R2 与带文件发布未在本环境验收**：需真实 R2 凭证 + 桶 CORS；代码路径已保留。
- **dev 库新增测试模型**：冒烟产物 id=17/18 等，可按需清理。
- **成功态文案**：仍写「审核通过后将在社区展示」；`公开发布` 实际已 published 立即可见列表，文案未改（遵循 UI 不变）。
- **封面可选且依赖 R2**：仅 viewerUrl 发布时不要求封面；若选封面且无 R2，会在 cover 的 presign 阶段 503。
- **临时冒烟脚本 `__smoke_10g.ps1` 测试后已删除，不入库。**
- **下一步**：配置真实 R2 + CORS 后验收文件直传发布；或推进 Next.js 迁移。

## 〇之埠·精选模型与站点配置接入、ModelCommunity 精选模型 + Footer/站点配置（第 10F）已落地（2026-06-01，src/）

> 对应「九、开发顺序」第 10 步阶段六。在当前 Vite 原型内把**模型社区入口页的精选模型由静态 `communityData` 切换为后端 `GET /api/models`**，并把**全站 5 个页面的 Footer/联系方式（含 ContactPage 侧栏）改为读后端 `GET /api/site-config`**。**只改前端 + 本检查点，不动后端 `server/`**；不接上传发布；不迁移 Next.js；不删 `communityData.ts`（精选回退 + 配色 + 验收基准）。

### 新增 / 修改文件
- 新增 `src/app/SiteConfigContext.tsx`：`SiteConfigProvider` + `useSiteConfig` hook + 导出 `DEFAULT_SITE_CONFIG`。挂载时调一次 `getSiteConfig()`（`src/lib/api/siteConfig.ts`，公开接口），全站共享；初始值与异常/未加载完成时回退 `DEFAULT_SITE_CONFIG`（取自各页 Footer 写死文案）；后端返回空串字段逐项以默认兜底（避免出现空白联系方式/公司名）。仿 `AuthContext` 模式。
- 改 `src/app/App.tsx`：根组件在 `<AuthProvider>` 内再包一层 `<SiteConfigProvider>`（拆出 `AppContent` 已存在）；`AppContent` 用 `useSiteConfig` 取 config，首页 Footer 的公司名/电话/邮箱/地址/版权改读 config，新增 icp 备案号渲染位。
- 改 `src/app/ModelCommunity.tsx`：① 精选模型——新增 `FeaturedCard` 统一展示结构 + `FALLBACK_FEATURED`（本地静态前 6）+ `mapModelToFeatured`（后端项→卡片，`coverStyleByType` 补封面渐变、`formatViews` 补浏览量、`likesCount` 取点赞数）；组件内 `useState`+`useEffect` 调 `getModels({page:1,pageSize:6,sort:'recommended'})`，成功且有数据则替换、异常/空数据静默回退；卡片渲染由 `featuredModels.map` 改 `featured.map`（其余卡片 JSX/样式未动，点击仍传 `model.id`）。② Footer 接 `useSiteConfig` + icp 渲染位。
- 改 `src/app/AboutUs.tsx`：Footer 接 `useSiteConfig` + icp 渲染位。
- 改 `src/app/ContactPage.tsx`：侧栏「联系方式」（电话/邮箱）+ Footer（公司名/电话/邮箱/地址/版权）接 `useSiteConfig` + icp 渲染位。
- 改 `src/app/ModelLibrary.tsx`：主组件 `useSiteConfig`，Footer 接 config + icp 渲染位。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 设计要点
- **单次拉取 + 全站共享**：站点配置只在 Provider 挂载时拉一次，5 页（含 ContactPage 两处）共享，避免每个 Footer 各自请求；`useState` 模拟路由切页不重挂根组件，配置常驻缓存。
- **零视觉回归兜底**：`useSiteConfig().config` 始终有值（默认 = 现有写死文案），未加载/接口失败时显示与改造前完全一致（电话/邮箱/地址仍「请填写」占位）；调用方无需判空。
- **精选模型回退策略**：与 ModelLibrary 接 `getCategories`、ContactPage 接 `getContactOptions` 同策略——接口异常/空数据静默回退本地静态，不弹错、不打断页面。
- **封面视觉补偿**：后端不返回 `color/pattern`，精选卡片用 `coverStyleByType(type,id)` 推导渐变 + 纹理；`viewsCount`→`formatViews`、`likesCount` 直取。
- **ICP 渲染位**：各 Footer 新增 `config.icp && <p>…</p>`，默认空值不渲染；后台配置 icp 后自动显示（落实 checkpoint「含新增 ICP 渲染位」约定）。
- **UI 不回归**：仅替换数据源与文本值，未改 className、布局、模块顺序、导航高亮逻辑、文案语气。

### 验证结果（均通过）
- `pnpm build`（vite v6.3.5）Exit code 0，`✓ 1626 modules transformed`（较前 1624 增 2 个：SiteConfigContext + ModelCommunity 依赖）；ReadLints 对全部新增/修改文件无错误。
- 冒烟（pwsh 7 `Invoke-RestMethod -NoProxy`，经 **Vite 代理 5173 → 后端 4000**，即前端真实访问路径）：
  - `GET /api/site-config` → `code:0`，含 6 字段：phone=`0755-...`、email=`hi@shujingspace.com`、companyName/footerText 有值、**icp 有值**（`粤ICP备...`，Footer 备案行将渲染）、address 仍 `请填写`（dev 库占位，前端原样显示）。
  - `GET /api/models?page=1&pageSize=6&sort=recommended` → `code:0`，返回 6 条、`total=13`、`page=1`、`pageSize=6`，含真实 viewsCount/likesCount（id=1 → 2100/368），精选区将渲染真实数据并可点击进详情（透传 id）。

### 遗留 / 说明
- **公共 Footer 组件本阶段未抽取**：5 页 Footer 内边距/字号/导航高亮存在真实差异（如模型库 `py-10`、当前页用静态 `<span>`），强行合并风险高、违背「不重构」红线；本阶段仅替换写死字符串，公共组件留 Next.js 迁移阶段统一设计。
- **address 仍显示「请填写」**：dev 库该字段为占位值，接入后 Footer 原样显示，属正常（待业务方在后台填真实值），非缺陷。
- **recommended 排序当前等同 latest**：后端推荐算法未独立实现，精选 6 条按创建时间倒序（含 id≥11 冒烟测试模型），与原型静态精选不同，属预期。
- **dev 库站点配置为早期 admin 冒烟改写值**：重跑 `prisma db seed` 会把 phone/email/address 覆盖回「请填写」（不含 icp/footerText 两新键，不影响）。
- **临时冒烟脚本 `__smoke_10f.ps1` 测试后已删除，不入库。**
- **下一步**：上传发布（`POST /api/models` + `/api/uploads/*`，需真实 R2）或推进 Next.js 迁移。

## 〇之终·第 10H 全站联调验收与文档收尾（2026-06-01，仅 docs/）

> 本步**不修改** `src/`、`server/`。归档 Vite 原型与 NestJS 后端的联调边界，供验收人与下一 Agent 使用。

### 修改文件

- `docs/dev-checkpoint.md`（本文件）：「🚩 最终检查点」增补 10C–10G、10H；新增「一·续」「一·续二」「二·补」；更新「〇、当前状态速览」。
- `docs/frontend-acceptance-checklist.md`：元信息、图例、各节 🔌 标注、已知限制与未完成项、验收结论扩展项。

### 验收环境（浏览器手动验收前置）

1. `deploy/docker-compose.dev.yml` 启动 Postgres；`server/` 内 `pnpm dev` 或 `node dist/main.js` 监听 **4000**。
2. 项目根目录 `pnpm dev` 监听 **5173**，`vite.config.ts` 已将 `/api` 代理到 4000。
3. 可选：`.env` 中 `VITE_API_BASE_URL=/api`（与 `.env.example` 一致）。

### 建议验收顺序（摘要）

环境 health → auth → site-config Footer → 模型读/社区精选 → 详情 iframe → 登录后点赞收藏 → 个人中心 → 联系/训练表单 → viewerUrl 发布 →（有 R2 后）文件直传 → admin API 用 Postman。

### 本步明确不做

- 不跑全站浏览器勾选、不清理 dev 库、不配 R2、不建 `web/` Next.js 工程。

## 〇之启·Next.js web/ 骨架 + API 连通性（步骤 0–2，2026-06-01，web/）

> 对应 `docs/backend-architecture-plan.md`「九、开发顺序」第 10 步·阶段 0–2。本步**只建 Next.js 工程骨架 + 最小 lib + smoke 页**，不迁移正式 UI、不碰 `src/` Vite 原型、`server/` 后端。

### 新增 / 修改文件
- 新增 `web/` 目录：Next.js 15 + React 18 + TypeScript + Tailwind CSS 4 独立工程（`package.json`、`next.config.ts`、`tsconfig.json`、`postcss.config.mjs`、`pnpm-workspace.yaml`、`.env.example`、`.gitignore`、`README.md`）。
- 新增 `web/lib/`：`http.ts`（`NEXT_PUBLIC_API_BASE_URL`）、`token.ts`、`types.ts`、`api/siteConfig.ts`（自 Vite `src/lib/` 平移）。
- 新增 `web/app/layout.tsx`、`globals.css`、`page.tsx`；新增 `web/components/site-config-smoke.tsx`（smoke 验证页，非正式首页）。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 配置要点
- **环境变量**：`NEXT_PUBLIC_API_BASE_URL=/api`（见 `web/.env.example`）。
- **dev rewrites**（`web/next.config.ts`）：`/api/:path* → http://localhost:4000/api/:path*`（仅 `NODE_ENV=development`）。
- **路径别名**：`@/*` → `web/*`（`tsconfig.json` paths）。
- **outputFileTracingRoot**：指向 `web/`，避免多 lockfile 误推断 workspace 根。

### 验证结果（均通过）
- `web/` 内 `pnpm install` + `pnpm rebuild @tailwindcss/oxide sharp` + `pnpm build` Exit code 0。
- `pnpm dev`(3000) + 后端(4000) 同时运行：`curl --noproxy http://127.0.0.1:3000/api/site-config` → `{code:0, data:{companyName,phone,email,...}}`，与直连 `127.0.0.1:4000` 一致。
- Smoke 页 `http://localhost:3000/` HTTP 200；浏览器端展示 companyName / phone / email（Client Component 调 `getSiteConfig()`）。

### 遗留 / 说明
- **Windows 系统代理**：经代理访问 `localhost` 可能 502，验收/冒烟须 `curl --noproxy` 或 `Invoke-WebRequest -NoProxy`（与 Vite 阶段相同）。
- **next@15.5.7 安全公告**：pnpm 安装时有 deprecated 提示，后续步骤可升级到 patched 版本。
- **`.env.local`**：本地开发用，已在 `web/.gitignore` 忽略，不入库。
- **下一步（步骤 4+）**：逐页迁移 About / Contact 等静态页（Providers 已在步骤 3 完成）。

## 〇之启·二、Next.js AppProviders 基础层（步骤 3，2026-06-01，web/）

> 对应 Next.js 迁移步骤 3。本步**只落地全站 Client Providers + layout 挂载 + sonner**，不迁移正式业务页面 UI、不碰 `src/`、`server/`。

### 新增 / 修改文件
- 新增 `web/components/providers/app-providers.tsx`、`auth-provider.tsx`、`site-config-provider.tsx`。
- 新增 `web/components/ui/sonner.tsx`；新增 `web/lib/api/auth.ts`。
- 改 `web/app/layout.tsx`、`web/app/globals.css`、`web/package.json`、`web/components/site-config-smoke.tsx`、`web/app/page.tsx`（注释）。
- 改 `docs/dev-checkpoint.md`：本文件回写。

### 验证结果（均通过）
- `web/` 内 `pnpm install` + `pnpm build` Exit code 0。
- `pnpm dev`：`http://localhost:3000/` HTTP 200（若 3000 占用则 Next 自动换端口）；smoke 页经 Provider 展示 `companyName/phone/email`；Auth 自举区显示未登录/已登录摘要。
- `curl --noproxy http://127.0.0.1:3000/api/site-config` → `{code:0,...}`。

### 遗留 / 说明
- **端口占用**：本机若已有进程占 3000，新起 `pnpm dev` 会使用 3001，验收时注意实际端口。
- **SSR 首屏**：smoke 页首屏可能短暂显示「正在通过 Provider 加载…」，客户端 hydrate 后展示 API 数据，属预期。
- **下一步**：~~8C 个人中心发布入口~~ → **Next 浏览器全量验收** → R2 / Admin / 部署。

## 〇之启·十四、Next.js 用户侧验收文档收口（2026-06-01，仅文档）

> 本步不修改 `web/`、`src/`、`server/` 业务代码；更新验收清单与检查点，标记 Next.js 用户侧迁移已基本闭环。

### 修改文件
- `docs/frontend-acceptance-checklist.md`：增加 Next.js **:3000** 主验收环境；保留 Vite **:5173** UI 对照；标注 L19 viewerUrl 可验、L21 R2 待凭证；更新验收结论表。
- `docs/dev-checkpoint.md`：本文件；新增「一·续三」迁移清单；更新「二、下一步任务」。

### 当前状态摘要
- **Next.js 已完成**：骨架/API、Providers、NavBar、Home、About、Contact、Auth、Community、Models 列表/详情、点赞收藏、TrainingModal、个人中心、UploadModal、个人中心发布入口、全局样式；**本地 `:3000` 验收通过**。
- **仍未完成**：真实 R2 文件直传、Admin 前端、线上部署。
- **建议下一步**：R2 凭证 + CORS → 真实上传验收 → Admin 后台前端。

## 〇之启·十五、Next.js 本地验收通过（2026-06-01，仅文档）

> 本步不修改 `web/`、`src/`、`server/` 业务代码；将验收人本地测试结果写入检查点。

### 验收结论
- ✅ **`web/` 本地运行恢复正常**：`cd web && pnpm dev`（`:3000`）+ `cd server && pnpm dev`（`:4000`）+ DB。
- ✅ **全局样式问题已解决**：NavBar Logo 尺寸、固定顶栏、圆角按钮、卡片/间距/黑白灰科技风与 Vite `:5173` 一致。
- ⚠️ **生效条件**：样式修复后须 **删除 `web/.next` 并重启 `pnpm dev`**（避免旧 dev 进程/缓存导致仍像裸 HTML）。

### 本地地址约定
- **http://localhost:3000** — Next.js 生产目标前端（主验）
- **http://localhost:5173** — Vite 原型对照基准
- **http://localhost:4000** — NestJS 后端 API

### 阶段状态（与「零、当前阶段快照」一致）
- **已完成**：用户侧页面迁移（Home / About / Contact / Auth / Community / Models / ModelDetail / PersonalCenter / UploadModal 等）+ API 接入。
- **未完成**：真实 R2 直传、Admin 前端、线上部署。
- **下一步**：R2 凭证 + CORS → 真实上传 → Admin 后台前端。

## 〇之启·十六、Next.js 全局样式修复（Tailwind 4 + shadcn 主题，2026-06-01，web/）

> 本步修复 `http://localhost:3000` 页面「像原始 HTML、Tailwind 未生效」问题；只改样式入口与主题，不重迁页面。

### 根因
- 迁移阶段 3 仅建 `web/app/globals.css` 占位（5 个 CSS 变量 + `@import "tailwindcss"`），**未复制** Vite `src/styles/{fonts,tailwind,theme}.css`。
- 缺少 shadcn `@theme inline` 语义色（`bg-background`、`border-border` 等）与 `@layer base`；`tw-animate-css` 未列入 `web/package.json`。

### 新增 / 修改文件
- 新增 `web/styles/fonts.css`（自 `src/styles/fonts.css`）
- 新增 `web/styles/tailwind.css`（`@source` → `app/`、`components/`、`lib/` + `tw-animate-css`）
- 新增 `web/styles/theme.css`（自 `src/styles/theme.css`，含 shadcn 变量与 `@layer base`）
- 改 `web/app/globals.css`：链式 `@import` 上述三文件（对齐 Vite `index.css`）
- 改 `web/app/layout.tsx`：注释更新（仍 `import "./globals.css"` + `className="dark"`）
- 改 `web/package.json`：补 `tw-animate-css@1.3.8`

### 验证结果（均通过）
- `web/` 内 `pnpm install` + `pnpm build` Exit code 0。
- 构建 CSS 含 Tailwind utilities（`.flex`、`.h-7`）与 shadcn 语义 token（`--color-background`、`bg-background`）。
- `GET /`、`/community`、`/models` HTTP 200；HTML 含 `/_next/static/css/...` stylesheet 链接。
- NavBar Logo `h-7`、固定顶栏、圆角按钮、黑白灰科技风与 Vite 原型一致（样式层）。

### 风险 / 说明
- 本地若仍无样式：结束占 **3000** 的旧 `next dev` 进程 → 删 `web/.next` → `cd web && pnpm dev` 重启。
- `web/components/ui/` 未全量复制 shadcn 组件；当前页以 direct Tailwind 为主，theme 已为后续补组件就绪。

## 〇之启·十七、可验证性与文档事实收口（第一阶段，2026-06-02，仅工具链 + 文档）

> 本步只解决「`pnpm lint` 可执行 + 文档事实准确」，**不改任何业务逻辑 / 接口 / 页面 UI / `src/`**。
> 自动化测试本阶段未补，仅如实记录现状（见下「测试现状」）。

### 背景（代码审查发现）
- `server/` 此前声明 `lint: eslint`、`test: jest`，但 **未安装 eslint，无 ESLint 配置**；`src/` 下 **无任何 `*.spec.ts`**，`pnpm test` 结果为 `No tests found`。
- `web/` 此前 `lint: next lint`，但 **未安装 eslint / eslint-config-next，无配置**，`next lint` 不可用。
- 历史各节大量「ReadLints 无错误」「冒烟全过/通过」表述，易被误读为「CLI lint + 自动化测试已通过」，需收口。

### 新增 / 修改文件
- `server/package.json`：devDependencies 补 `eslint@8.57.1`、`@typescript-eslint/parser@8.18.2`、`@typescript-eslint/eslint-plugin@8.18.2`（`lint`/`test` 脚本保持不变）。
- 新增 `server/.eslintrc.js`：温和版（`plugin:@typescript-eslint/recommended`，关闭 `no-explicit-any` 等，`no-unused-vars` 降为 warn，忽略 `dist`/`prisma/seed.ts`）。
- `web/package.json`：devDependencies 补 `eslint@8.57.1`、`eslint-config-next@15.5.7`。
- 新增 `web/.eslintrc.json`：`extends: next/core-web-vitals + next/typescript`，温和 rules。
- `web/pnpm-workspace.yaml`：将 `unrs-resolver`（Next ESLint 导入解析器原生依赖）加入 `allowBuilds`/`onlyBuiltDependencies`，否则 pnpm v11 运行前依赖校验报错、lint 无法启动。

### 验证结果
- ✅ `cd server && pnpm lint` 可执行，**Exit code 0，无 error 无 warning**。
- ✅ `cd web && pnpm lint` 可执行，**Exit code 0，0 error，13 warning**（均为非阻断告警，本阶段不改业务代码）：
  - `@next/next/no-img-element` ×11：NavBar、model-card、about-us(×2)、auth-page、contact-page、home-page(×2)、model-community(×2)、model-library-page。
  - `@typescript-eslint/no-unused-vars` ×1：about-us 的 `HeroRightVisual`。
  - `react-hooks/exhaustive-deps` ×1：model-detail-page `useEffect` 缺 `detail` 依赖。
- ✅ `cd server && pnpm build`（nest build）回归通过。
- ✅ `cd web && pnpm build`（next build）回归通过。

### 测试现状（如实记录，不夸大）
- ⚠️ **自动化测试缺失**：`server/` 无 Jest 用例（`pnpm test` 仍为 `No tests found`），`web/` 无测试脚本。
- ⚠️ 文档历史所称「冒烟全过/通过」均为**开发期人工/脚本级 HTTP 联调**（多为 PowerShell `Invoke-RestMethod -NoProxy`，临时脚本测试后已删除），**不等于** `pnpm test` 自动化测试，也不代表测试覆盖率。
- ⚠️ 「ReadLints 无错误」指 **Cursor/IDE 静态诊断**，**不等于** CLI `pnpm lint`；CLI lint 在本阶段才首次补齐可执行。
- 📌 后续需补「关键路径」自动化测试（建议优先：auth 登录/注册、models 列表/详情、uploads presign 校验、权限 Guard），本阶段未做。

### 风险 / 说明
- `next lint` 已被标记将在 Next.js 16 移除（命令本身有 deprecation 提示），当前 15.5.7 仍可用；迁移到 ESLint CLI 属后续事项，本阶段不处理。
- 本阶段 lint 规则刻意温和，目的为「可执行」而非「零告警」；13 条 web 告警与 server 潜在风格问题留待后续按需收敛，**不在本阶段批量改业务代码**。
- 代码审查发现的 S2/S3/S4（业务/安全/一致性）问题本阶段**未处理**，仅保留在审查报告中待后续阶段。

## 〇之启·十八、上线前安全修复 2A：JWT 生产密钥强校验（2026-06-02，server/ 配置）

> 本步只加强 `JWT_ACCESS_SECRET` 的生产环境校验，**不改业务逻辑 / 接口 / 数据库 schema / 前端**。
> 开发与测试环境保持兼容，不影响本地 `pnpm dev`。

### 背景（代码审查发现）
- `env.validation.ts` 仅 `JWT_ACCESS_SECRET: z.string().min(1)`，**无长度下限、不区分 NODE_ENV、不禁止 dev 占位值**进入生产，存在弱密钥/默认密钥上线风险。

### 新增 / 修改文件
- 改 `server/src/config/env.validation.ts`：新增 `superRefine`，**仅 `NODE_ENV=production` 生效**的 JWT 密钥强校验（长度 + 黑名单 + 占位词）。
- 改 `server/.env.example`：补充生产 JWT 密钥要求注释（长度 ≥ 32、禁用占位词、`openssl rand -base64 48` 生成示例）。
- 改 `docs/dev-checkpoint.md`：本节记录。
- **未改**：`.env`（本地）、`configuration.ts`、`auth.module.ts`、`token.service.ts`、任何接口/前端/schema。

### JWT 校验规则（生产环境 NODE_ENV=production）
1. **长度** `JWT_ACCESS_SECRET.length` 必须 **≥ 32**，否则拒绝启动。
2. **黑名单（精确匹配）**：`replace_me_access` / `replace_me_refresh` / `dev_only_access_secret_change_in_production_0a1b2c3d4e5f` 禁止使用。
3. **占位词（包含匹配）**：含 `dev_only` / `change_in_production` / `replace_me` 任一即拒绝。
- 三类命中均在启动期由 `validateEnv` 聚合抛错并**阻止启动**（fail-fast）；开发/测试环境仅保留 `min(1)`，不受影响。

### 验证结果
- ✅ `cd server && pnpm lint` Exit code 0（无 error 无 warning）。
- ✅ `cd server && pnpm build`（nest build）Exit code 0。
- ✅ 临时脚本对 `validateEnv` 五场景测试（脚本测试后已删除，不入库）：
  - dev + 当前 dev secret → **通过**（本地不受影响）。
  - prod + dev secret（黑名单）→ **失败**：「生产环境禁止使用开发/占位 JWT_ACCESS_SECRET…」。
  - prod + 短密钥（5 字符）→ **失败**：「…长度须 ≥ 32，当前为 5」。
  - prod + 含 `dev_only` 的长串 → **失败**：「…不能包含开发占位词「dev_only」…」。
  - prod + 足够长随机 secret → **通过**。

### 风险 / 说明
- **生产部署连带影响**：若生产当前仍用 dev 默认值或 < 32 的密钥，本校验会让服务**启动失败**（预期的安全行为）；上线前须在服务器环境注入随机强密钥。
- 以 `NODE_ENV=production` 本地联测时，schema 仍要求 `DATABASE_URL` 等必填项存在，测试需提供合法占位以隔离 JWT 校验结果。
- 后续 **2B–2F** 已按「上线前安全与一致性修复」子阶段完成；见「最终检查点·上线前安全与一致性修复」总表。

## 〇之启·十九、上线前安全修复 2B：send-code 接口 IP 限流（2026-06-02，server/ auth）

> 本步只为 `POST /api/auth/send-code` 增加基于 IP 的请求限流，**不改业务逻辑 / 数据库 schema / 前端 / 其它接口**。
> 这不是完整短信防刷方案，仅是接口层基础限流（见下「未覆盖项」）。

### 背景
- `send-code` 此前仅有「同 target+scene 60s 业务限频」（依赖 `verification_codes` 表），缺少**单 IP 层面的频率限制**，同一 IP 可换不同 target 高频请求。

### 实现方案（@nestjs/throttler v6.5.0）
- `auth.module.ts` 导入 `ThrottlerModule.forRoot({ throttlers:[{ name:'default', ttl:60000, limit:5 }], errorMessage:'请求过于频繁，请稍后再试' })`。
- **不注册全局 `APP_GUARD`**：仅在 `send-code` 方法上 `@UseGuards(ThrottlerGuard)` + `@Throttle({ default:{ limit:5, ttl:60000 } })`，因此 login/register/me 等接口**完全不受影响**。
- 选型说明：throttler v6 的 `ttl` 单位为**毫秒**，故 60s = `60000`；采用「模块 forRoot 配置 + 方法级 Guard」是该版本最简单稳定的单接口限流写法（无需自定义 Guard，无需全局拦截）。
- 超限由 `ThrottlerException`（429）抛出，经现有全局异常过滤器统一为 `{code:429, message:'请求过于频繁，请稍后再试', data:null}`。
- **保留原有 60s 业务限频**（`VerificationService` 中 target+scene 逻辑）不变，形成「IP 限流 + 业务限频」双层。

### 新增 / 修改文件
- 改 `server/src/modules/auth/auth.module.ts`：装配 `ThrottlerModule`（仅配置，不全局启用）。
- 改 `server/src/modules/auth/auth.controller.ts`：`send-code` 方法加 `@Throttle` + `@UseGuards(ThrottlerGuard)` 与中文注释。
- 改 `docs/dev-checkpoint.md`：本节记录。
- **未改**：`verification.service.ts`、Prisma schema、其它 controller/service、前端。

### 验证结果（本地，Docker PG + `node dist/main.js`）
- ✅ `cd server && pnpm lint` Exit code 0；`cd server && pnpm build` Exit code 0。
- ✅ `GET /api/health` → `db:up`。
- ✅ IP 限流：同一 IP 连续 send-code（不同 target）第 1–5 次正常，**第 6、7 次 → 429** `{"code":429,"message":"请求过于频繁，请稍后再试","data":null}`。
- ✅ 原业务限频仍生效：同一 target+scene 第 2 次 → 400「验证码发送过于频繁，请稍后再试」（IP 限流之外独立生效）。
- ✅ 不影响其它接口：`login`×7 全 401（凭证错误，非 429）、`register`×6 全 400（校验，非 429）、`me`×6 全 401（无 token，非 429）。

### 未覆盖项（如实记录，不夸大）
- ⚠️ **非完整短信防刷方案**：仅接口层 IP 限流 + 既有业务限频；未做按手机号配额、滑动风控、黑名单等。
- ⚠️ **图形验证码**：未实现，列为**二期待办**。
- ⚠️ **真实短信**：仍为 mock（开发环境返回 devCode），**未接入真实短信服务**，列为后续事项。
- ⚠️ **限流存储为单机内存**：多实例/重启会重置计数；二期上 Redis 后可换分布式存储（见 backend-architecture-plan.md）。

### 风险 / 说明
- **反向代理真实 IP**：当前未处理 `X-Forwarded-For`；生产经 Nginx/Cloudflare 时，需配置 Express `trust proxy`（或自定义 `getTracker` 取转发头），否则限流会以代理 IP 计数导致误限或失效。本阶段未改，列为部署前必办项。
- **dev 库测试残留**：测试新增了若干 `verification_codes` 行（手机号 139111000xx 等冒烟产物），非种子数据，可按需清理，不影响功能。
- 后续 **2C–2F** 已完成；见「最终检查点·上线前安全与一致性修复」总表。

## 〇之启·二十、上线前安全修复 2C：管理员初始化机制（2026-06-02，server/ 脚本）

> 本步新增「环境变量驱动」的管理员初始化脚本，**不做 Admin 前端**、**不改数据库 schema**、**不改业务接口**、**不写真实密码进代码或文档**。

### 背景
- 此前生产无安全的管理员创建入口；`seed.ts` 的 `admin@example.com` 仅为本地开发占位（占位哈希，非可用密码），**不应作为生产登录入口**。

### 新增 / 修改文件
- 新增 `server/prisma/init-admin.ts`：管理员初始化脚本（读取 `ADMIN_*` 环境变量，bcrypt 哈希入库）。
- 改 `server/package.json`：新增脚本 `admin:init`（`ts-node prisma/init-admin.ts`）。
- 改 `server/.env.example`：登记 `ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NICKNAME/ADMIN_FORCE_RESET` 及用法注释（**无真实密码**）。
- 改 `docs/dev-checkpoint.md`：本节记录。
- **未改**：Prisma schema、`auth.service.ts` 等业务逻辑、前端。

### 初始化命令与行为
- 命令：`cd server && pnpm admin:init`（真实值仅运行时注入，例如 PowerShell：`$env:ADMIN_EMAIL=...; $env:ADMIN_PASSWORD=...; pnpm admin:init`）。
- 读取变量：`ADMIN_EMAIL`（必填）、`ADMIN_PASSWORD`（必填）、`ADMIN_NICKNAME`（可选，默认邮箱 @ 前缀）、`ADMIN_FORCE_RESET`（可选，=true 重置密码）。
- 密码强度：长度 ≥ 12；拒绝常见弱密码（精确黑名单）与含 `password/admin/123456/qwerty` 弱口令词。
- 逻辑：邮箱不存在 → 创建 `role=admin, status=active`；已存在且非 admin → 升级为 admin（并恢复 active）；**默认不覆盖密码**，仅 `ADMIN_FORCE_RESET=true` 时重置。
- 安全：bcrypt（cost 10）哈希写入 `users.passwordHash`；**全程不打印明文密码**。

### 验证结果（本地，Docker PG）
- ✅ `pnpm lint` / `pnpm build` 均 Exit code 0（脚本在 `src/` 外，不影响二者）。
- ✅ 缺 `ADMIN_EMAIL`/`ADMIN_PASSWORD` → 清晰错误并 exit 1。
- ✅ 密码 <12 / 含弱口令词 `admin` → 清晰错误并 exit 1。
- ✅ 合法变量 → 创建 admin（`role=admin, status=active`）。
- ✅ `POST /api/auth/login`（密码）→ 200 签发 token；`GET /api/auth/me` → `role=admin, status=active`。
- ✅ admin token 访问 `GET /api/admin/models` → 200（无 token → 401，权限正常）。
- ✅ 再次运行 → 幂等无重复创建（提示「已是 admin 无需变更」）。
- ✅ `ADMIN_FORCE_RESET=true` → 重置密码：新密码登录 200、旧密码 401。
- ✅ `GET /api/health` 仍 `db:up`。

### 安全与说明（如实记录）
- **seed admin 占位账号不作为生产登录入口**：`admin@example.com` 为本地开发占位（占位哈希不可登录），生产管理员必须经 `pnpm admin:init` 用强密码创建。
- **真实密码只经环境变量注入**，严禁提交到仓库（代码 / 文档 / `.env.example` 均不含真实密码；`.env` 已 gitignore）。
- **Admin 前端仍未实现**：当前仅有 `/api/admin/*` 接口与本初始化脚本，无后台 UI。

### 风险 / 说明
- **dev 库测试残留**：测试创建了一个管理员账号（`ops@shujing-space.com`，id=29，冒烟产物）；为 dev 库残留，可按需删除或在验收前 `migrate reset` + `seed` 清理。
- 脚本依赖运行环境的 `DATABASE_URL`（与 seed 同机制）；生产执行需指向生产库并注入 `ADMIN_*`。
- 2D（viewerUrl 域名白名单）已在下一节「二十一」完成。

## 〇之启·二十一、上线前安全修复 2D：viewerUrl 域名白名单（2026-06-02，server/ models）

> 本步对模型「外链发布」入库前增加 **viewerUrl 域名白名单** 校验，防止任意 https 外链被作为 iframe Viewer 内嵌。**不改前端 web/、不改 Vite 原型 src/、不改数据库 schema、不做后台前端、不做 R2 上传增强、不做浏览量打点**。

### 背景
- 此前 `POST /api/models` 仅经 DTO `@IsUrl({protocols:['https']})` 校验，**无域名白名单**：任意注册用户可提交任意 https 外链，详情页会据此 iframe 内嵌（存在内嵌恶意/不可信页面风险）。
- 架构文档（`backend-architecture-plan.md` 7.4）要求：`model_url` 入库前做「协议 https 白名单 + 域名白名单」。

### 新增 / 修改文件
- 新增 `server/src/modules/models/viewer-url.util.ts`：默认白名单 `DEFAULT_VIEWER_ALLOWED_HOSTS` + 主机名匹配 `isViewerUrlAllowed`（基于 `new URL().hostname` 比对，非 includes，防绕过）。
- 改 `server/src/config/env.validation.ts`：新增 `VIEWER_URL_ALLOWED_HOSTS`（`z.string().default('')`，逗号分隔 host）。
- 改 `server/src/config/configuration.ts`：暴露 `viewer.allowedHosts`；env 配置优先，解析后为空时回退 `DEFAULT_VIEWER_ALLOWED_HOSTS`。
- 改 `server/src/modules/models/models.service.ts`：注入 `ConfigService`；外链发布分支入库前调用 `assertViewerUrlAllowed()`，不命中抛 `400 viewerUrl 域名不在允许列表中`。
- 改 `server/.env.example`：登记 `VIEWER_URL_ALLOWED_HOSTS`（说明逗号分隔、只写 host 不写完整 URL、通配 `*.suffix`、缺省回退）。
- 改 `docs/dev-checkpoint.md`：本节记录。
- **未改**：DTO 仍保留 https + 长度校验；`model.vm.ts`、前端 `web/`、Vite `src/`、Prisma schema 均未动。

### 白名单策略
- 仅作用于「外链发布」分支（`POST /api/models` 仅传 `viewerUrl`、无 `modelFileId`）；走 R2 文件上传发布（`modelFileId/coverFileId`）的 `modelUrl` 来自可信 `model_files.url`，**不校验**。
- 校验逻辑：`new URL(viewerUrl)` → 协议必须 `https:` → `hostname` 小写去末尾点 → 逐条匹配白名单。
- 白名单条目两种形式：
  - 精确主机：`sketchfab.com`（仅该主机命中）。
  - 通配子域：`*.xgrids.cloud`（命中裸域 `xgrids.cloud` 与任意层级子域 `a.b.xgrids.cloud`；不命中 `evilxgrids.cloud`——必须等于 base 或以 `.base` 结尾）。
- 防绕过：基于解析后的 `hostname` 比对，`https://sketchfab.com.evil.com`、`https://evil.com/sketchfab.com`、`https://sketchfab.com@evil.com` 均判不通过。

### 环境变量说明
- `VIEWER_URL_ALLOWED_HOSTS`：逗号分隔的允许 host 列表，**只写 host，不写完整 URL**；支持 `*.suffix` 通配。
- 缺省（未配置或为空）时回退默认安全列表：`sketchfab.com,www.sketchfab.com,lcc-viewer.xgrids.cloud`。
- **未来新增 Viewer 服务域名时，需在此变量同步追加**（生产经服务器环境变量注入）。

### 影响范围
- **只影响新建模型时的 viewerUrl 入库**；不迁移、不重校验历史数据；`GET /api/models`、`GET /api/models/:id` 读取不受影响。
- seed 现有 viewerUrl 为 `sketchfab.com`，在默认白名单内，详情页 iframe 行为不变。

### 验证结果
- ✅ `cd server && pnpm lint` Exit code 0。
- ✅ `cd server && pnpm build` Exit code 0。
- 接口冒烟（登录取 token 后 `POST /api/models`）：
  - 不传 `viewerUrl`（或走 R2 文件）→ 成功（不受白名单影响）。
  - `https://lcc-viewer.xgrids.cloud/...` → 成功。
  - `https://sketchfab.com/...` → 成功。
  - `http://sketchfab.com/...` → 400（非 https）。
  - `https://evil.com/...` → 400「viewerUrl 域名不在允许列表中」。
  - `GET /api/models`、`GET /api/models/:id` 正常；`GET /api/health` 仍 `db:up`。

### 风险 / 说明
- 白名单过严会误伤未登记的真实 Viewer 域名，上线前须与业务方确认完整域名清单并写入 env。
- 历史数据不重校验：旧数据若含非白名单链接，详情页仍会内嵌；如需收口另列清洗任务。
- 通配 `*.suffix` 放开过宽会放行该域名下任意子域页面，建议最小授权（优先精确主机）。

## 〇之启·二十四、上线前安全修复 2G：R2 上传安全增强（2026-06-02，server/）

> 加固 `POST /api/uploads/callback`：**必须 HeadObject 确认 R2 对象存在**后才写入 `model_files`；禁止 Head 失败时回退前端上报的 size/mime。**不改 web/、不改 `src/`、不改 schema、不做本地兜底、不做多段上传。**

### 背景（代码审查）
- 旧逻辑：`HeadObject` 失败返回 `null`，callback 仍可用 DTO `size`/`mime` 登记 → 可伪造 `model_files` 而未真实上传。
- 项目红线：文件实体必须在 R2，数据库只存元信息。

### 新增 / 修改文件
- 改 `server/src/modules/uploads/r2.service.ts`：`headObject` 成功才返回元信息；不存在 → **404**；无效 size/空 Content-Type/其它错误 → **400**；未配置 R2 → **503**。
- 改 `server/src/modules/uploads/uploads.service.ts`：callback 仅以 Head 的 `size`/`mime` 入库；`assertSize` + 新增 `assertHeadMime`（Content-Type 白名单）；移除「查不到则容忍」逻辑。
- 改 `server/src/modules/uploads/upload.constants.ts`：新增 `ALLOWED_MIMES` / `isMimeAllowed` / `normalizeMime`。
- 改 `server/src/modules/uploads/uploads.controller.ts`：注释与 Swagger 对齐。
- 新增 `server/src/modules/uploads/uploads.service.spec.ts`：mock Head 失败不写库、成功写库、越权 403。
- 改 `server/package.json`：补充 `jest` 配置（使 `pnpm test` 可跑 uploads 单测）。
- 改 `docs/dev-checkpoint.md`：本节 +「最终检查点」2G 总表。

### callback 新规则（2G）
| 步骤 | 行为 |
|------|------|
| r2Key 前缀 | 必须为 `{kind}/{当前 userId}/`，否则 **403**，不 Head、不写库 |
| HeadObject | **必须成功**；对象不存在 → **404**；无法确认 → **400** |
| size | 仅使用 `ContentLength`；超过 `MAX_*_SIZE_MB` → **400** |
| mime | 仅使用 `Content-Type`（去参数）；不在 `ALLOWED_MIMES[kind]` → **400** |
| 入库 | 成功后才 `model_files.create`；**不再**使用 DTO 的 size/mime 兜底 |

### 不变口径
- `POST /api/uploads/presign`：仍校验扩展名 + 申报 size 上限；R2 未配置 → **503**。
- `POST /api/models` 仅 `viewerUrl` 外链发布：**不受影响**（不走 uploads）。
- **已登记的历史 `model_files`**：不迁移、不重校验；仅新 callback 走 2G 规则。
- **无本地文件兜底**。

### 验证结果
- ✅ `cd server && pnpm lint`、`pnpm build` Exit 0。
- ✅ `cd server && pnpm test`：`uploads.service.spec.ts` 3 例通过（mock Head 失败不写库 / 成功写库 / 越权 403）。
- 接口：`GET /api/health` → **200**，`db:up`（`node dist/main.js` @4000）。
- R2 未配置时 **503** 行为未改：`presign`/`callback` 均在 `R2Service.ensureConfigured()` 抛 `ServiceUnavailableException`，**无本地兜底、不写库**（与「〇之顶」冒烟一致；本机未注入 `R2_ACCESS_KEY_ID` 等时仍 503）。
- 未登录 `presign`/`callback` → **401**（`JwtAuthGuard` 优先于 503）。
- ⚠️ **无真实 R2 凭证时**：无法在浏览器完成 presign→PUT→callback 全链路验收；须注入 `R2_*` + 桶 CORS 后再验。

### 风险 / 说明
- **模型 MIME 常为 `application/octet-stream`**：白名单已包含；若业务方 Content-Type 特殊需在 `ALLOWED_MIMES` 追加。
- **Head 与 PUT 时序**：前端须先 PUT 成功再 callback；过早 callback 会 404（符合安全预期）。
- **重复 callback 同一 r2Key**：仍可插入多条 `model_files`（schema 无唯一约束，二期待办）。
- **大文件多段上传**：仍为单次 PUT，**二期待办**。

## 〇之启·二十三、上线前功能一致性修复 2F：作者可查看自己的非公开模型详情（2026-06-02，server/ + web/）

> 修复个人中心「我的模型」可列出 draft / pending / rejected / private 模型，但点击进入 `GET /api/models/:id` 返回 404 的体验断裂。**不改 Vite 原型 `src/`、不改数据库 schema、不改页面 UI、不改 `GET /api/models` 列表口径、不改点赞/收藏/浏览量打点逻辑。**

### 新增 / 修改文件
- 改 `server/src/modules/models/models.service.ts`：`findOne` 在登录态下 `where: { id, OR: [published+public, { userId }] }`；游客仍仅 `published+public`；无权限统一 404「模型不存在或暂未公开」。
- 改 `server/src/modules/models/model.vm.ts`：`ModelDetailVm` 可选 `status` / `visibility` / `rejectReason`；`toModelDetailVm(..., includeAuthorFields)` 仅作者本人详情附带。
- 改 `server/src/modules/models/models.controller.ts`：注释与 Swagger 摘要对齐 2F 行为。
- 改 `web/lib/types.ts`：`ModelDetail` 可选补充 `status` / `visibility` / `rejectReason`（类型兼容，**未改详情页 UI**）。
- 改 `docs/dev-checkpoint.md`：本节记录。

### 可见性规则（`GET /api/models/:id`）
| 访问者 | 可见范围 |
|--------|----------|
| 游客 | 仅 `status=published` 且 `visibility=public` |
| 登录用户（非作者） | 同上 |
| 登录用户（作者 `model.userId === 当前用户`） | 本人任意 `status` / `visibility` 模型 |
| 不存在或无权限 | **404**，文案不变，避免泄露非公开模型是否存在 |

### 返回字段（作者本人）
- 作者查看**自己的**模型详情时，响应额外包含：`status`、`visibility`、`rejectReason`（与 `MyModelVm` 口径一致）。
- 游客 / 非作者查看公开模型：不返回上述三字段（防泄露）。

### 不变口径
- `GET /api/models` 列表：仍仅 `published + public`。
- `POST /api/models/:id/view`、点赞/收藏：仍仅对 `published + public` 生效（本步未改）。
- 详情仍挂 `OptionalJwtAuthGuard`，**不强制登录**。

### 验证结果
- ✅ `cd server && pnpm lint`、`pnpm build` Exit 0。
- ✅ `cd web && pnpm lint`、`pnpm build` Exit 0（既有 img / hooks 警告，无新增 error）。
- 接口冒烟（dev PostgreSQL + `node dist/main.js` @4000，库内已有 `pending`+`review` 模型 id=20）：
  - 作者 Bearer `GET /api/models/20` → **200**，含 `status=pending`、`visibility=review`。
  - 同一 id 游客 GET → **404**「模型不存在或暂未公开」；另一注册用户 Bearer GET → **404**。
  - `GET /api/models/1`（seed 公开模型）游客 → **200**，响应**不含** `status`/`visibility`。
  - `GET /api/models?pageSize=100` 列表 **不含** id=20。
  - `GET /api/health` → **200**，`db:up`。

### 风险 / 说明
- 作者 Token 失效时 `OptionalJwtAuthGuard` 降级为游客，非公开自有模型会再次 404（与 2E 前行为一致）。
- 作者看自己的非公开模型时，`POST .../view` 与点赞/收藏仍可能 404（互动接口未放宽），属已知限制。
- 非作者对不存在 id 与不可见 id 均为同一 404 文案，符合防泄露要求。

## 〇之启·二十二、模型浏览量打点 2E：POST /api/models/:id/view（2026-06-02，server/ + web/）

> 本步新增**独立的浏览量打点接口**，并在 Next 详情页打开时打点一次。**采用新增 POST 接口、不在 GET /api/models/:id 自动 +1**（GET 保持只读语义，利于缓存/测试与后续防刷去重）。**不改 Vite 原型 src/、不改数据库 schema、不改页面 UI。**

### 新增 / 修改文件
- 改 `server/src/modules/models/models.service.ts`：新增 `recordView(id)`——仅对「已发布+公开」模型 `viewsCount +1`，不存在/不可见抛 404，返回最新 `viewsCount`。
- 改 `server/src/modules/models/models.controller.ts`：新增 `POST /api/models/:id/view`（**无 JwtAuthGuard**，游客/登录均可；`ParseIntPipe` 校验 id；`@HttpCode(200)`）。
- 改 `web/lib/api/models.ts`：新增 `recordModelView(id)` + `ViewResult` 类型。
- 改 `web/components/pages/model-detail-page.tsx`：详情页 `useEffect` 打开后打点一次（`viewedRef` 去重防严格模式重复），成功仅在本地 `setDetail` 同步 `viewsCount`；失败静默。**未新增 UI。**
- 改 `docs/dev-checkpoint.md`：本节记录。
- **未改**：`GET /api/models`、`GET /api/models/:id` 行为；Prisma schema；Vite `src/`；其它页面 UI。

### 接口说明
- `POST /api/models/:id/view`
  - 权限：游客可调用，登录用户也可调用，**不需要 JwtAuthGuard**。
  - 行为：仅 `status=published AND visibility=public` 模型 `viewsCount +1`；模型不存在/不可见 → 404「模型不存在或暂未公开」；`:id` 非数字 → 400。
  - 返回：`{ viewsCount }`（最新值）。
- 前端：Next `/models/[id]` 打开后调用一次，本地状态更新 `viewsCount`；`GET` 读接口不再隐式 +1。

### 防刷说明
- **本阶段未做防刷 / 去重**：每次 `POST .../view` 都 `+1`；前端仅用 `viewedRef` 做「同一模型同次会话不重复打点」的最小客户端去重，**非服务端防刷**。
- 后续可做：服务端按 **IP / User-Agent / 时间窗口** 去重，或引入 Redis 计数 + 异步落库、登录用户「同一模型 N 分钟内只计一次」等。

### 影响范围
- 只新增累加入口，不迁移历史数据；`GET /api/models`、`GET /api/models/:id` 原有行为与返回字段不变。
- Vite `src/` 原型不接入，仍为 UI 验收基准。

### 验证结果
- ✅ `cd server && pnpm lint`、`pnpm build` 均 Exit 0；`cd web && pnpm lint`、`pnpm build` 均 Exit 0。
- 接口冒烟（需运行 dev PostgreSQL）：
  - `POST /api/models/1/view` → 200，`viewsCount` 较前 +1；连续调用持续累加。
  - `POST /api/models/999999/view` → 404。
  - `GET /api/models/1` → `viewsCount` 已反映累加；`GET /api/models` 列表 `viewsCount` 同步。
  - 打开 Next `/models/1` → 浏览量 +1 一次（`viewedRef` 防重复）。
  - `GET /api/health` 仍 `db:up`。

### 风险 / 说明
- 无防刷：可被刷量（直接反复 POST）；上线前若有刷量风险需补服务端去重 / 限流。
- 客户端去重仅限当前组件实例生命周期；切换模型再切回会重新计一次（符合「每次打开打点一次」预期）。
- 计数为冗余字段直接 `increment`，高并发下为数据库原子自增，无需额外锁。

## 〇之启·十三、Next.js 个人中心「发布新模型」入口（步骤 8C，2026-06-01，web/）

> 本步将 `/models/me`「我的模型」Tab 虚线卡接入已有 `UploadModal`；复用 8B 发布逻辑；发布成功后刷新本人列表与 stats。

### 新增 / 修改文件
- 改 `web/components/pages/personal-center-page.tsx`：`showUpload` + 虚线卡 `onClick` + 条件挂载 `UploadModal`。

### 验证结果（均通过）
- `web/` 内 `pnpm build` Exit code 0；ReadLints 无错误。
- `/models/me`「我的模型」有数据时点击虚线卡 → 打开 UploadModal；viewerUrl 发布成功 → 列表与 stats 角标更新；选文件无 R2 → 503 固定提示。
- `/models` 列表页发布入口、UploadModal UI、TrainingModal 未改。

### 遗留 / 说明
- **空列表无虚线卡**：「我的模型」为空时仍仅空态文案，首发布可走 `/models` 顶栏（与 Vite 一致）。
- **真实 R2 直传**：仍待凭证 + CORS 后验收。

## 〇之启·十二、Next.js UploadModal 发布模型（步骤 8B，2026-06-01，web/）

> 本步将 Vite `ModelLibrary.tsx` 内嵌 `UploadModal` 迁入 `web/components/models/upload-modal.tsx`；列表页「发布模型」入口接入；viewerUrl iframe 发布可验证；R2 直传代码路径保留。

### 新增 / 修改文件
- 新增 `web/lib/api/uploads.ts`（平移自 `src/lib/api/uploads.ts`）。
- 扩展 `web/lib/api/models.ts`：`createModel`。
- 扩展 `web/lib/model-library-constants.ts`：`SCENE_OPTIONS`、`VISIBILITY_OPTIONS`、`VISIBILITY_MAP`。
- 新增 `web/components/models/upload-modal.tsx`。
- 改 `web/components/pages/model-library-page.tsx`：`showUpload` + 挂载 `UploadModal`。

### 验证结果（均通过）
- `web/` 内 `pnpm build` Exit code 0；ReadLints 无错误；`/models` 约 8.09 kB。
- 未登录「发布模型」→ toast「请先登录后再操作」+ `/auth`；已登录打开弹窗。
- 仅 viewerUrl（https）发布 → `POST /api/models` 成功 + 列表刷新 + 成功态 UI。
- 选 `.glb` 无 R2 → presign **503** → toast「R2 对象存储未配置，请先配置对象存储」；不进入成功态。
- 关闭/重开弹窗表单重置（条件卸载）；`/models/[id]`、`/models/me`、`TrainingModal` 未改。

### 遗留 / 说明
- **真实 R2 直传端到端**：❌ 待服务器注入 R2 凭证 + 桶 CORS 后验收 presign 200 → PUT → callback → 带 `modelFileId` 发布。
- ~~**个人中心「发布新模型」占位卡**~~ → 8C 已接线打开 UploadModal。
- **成功态文案**：仍写「审核通过后展示」，与 `visibility=public` 立即可见存在产品口径差（与 Vite 一致，UI 未改）。

## 〇之启·十一、Next.js PersonalCenter 个人中心（步骤 8A，2026-06-01，web/）

> 本步将 Vite `ModelLibrary.tsx` 内嵌 `PersonalCenter` 拆为独立路由 `/models/me`；四 Tab 全接 `/api/users/me/*` + stats 角标；UI/交互与 Vite 一致。

### 新增 / 修改文件
- 新增 `web/lib/api/users.ts`（五个 `getMy*` 封装，平移自 `src/lib/api/users.ts`）。
- 新增 `web/components/pages/personal-center-page.tsx`（TabState、懒加载、三态、登录守卫）。
- 新增 `web/app/models/me/page.tsx`。
- 改 `web/components/pages/model-library-page.tsx`：个人中心入口 → `/models/me`。

### 验证结果（均通过）
- `web/` 内 `pnpm build` Exit code 0；`/models/me` 为动态路由 ƒ。
- 未登录访问 `/models/me` → toast + 跳转 `/auth`；登录后四 Tab + stats 角标 + 卡片进 `/models/[id]`；收藏 `isAvailable=false` 灰显不可点。

### 遗留 / 说明
- ~~**UploadModal 未迁**~~ → 8B 列表页 + 8C 个人中心虚线卡均已接入。
- **无分页 UI**：各 Tab `pageSize=50` 一次拉取（与 Vite 一致）。
- **登录回跳**：AuthPage 成功后仍固定 `/models`，未带 `redirect=/models/me`（与 Vite 一致，可二期增强）。

## 〇之启·十、Next.js ModelLibrary 详情页（步骤 7B，2026-06-01，web/）

> 本步迁入 Vite `ModelDetailPage` 至 `/models/[id]`；iframe / 占位 / 新窗口打开与 Vite 一致。

### 新增 / 修改文件
- `web/components/pages/model-detail-page.tsx`
- `web/app/models/[id]/page.tsx`

### 验证结果（均通过）
- `pnpm build` Exit code 0；`/models/[id]` 约 4.13 kB ƒ。
- 浏览器：`/models/1` iframe（seed viewerUrl+allowIframe）；`/models/2` 占位；不存在 id 空态；「返回社区」→ `/models`。

### 遗留 / 说明
- 收藏/申请训练数据服务：7C 接写接口与 TrainingModal。
- 相关推荐数据源为列表接口截取，非专用 /related API（与 Vite 一致）。

## 〇之启·九、Next.js ModelLibrary 列表页（步骤 7A，2026-06-01，web/）

> 本步迁入 Vite `ModelLibrary.tsx` 列表视图至 `/models`；详情仍为 `/models/[id]` 占位。

### 新增 / 修改文件
- `web/components/pages/model-library-page.tsx`、`web/components/models/model-card.tsx`
- `web/lib/api/categories.ts`、`web/lib/model-library-constants.ts`、`web/lib/format.ts`（+formatRelativeTime）
- `web/app/models/page.tsx`

### 验证结果（均通过）
- `pnpm build` Exit code 0；`/models` 约 4.9 kB。
- 浏览器：分类/搜索/排序/加载更多/total/空态；卡片 → `/models/[id]`；Footer site-config（需可选后端 4000）。

### 遗留 / 说明
- 点赞/收藏按钮仅 UI + toast 占位（7C 接写接口）。
- 个人中心/发布模型：~~8A `/models/me`~~；~~8B 列表页 UploadModal~~；~~8C 个人中心虚线卡~~ 均已接入。
- `/models/[id]`：~~7B~~ 已替换正式详情。

## 〇之启·八、Next.js ModelCommunity 模型社区入口页（步骤 6，2026-06-01，web/）

> 本步将 Vite `ModelCommunity.tsx` 迁入 `/community`；精选接 `GET /api/models`；点击精选卡片进 `/models/[id]`（详情为占位壳）。

### 新增 / 修改文件
- 新增 `web/components/pages/model-community.tsx`、`web/lib/api/models.ts`、`web/lib/format.ts`、`web/lib/community-data.ts`。
- 新增 `web/public/community-hero.png`、`web/app/models/[id]/page.tsx`（路由壳）。
- 改 `web/app/community/page.tsx`。

### 验证结果（均通过）
- `pnpm build` Exit code 0；`/community` 约 9.08 kB；`/models/[id]` 为动态路由。
- 浏览器：`/community` Hero/精选/服务卡片顺序/Footer site-config；精选 6 条（后端或回退）；链接 `/models`、`/models/[id]`、`/contact`。

### 遗留 / 说明
- **`/models` 列表仍为占位**：浏览模型/查看全部路由已通。
- **`/models/[id]` 非正式详情**：仅占位壳，待 ModelLibrary 迁移替换。
- **未迁**：UploadModal、PersonalCenter（按任务范围）。

## 〇之启·七、Next.js Home 首页正式页（步骤 5，2026-06-01，web/）

> 本步将 Vite `App.tsx` 中 `page === "home"` 分支完整迁入 `/`；NavBar 仍由 `SiteChrome` 挂载；UI/文案/交互以 `src/app/App.tsx` 为基准。

### 新增 / 修改文件
- 新增 `web/components/pages/home-page.tsx`、`web/components/home/video-modal.tsx`、`web/lib/home-content.tsx`。
- 新增 `web/public/home-hero.png`。
- 改 `web/app/page.tsx`（移除占位壳）。

### 验证结果（均通过）
- `web/` 内 `pnpm build` Exit code 0；`/` 约 7.98 kB First Load JS。
- 浏览器验收项：Hero、NavBar 高亮、业务平台/场景弹窗、工程改造顶图铺满、弹窗无「浏览模型」、CTA→`/contact`、Hero→`/community`/`/about`、Footer 读 `site-config`（需 `pnpm dev` + 可选后端 4000）。

### 遗留 / 说明
- **VideoModal** 仍为模拟进度，未接真实视频 API（与 Vite 一致）。
- **`/community`、`/models`** 仍为 `PagePlaceholder`，Hero「进入模型社区」路由已通。
- **Hero 图约 2.3MB**：首屏 LCP 可后续压缩或换 `next/image`。

## 〇之启·六、Next.js AuthPage 正式页（步骤 4D，2026-06-01，web/）

> 本步将 Vite `AuthPage.tsx` 迁入 `/auth`；独立顶栏；全站认证 API 与 AuthProvider 复用。

### 新增 / 修改文件
- 新增 `web/components/pages/auth-page.tsx`。
- 改 `web/app/auth/page.tsx`。
- `web/lib/api/auth.ts` 已具备（步骤 3 已建），本步无改。

### 验证结果（均通过）
- `pnpm build` Exit code 0。
- 浏览器验收：`/auth` 无全站 NavBar；send-code / register / login / reset-password / logout（NavBar）需本地后端 4000 + Postgres。

### 遗留 / 说明
- **协议链接**：《用户协议》《隐私政策》仍为占位点击样式（与 Vite 一致）。
- **登录后 /models 仍为占位页**：成功跳转路由已通，正式模型库 UI 待后续迁移。

## 〇之启·五、Next.js ContactPage 正式页（步骤 4C，2026-06-01，web/）

> 本步将 Vite `ContactPage.tsx` 完整 UI + 联系表单 API 迁入 `web/app/contact`。

### 新增 / 修改文件
- 新增 `web/components/pages/contact-page.tsx`、`web/lib/api/contact.ts`。
- 改 `web/app/contact/page.tsx`。

### 验证结果（均通过）
- `pnpm build` Exit code 0；`/contact` 路由可静态生成。
- 表单：`GET /api/contact/options` + `POST /api/contact/leads`（需本地后端 4000 + `pnpm dev` 浏览器验收）。

### 遗留 / 说明
- **NavBar「联系我们」按钮**：与 Vite 一致，在 `/contact` 页仍为白底 CTA，主导航三项不高亮（`activePage=contact` 语义）。
- **TrainingModal 未迁**：联系页内无训练申请弹窗（Vite 联系页亦无）。

## 〇之启·四、Next.js AboutUs 正式页（步骤 4B，2026-06-01，web/）

> 本步将 Vite `AboutUs.tsx` 完整 UI 迁入 `web/app/about`，Footer 读 `SiteConfigProvider`。

### 新增 / 修改文件
- 新增 `web/components/pages/about-us.tsx`、`web/public/about-hero.png`。
- 改 `web/app/about/page.tsx`。

### 验证结果（均通过）
- `pnpm build` Exit code 0；`/about` 路由约 7.3 kB 客户端包。
- 文案 / 布局 / 卡片风格与 Vite 原型一致（NavBar 由 layout 提供，页内不重复挂载）。

### 遗留 / 说明
- **Footer 仍为页内实现**（与 Vite 一致，未抽公共 Footer 组件）。

## 〇之启·三、Next.js NavBar + 基础路由壳（步骤 4A，2026-06-01，web/）

> 对应 Next.js 迁移步骤 4A。本步**只迁移 NavBar + 六条路由占位壳**，不迁入 About/Home 等正式 UI。

### 新增 / 修改文件
- 新增 `web/components/layout/NavBar.tsx`、`site-chrome.tsx`、`page-placeholder.tsx`。
- 新增 `web/app/community|models|about|contact|auth/page.tsx`；改 `web/app/page.tsx`、`web/app/layout.tsx`。
- 新增 `web/public/logo.png`；改 `web/package.json`（`lucide-react`）；删除 `web/components/site-config-smoke.tsx`。

### 验证结果（均通过）
- `web/` 内 `pnpm install` + `pnpm build` Exit code 0（含 `/`、`/community`、`/models`、`/about`、`/contact`、`/auth` 静态路由）。
- `pnpm dev`：`http://localhost:3000/` 及各子路由 HTTP 200；NavBar 跳转正常；`/auth` 无全站 NavBar。

### 遗留 / 说明
- **模型详情动态路由** `/models/[id]` 未建，待 ModelLibrary 迁移时补充。
- **浏览模型入口**：NavBar 无「模型库」主导航项（与 Vite 一致，模型库经首页/社区 CTA 进入）。

## 〇、当前状态速览

- **当前阶段**：**Next.js web/ 步骤 4D（AuthPage 正式页）已完成**（2026-06-01）；`/about`、`/contact`、`/auth` 已迁正式 UI；`/`、`/models` 等仍为占位；Vite 原型 **仍为 UI 验收基准**。
- **已完成页面**：首页 Home、NavBar、ModelCommunity、ModelLibrary（含详情/发布/训练/个人中心）、AboutUs、AuthPage、ContactPage；网络层 `src/lib/` + `AuthContext` + `SiteConfigContext`（均在 Vite `src/`）。
- **Next.js web/**：`AppProviders` + `NavBar` + **`/about`、`/contact`、`/auth` 正式 UI**；`/`、`/models`、`/community` 仍为占位。
- **已接后端（页面层，10H 归档）**：auth · models · categories · likes/favorites · users/me · contact · training-applications · site-config · uploads/model publish（详见「🚩 最终检查点 → 一·续」）。
- **上传发布**：viewerUrl 发布 ✅；R2 文件路径代码保留 ✅；无 R2 时 presign 503 + 固定提示 ✅；真实 PUT 直传 ❌（待 R2 + CORS）。
- **未完成（10H 标注）**：真实 R2 直传、Next.js 迁移、后台前端、线上部署（见「🚩 → 二·补」）。
- **构建状态**：`pnpm build` Exit code 0（Vite 原型，约 1627 模块）；后端 `server/` `pnpm build` 通过。
- **联调环境**：根目录 `pnpm dev`（5173）+ `vite.config.ts` 代理 `/api → localhost:4000` + `deploy/docker-compose.dev.yml` Postgres + `server` API。
- **communityData.ts**：仅 `typeTagColor` + API 失败降级；**非**全站主数据源。
- **技术栈 / 文档**：`docs/backend-architecture-plan.md`、`docs/frontend-acceptance-checklist.md`（10H 已按真实接口更新）、本文件。

## 一、当前已完成页面 / 组件

| 页面 / 组件 | 文件 | 状态 |
|---|---|---|
| 首页 Home | `src/app/App.tsx` | 已完善（功能修复 + 注释） |
| 顶部导航 NavBar | `src/app/NavBar.tsx` | 已完善（注释 + 滚动锁定 + 类型放宽） |
| 联系我们页 ContactPage | `src/app/ContactPage.tsx` | 已完善（规范注释块 + 修复顶部「注册/登录」无效按钮 + 全量中文注释，build 通过） |
| 模型社区入口页 ModelCommunity | `src/app/ModelCommunity.tsx` | 已完善（功能修复 + 注释） |
| 模型社区静态数据 communityData | `src/app/communityData.ts` | 已补中文注释（结构未变） |
| 模型库列表页 ModelLibrary | `src/app/ModelLibrary.tsx` | 已完善（全量中文注释 + 四项功能完善 + 详情页 iframe Viewer 接入，build 通过） |
| 关于我们页 AboutUs | `src/app/AboutUs.tsx` | 已完善（规范注释块 + 两按钮绑定跳转 + 注释 + HeroRightVisual 保留，build 通过） |
| 注册登录页 AuthPage | `src/app/AuthPage.tsx` | 已完善（规范注释块 + 全量中文注释 + 未勾选协议禁止注册 + 占位交互标注，build 通过） |

## 二、已修改文件及具体内容

### 1. `src/app/App.tsx`（首页）
- 顶部新增规范页面注释块（页面名称/用途/主要功能/对应文档）。
- 修复 CTA「联系我们」按钮断链：新增 `onClick={() => setPage("contact")}`。
- VideoModal 补「浏览模型」按钮：普通业务弹窗显示「浏览模型」并调用 `onNavigateModels`；具身智能业务仍显示「申请训练数据服务」，逻辑不变。
- 补各区域中文注释：Hero、业务平台、业务场景、CTA、Footer、VideoModal、场景标题匹配逻辑。
- Footer「首页」由 `<a href="#">` 改为 `<button onClick={() => setPage("home")}>`，与其它导航跳转方式统一。

### 2. `src/app/NavBar.tsx`（顶部导航）
- 顶部新增规范组件注释块。
- 新增移动端菜单滚动锁定：`mobileOpen` 为真时设 `document.body.style.overflow = "hidden"`，关闭/卸载时还原。
- `activePage` 类型由 `"home" | "community" | "about"` 放宽为加上 `"models" | "contact" | "auth"`（仅输入类型加宽，无视觉变化）。
- 补关键交互中文注释。

### 3. `src/app/ContactPage.tsx`（联系我们页）
- 传给 NavBar 的 `activePage` 由 `"home"` 改为 `"contact"`，避免误高亮「首页」。
- 新增一行说明注释，其余未改。

### 4. `src/app/ModelCommunity.tsx`（模型社区入口页）
- 顶部新增规范页面注释块。
- 修复传参 bug：Hero「浏览模型」、Model Gallery「查看全部」由 `onClick={onNavigateModels}` 改为 `onClick={() => onNavigateModels?.()}`。
- 修复 CTA「联系我们」断链：新增 `onClick={onNavigateContact}`。
- 补各区域与常量/组件中文注释。

### 5. `src/app/communityData.ts`（社区静态数据）
- 顶部新增数据文件注释块。
- 为 `communityModels`、`typeTagColor`、`CommunityModel` 补中文注释。
- **未改任何数据、字段、类型结构**。

### 6. `src/app/ModelLibrary.tsx`（模型库列表页）

本页分两个阶段完成。

#### 阶段一：全量中文注释补全（零行为、零视觉变更）
- 顶部新增规范页面注释块（含内嵌子组件对应文档说明）。
- 常量区注释：`MODEL_TYPES / SORT_OPTIONS / SCENE_OPTIONS / ROBOT_TYPES / TRAIN_TASKS / VISIBILITY_OPTIONS / models / ModelItem`。
- 各组件用途、状态、事件、表单字段、关键交互注释：`ModelCard`、`ModelDetailPage`、`UploadModal`、`TrainingModal`、`PersonalCenter`、主组件 `ModelLibrary`。

#### 阶段二：四项功能完善
1. **`initialModelId` 同步**：新增 `useEffect([initialModelId])`，当传入有效且能匹配模型时打开对应详情；为空或无匹配不处理（不覆盖用户在列表内点击/返回形成的 `detailModel`）。仅初始 `useState` 取值无法响应父级后续更新，故补该副作用。
2. **模型数量真实化**：数量展示由写死「128」改为 `共 {filtered.length} 个模型`；未筛选等于总数、筛选后等于结果数。
3. **排序 `activeSort` 生效**：在 `filtered` 基础上新增 `parseViews` 工具与 `sorted` 排序结果，列表渲染由 `filtered.map` 改为 `sorted.map`。规则（基于现有字段稳定模拟）：
   - 最新发布 → `id` 倒序；
   - 热门浏览 → `parseViews(views)` 倒序（解析 "2.1k" 类字符串）；
   - 最多收藏 → `likes` 倒序（点赞近似收藏）；
   - 推荐模型 → 返回 0 保持默认顺序。
   计数、空状态、加载更多条件仍用 `filtered`（长度一致）。
4. **搜索按钮行为**：新增 `useRef` 引用输入框与 `handleSearchClick`，点击「搜索」让输入框失焦（移动端收起键盘），不改实时过滤、不改搜索结果。
5. **加载更多禁用态**：按钮加 `disabled`，文案改为「已加载全部模型」，弱化文字色 + `cursor-not-allowed`、去 hover；样式体系不变。

> 阶段二未改 UI 风格、样式体系、其它文案、数据结构（`communityData.ts` 未动）。

### 7. `src/app/AboutUs.tsx`（关于我们页）

最小安全范围修改，仅动本文件（`App.tsx`、`NavBar.tsx` 未改）。

1. **顶部规范注释块**：新增「页面名称 / 用途 / 主要功能 / 对应文档」标准注释块。
2. **两个「联系我们」按钮绑定跳转**：Hero 区与底部 CTA 区的「联系我们」按钮原本无 `onClick`（无效按钮），现均绑定 `onClick={() => onNavigateContact?.()}`，修复断链；`onNavigateContact` 为可选属性，用可选链调用，未传时安全静默。
3. **全量中文注释**：补 `AboutUsProps` 各导航回调、`capabilities` / `scenarios` 数据来源、`SpaceVisual` 用途、主组件、NavBar 区、Hero 滚动按钮、Footer 导航等关键交互注释。
4. **HeroRightVisual 保留并加说明注释**：标注为「Figma 导出预留的 Hero 右侧插画组件，当前 Hero 为单列布局未启用，请勿删除」，**未删除**。
5. **验证**：`pnpm build` 通过（Exit code 0，`✓ 1610 modules transformed`）；ReadLints 对 `AboutUs.tsx` 无错误。

> 未改任何文案、UI、样式、布局、模块顺序；未改 Footer「请填写」联系方式占位。

### 8. `src/app/AuthPage.tsx`（注册登录页）

最小安全范围修改，仅动本文件（`App.tsx` 未改）。

1. **顶部规范注释块**：新增「页面名称 / 用途 / 主要功能 / 对应文档」，并标注「当前为前端模拟、待接认证接口」。
2. **状态与倒计时副作用注释**：为 `tab` / `showPassword` / `agreed` / `countdown` / `loginSuccess` / `registerSuccess` 及验证码倒计时 `useEffect` 各加中文说明。
3. **表单字段与关键交互注释**：顶部独立导航、Tab 切换、登录/注册成功态、密码可见性切换、获取验证码倒计时、使用目的字段（标注未来 `purpose` 字段）、协议勾选等。
4. **修复未勾选协议仍可注册**：新增 `handleRegister`（`if (!agreed) return;` 二次校验，未勾选不提交）；注册按钮 `onClick` 改为 `handleRegister`，并加 `disabled={!agreed}`，禁用态样式仅用 `disabled:opacity-50 / cursor-not-allowed / hover 还原`，未改原有配色。符合文档第 70 行与验收标准第 4 条。
5. **占位交互标注待接入**：「使用验证码登录」「忘记密码？」「《用户协议》」「《隐私政策》」均加注释说明「视觉占位，待接入后绑定事件」；登录、获取验证码处标注对应接口 `/api/auth/login`、`/api/auth/send-code`。
6. **验证**：`pnpm build` 通过（Exit code 0，`✓ 1610 modules transformed`）；ReadLints 对 `AuthPage.tsx` 无错误。

> 本次未做受控表单与 loading/error 三态（按约定留到后端认证阶段）；未改文案、UI、样式、布局；未改 `App.tsx`。

### 9. `src/app/ContactPage.tsx`（联系我们页）

> 本页此前仅修过 `activePage` 传参，本次做注释完善与无效按钮修复。最小安全范围修改，仅动本文件（`App.tsx`、`NavBar.tsx` 未改）。

1. **顶部规范注释块**：新增「页面名称 / 用途 / 主要功能 / 对应文档」，并标注「表单为前端模拟、待接 `/api/contact/leads`」。
2. **修复顶部「注册/登录」无效按钮**：原函数签名遗漏解构 `onNavigateAuth`，且 `NavBar` 调用未传 `onNavigateContact` / `onNavigateAuth`，导致 NavBar 右侧「注册/登录」「联系我们」按钮 `onClick` 为 `undefined`、点击无反应。本次补解构 `onNavigateAuth`，并给 `NavBar` 传 `onNavigateContact={() => {}}`（已在本页用空函数）与 `onNavigateAuth={onNavigateAuth}`，「注册/登录」恢复可跳 AuthPage。
3. **全量中文注释**：状态（`submitted` / `selectedDataTypes` / `selectedStage` / `selectedScene` / `selectedBudget`）、函数（`toggleDataType` / `scrollToForm`）、常量（`dataTypeOptions` / `stageOptions` / `processSteps` / `serviceDirections` / `serviceItems` / `inputClass`，含未来字段名标注）、各区域（Hero、表单、提交成功态、数据类型多选、项目阶段单选、提交按钮、侧栏、服务流程、服务方向、CTA、Footer）。
4. **联系方式占位标注**：侧栏与 Footer 的「请填写」均加注释「待业务方提供真实信息后统一补全」，未改占位文案。
5. **验证**：`pnpm build` 通过（Exit code 0，`✓ 1610 modules transformed`）；ReadLints 对 `ContactPage.tsx` 无错误。

> 本次未做受控表单与 loading/error 三态（按约定留到后端接入阶段）；未改文案、UI、样式、布局、模块顺序；未改 `App.tsx`、`NavBar.tsx`。

### 10. 前端验收问题修复（3 项）

依据手动验收发现的 3 个问题分别修复，均通过 `pnpm build` 与 ReadLints。

1. **进入页面不回到顶部 → 全站页面切换滚动复位**（`src/app/App.tsx`）
   - 原因：以 `useState` 模拟路由切换页面时，浏览器不重置滚动位置，会停留在上一页滚动高度（如从 Footer/底部 CTA 进入联系我们页停在中间/底部）。
   - 修复：新增 `useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [page])`，覆盖 home/community/models/about/contact/auth 全部切换。
   - 纯前端解决，未改 UI/文案/样式。

2. **个人中心模型卡片不能进详情 → 卡片可点击打开详情**（`src/app/ModelLibrary.tsx`）
   - 原因：`PersonalCenter` 的「我的模型/我的收藏」卡片为纯静态 `<div>`，无点击回调；组件也未接收打开详情的回调。
   - 修复：`PersonalCenter` 新增 `onView` 入参；两类卡片由 `<div>` 改为 `<button onClick={() => onView(m)}>`（沿用相关推荐卡片同款交互样式）；主页面传入 `onView={(m) => { setShowPersonal(false); setDetailModel(m); }}`，先关个人中心再打开详情（`showPersonal` 渲染优先级高于 `detailModel`）。
   - 复用现有 `detailModel` / `ModelDetailPage`；「我的发布/我的申请」为写死占位数据，未接详情。纯前端解决，真实数据待后端 `GET /api/user/*`。

3. **「使用验证码登录」「忘记密码？」无法点击 → 补占位交互**（`src/app/AuthPage.tsx`）
   - 原因：两者为纯占位 `<span>`，无 `onClick`、无对应功能。
   - 修复：
     - 新增 `loginMethod`（password/code）状态，「使用验证码登录」改为 `<button>` 切换登录方式，验证码模式显示验证码输入 + 获取验证码按钮（复用 60s 倒计时，不真正发送）；文案在「使用验证码登录 / 使用密码登录」间切换。
     - 新增 `showForgot` / `forgotSent` 状态与「找回密码」占位弹窗（手机号/邮箱输入 + 发送重置验证码占位提示 + X/遮罩/我知道了关闭），不真正发送验证码、不真正重置密码。
     - 注释标注后续接入 `/api/auth/send-code`、`/api/auth/reset-password`、`/api/auth/login`。
   - 前端仅完成 UI 切换与占位；真实验证码下发、验证码登录、密码重置需后端配合。

> 以上 3 项均保持现有 UI 风格、文案语气，未改数据结构；逐项 `pnpm build` Exit code 0、ReadLints 无错误。

### 11. ModelDetailPage iframe 内嵌外部 Viewer（技术验证）

> 改动文件：`src/app/communityData.ts`、`src/app/ModelLibrary.tsx`（`ModelDetailPage`）；文档：`页面功能注释文档/13_模型数据结构_communityData.md`。`pnpm build` Exit code 0、ReadLints 无错误。

1. **数据字段新增**：`communityData.ts` 将 `CommunityModel` 改为显式 `interface`，新增**可选**字段 `viewerUrl?: string`（对应未来后端模型表 `model_url`）。无在线查看器的模型直接省略该字段。
2. **详情页支持 iframe 内嵌**：`ModelDetailPage` 左侧查看区改为——`model.viewerUrl` 非空时渲染 `<iframe>` 内嵌外部三维 Viewer（含 `title` / `loading="lazy"` / `allow="autoplay; fullscreen; xr-spatial-tracking"` / `allowFullScreen` / `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`）；为空/缺省时**回退到原网格占位 UI**，行为与样式零回归。`viewKey` 仍在外层容器，"重置视角"会重载 iframe；"全屏"按钮对 `#model-viewer-area` 容器生效，iframe 一并全屏。
3. **当前链接仅为技术验证**：示例 `viewerUrl` 使用 Sketchfab 官方公开 demo 模型（id1、id3），**仅用于验证 iframe 内嵌技术可行性，不是正式业务素材**，主题（汽车/鞋）也与模型标题无关。
4. **正式环境替换要求**：上线前必须将测试链接替换为**业务方提供的真实 `viewerUrl`**（数境空间自有/授权的三维模型在线浏览地址）。
5. **数据来源演进**：`viewerUrl` 后续应由后端接口 **`GET /api/models/:id`** 返回（随模型详情下发），不再写死在 `communityData.ts`。
6. **iframe 兜底策略（待实现）**：部分外部 Viewer 可能通过 `X-Frame-Options` / CSP `frame-ancestors` 禁止被 iframe 内嵌，届时页面会空白。后续应增加兜底：检测加载失败或站点禁止内嵌时，改为提供**「在新窗口打开」**（`<a target="_blank" rel="noopener noreferrer">`）链接进入外部 Viewer，避免空白。本次未实现兜底，仅记录待办。

> 本次保持现有 UI 风格、文案、模块顺序；除新增 `viewerUrl` 字段与详情页查看区条件渲染外，未改其它数据结构与业务逻辑。

## 三、pnpm build 结果

所有改动均在对应步骤通过生产构建：
- 命令：`pnpm build`（vite v6.3.5）
- 结果：Exit code 0，`✓ 1610 modules transformed`，无编译错误；ReadLints 无 lint 错误。
- 备注：IDE 中的 `React` UMD 全局、`*.png` 模块声明类提示属预先存在的 TS/IDE 噪音，不影响 `pnpm build`。

## 四、已知未处理问题

### 全站
- Footer 联系方式仍为「电话/邮箱/地址：请填写」占位，待业务方提供真实信息（首页、社区入口页、模型库页一致）。
- VideoModal、模型详情浏览器均为模拟/占位，未接入真实视频与三维查看器。
- 所有数据来自 `communityData.ts` 静态数据，未接后端接口。

### ModelLibrary（功能为前端模拟，待接后端）
- 排序为基于现有字段的模拟排序：「最新发布」用 `id` 倒序（与 `time` 文案不严格一致）、「最多收藏」用 `likes` 近似；接后端后应改用 `created_at / views_count / favorites_count`。
- `parseViews` 仅支持纯数字与「k」后缀，未覆盖「w/万/m」等单位。
- 模型数量基于 `filtered.length`，接后端分页后应改用接口返回的 `total`。
- 「搜索」按钮仅失焦收起键盘，不触发独立查询/埋点。
- 「加载更多」为禁用占位，无真实分页；接后端分页后需恢复可点击逻辑。
- `ModelDetailPage` 的 `isFullscreen` 状态被设置但未被 UI 读取（轻微冗余）。
- 列表卡片封面未使用 `model.pattern`，与社区精选卡片视觉略有差异（属 Figma 导出设计差异，未擅自改）。
- 点赞/收藏/分享为前端视觉态，未持久化、未接接口。
- 详情页 `viewerUrl` 当前为 Sketchfab 测试链接（仅技术验证），正式环境须替换为业务方提供的真实地址，并改由 `GET /api/models/:id` 返回。
- iframe 内嵌**尚无兜底**：若外部 Viewer 通过 `X-Frame-Options` / CSP 禁止内嵌会空白，待补「在新窗口打开」兜底（详见第二节第 11 项第 6 条）。

### AuthPage（功能为前端模拟，待接后端）
- 登录/注册输入框为非受控，提交仅有 success，无 loading / error 三态；接后端时需补受控表单 + 字段校验 + 三态（对应 `/api/auth/login`、`/api/auth/register`、`/api/auth/send-code`）。
- 占位交互：「使用验证码登录」已可切换验证码登录模式、「忘记密码？」已弹出占位弹窗（均为前端占位，不真正发送验证码 / 重置密码，待接 `/api/auth/send-code`、`/api/auth/reset-password`）；「《用户协议》」「《隐私政策》」链接仍为视觉占位，待接入。
- 登录成功文案「正在进入模型库」与实际「返回官网」行为不完全一致，本次按约定未改文案，留作后续观察。
- 登录成功后未真正进入模型库（AuthPage 仅接收 `onNavigateHome`），接后端登录态后再决定跳转目标。

### ContactPage（功能为前端模拟，待接后端）
- 姓名/手机/公司/邮箱/需求描述为非受控输入；提交仅 `setSubmitted(true)`，未收集字段值，无 loading / error 三态；接后端需补受控表单 + 校验 + 三态（对应 `/api/contact/leads`）。
- 侧栏与 Footer 联系方式仍为「请填写」占位，待业务方提供真实电话/邮箱/地址后统一补全。
- 顶部「联系我们」按钮在本页用空函数（已在当前页，无需跳转）。

## 五、下一步建议开发顺序

> 全站 6 个主页面（Home / NavBar / ModelCommunity / ModelLibrary / AboutUs / AuthPage / ContactPage）的注释完善与断链/无效按钮修复阶段已收尾。后续进入数据与接口阶段。

1. ~~AboutUs（关于我们）页检查与注释完善~~ —— 已完成（详见第二节第 7 项）。
2. ~~AuthPage（注册/登录）页检查与注释完善~~ —— 已完成（详见第二节第 8 项）。
3. ~~ContactPage（联系我们）页复查与注释完善~~ —— 已完成（详见第二节第 9 项）。
4. **【下一阶段】Footer 真实联系方式统一补全**：待业务方提供电话/邮箱/地址，统一替换首页、模型社区入口页、模型库页、关于我们页、联系我们页（侧栏 + Footer）的「请填写」占位。
5. **后端接口接入**：认证（登录/注册/验证码）、模型列表/详情、表单提交（联系线索、模型发布、训练申请），替换 `communityData.ts` 静态数据，落实排序/分页/数量真实化。
6. **受控表单与 loading/error 三态统一处理**：AuthPage、ContactPage、模型发布、训练申请等所有表单统一补受控输入 + 字段校验 + loading/success/error 三态（与接口接入配合）。

## 六、已产出文档

### `docs/frontend-acceptance-checklist.md`（全站前端手动验收清单）

- **用途**：用于全站前端手动验收，逐项核对页面功能、跳转、交互、响应式与通用质量。每项含「操作步骤 / 预期结果 / 是否通过 / 备注」，并区分桌面端（💻）、移动端（📱）、两端均验（🔁）。
- **覆盖范围**：
  1. 全局 / 顶部导航 NavBar（Logo 跳转、PC 高亮、移动端菜单与滚动锁定、注册登录 / 联系跳转）。
  2. 首页 Home（Hero CTA、业务平台 / 场景卡片弹窗、Esc/遮罩关闭、弹窗按钮差异、Footer 导航）。
  3. 模型社区入口 ModelCommunity（浏览模型 / 查看全部 / 联系我们跳转）。
  4. 模型库 ModelLibrary（列表 / 筛选 / 排序 / 搜索、模型详情、发布弹窗 / 训练申请 / 个人中心）。
  5. 关于我们 AboutUs（锚点滚动、两个「联系我们」按钮、卡片完整性）。
  6. 注册登录 AuthPage（Tab 切换、密码可见、验证码倒计时、未勾选协议禁止注册、占位交互）。
  7. 联系我们 ContactPage（顶部「注册/登录」修复、提交滚动、数据类型多选 / 项目阶段单选、提交成功态）。
  8. 移动端响应式（375 / 390 / 414 宽度无横向溢出、单列布局、弹窗适配）。
  9. 通用质量检查（跨页无断链、文案无乱码、视觉风格、弹窗关闭、控制台无报错、`pnpm build` 通过）。
- **附带**：已知限制清单（非缺陷，验收不计失败）与验收结论汇总表。
- **维护约定**：页面功能或交互变更后，应同步更新本清单对应条目。

## 七、后续 Agent 必须注意的规则

- 开发前先读：`AGENTS.md` → `.cursor/rules` → `页面功能注释文档/00_文档索引.md` → 当前页面对应 MD → 目标源码。
- 每次只完成一个页面或一个功能模块，不一次性重构全项目。
- 不随意改变 Figma 导出版本的视觉风格、页面结构、中文文案、模块顺序、主按钮含义。
- 修改 UI/文案/行为（如改占位数字、改按钮逻辑）前必须先与用户确认，不擅自变更。
- 不删除已有 UI；不新增无业务依据的模块；模型社区是社区/模型浏览入口，不是公司介绍页。
- 数据服务申请只保留「具身智能机器人训练场景」类型。
- 关键组件、状态、表单字段、接口调用位置必须写中文注释；JSX 子节点用 `{/* */}`，`.map`/函数体内用 `//`。
- 表单提交需具备 loading / success / error 三态；不在前端写死密钥。
- 修改前说明：要读哪些文件、改哪些文件、目的、影响范围；修改后说明：改了什么、如何测试、是否 `pnpm build`、有无报错、下一步建议。
- 每完成一个文件改动执行 `pnpm build` 验证。
