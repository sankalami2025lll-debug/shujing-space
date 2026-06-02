# 数境空间官网 全站前端手动验收清单

> 更新日期：2026-06-01（Next.js 用户侧全站验收文档收口）
> 适用范围：
> - **生产目标前端**：`web/` **Next.js 15** App Router（**主验收对象**，见下「测试环境 B」）。
> - **UI 对照基准**：根目录 `src/` **Vite + React** 原型（Figma 导出版视觉/文案/交互基准，见下「测试环境 A」）。
> 数据状态：**用户侧业务数据已接 NestJS 后端 API**；`communityData.ts` 仅用于类型配色与接口失败时的精选/分类降级。
> 使用方式：在「是否通过」列填写 ✅ / ❌；不通过的在「备注」记录现象。**Next.js 为主勾选**；Vite 用于 UI 对照差异时可选复测。

## 测试环境

### 公共（A/B 共用）

- PostgreSQL：`deploy/docker-compose.dev.yml` 已启动。
- 后端：`server/` API **http://localhost:4000**（前缀 `/api`）。
- 桌面端：Chrome 最新版，窗口宽度 ≥ 1280px。
- 移动端：开发者工具设备模拟（iPhone 12 / 390×844）或真机；重点验证 375 / 390 / 414。

### A — Vite UI 对照基准（可选）

- 前端：项目根目录 `pnpm dev` → **http://localhost:5173**
- 代理：Vite `/api → localhost:4000`
- 环境变量：`VITE_API_BASE_URL=/api`（根目录 `.env.example`）
- 构建：`pnpm build`（项目根目录）

### B — Next.js 用户侧主验收（**必填**）

- 前端：`cd web && pnpm dev` → **http://localhost:3000**（端口占用时 Next 可能使用 3001，以终端为准）
- 代理：Next.js dev rewrites `/api/:path* → http://localhost:4000/api/:path*`
- 环境变量：`NEXT_PUBLIC_API_BASE_URL=/api`（`web/.env.example` / `web/.env.local`）
- 构建：`cd web && pnpm build`
- **说明**：localStorage token 键名与 Vite 相同（`sj_token`），两端口勿混测同一浏览器会话时可清 token 后重测。

### Next.js 路由与清单章节对照

| 清单章节 | Vite 源码 | Next.js 路由 / 组件 |
|----------|-----------|---------------------|
| 一 NavBar | `src/app/NavBar.tsx` | `web/components/layout/NavBar.tsx`（全站除 `/auth`） |
| 二 Home | `src/app/App.tsx` | `/` → `home-page.tsx` |
| 三 ModelCommunity | `ModelCommunity.tsx` | `/community` |
| 四 ModelLibrary | `ModelLibrary.tsx` | `/models`、`/models/[id]`、`/models/me`；`UploadModal` / `TrainingModal` |
| 五 AboutUs | `AboutUs.tsx` | `/about` |
| 六 AuthPage | `AuthPage.tsx` | `/auth` |
| 七 ContactPage | `ContactPage.tsx` | `/contact` |

## 图例

- 设备列：💻 桌面端　📱 移动端　🔁 两端均需验证
- 验收类型：**UI**＝纯界面/路由/交互（与是否接 API 无关）　**🔌**＝须后端在线，走真实接口（失败时应 toast/错误态，非静默假成功）
- 「是否通过」：✅ 通过 / ❌ 不通过 / ➖ 不适用

### 前端已接入后端模块（Vite `src/` + Next.js `web/`）

| 模块 | 主要接口 | 涉及页面/组件 |
|------|----------|----------------|
| auth | `/api/auth/*` | AuthPage、NavBar、AuthProvider |
| models | `GET/POST /api/models`、`GET /api/models/:id` | ModelLibrary、ModelCommunity、UploadModal |
| categories | `GET /api/categories` | ModelLibrary 筛选 |
| likes / favorites | `POST|DELETE /api/models/:id/like|favorite` | 列表卡片、ModelDetailPage |
| users/me | `GET /api/users/me/*` | PersonalCenter（`/models/me`） |
| contact | `GET /api/contact/options`、`POST /api/contact/leads` | ContactPage |
| training-applications | `POST /api/training-applications` | TrainingModal |
| site-config | `GET /api/site-config` | 全站 Footer、ContactPage 侧栏 |
| uploads + publish | `POST /api/uploads/presign|callback` + PUT R2 + `POST /api/models` | UploadModal |

### 上传发布验收说明

| 能力 | 当前状态 | 对应验收项 |
|------|----------|------------|
| **viewerUrl 外链发布** | ✅ **可验收**（Vite + Next.js）：填 `https://` 链接 → `viewerType=iframe` → `POST /api/models` → 列表可见 | **L19** |
| **R2 文件直传（选模型/封面文件）** | ❌ **待真实 R2 凭证 + 桶 CORS** 后验收；无凭证时 presign **503** 为预期 | **L21**（标 ➖） |
| **无 R2 时选文件** | ✅ **可验收**：应 toast「R2 对象存储未配置，请先配置对象存储」，不伪造成功 | **L20** |

---

## 一、全局 / 顶部导航 NavBar

> Vite：`src/app/NavBar.tsx`　Next.js：`web/components/layout/NavBar.tsx`（`/auth` 不挂载）
> **🔌** G6a/G6b：依赖 `GET /api/auth/me` 自举与 `POST /api/auth/logout`。

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| G1 | UI | 🔁 | 任意页面点击左上角 Logo / “数境空间” | 返回首页 Home | | |
| G2 | UI | 💻 | 观察当前所在页面对应的主导航项 | 当前页冰蓝下划线高亮，其余灰色 | | |
| G3 | UI | 💻 | 在联系我们页 / 模型库页观察主导航高亮 | 三项主导航均不高亮 | | |
| G4 | UI | 💻 | 点击主导航“模型社区” | 进入模型社区入口页 | | |
| G5 | UI | 💻 | 点击主导航“关于我们” | 进入关于我们页 | | |
| G6a | 🔌 | 💻 | **未登录**时点击右上角“注册 / 登录” | 进入 AuthPage | | |
| G6b | 🔌 | 💻 | **已登录**时观察右上角 | 显示用户昵称；点击「退出登录」调用 logout、清 token、回首页并 toast | | |
| G7 | UI | 💻 | 点击右上角“联系我们” | 进入联系我们页（在联系页本身点击无跳转，属预期） | | |
| G8 | UI | 📱 | 点击右上角菜单图标 | 展开菜单，背景滚动锁定 | | |
| G9 | UI | 📱 | 展开菜单后点击任一导航项 | 跳转并收起菜单，滚动恢复 | | |
| G10 | UI | 📱 | 菜单内“注册/登录”“联系我们” | 分别跳转 AuthPage / 联系页并收起 | | |
| G11 | UI | 📱 | 再次点击关闭图标(X) | 菜单收起，滚动恢复 | | |

---

## 二、首页 Home（`src/app/App.tsx`）

> **UI 为主**；Footer 联系方式为 **🔌** `GET /api/site-config`（失败回退默认「请填写」）。

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| H1 | UI | 🔁 | 打开首页观察 Hero 首屏 | 标题与背景正常，文字不被遮挡 | | |
| H2 | UI | 🔁 | 点击 Hero “进入模型社区” | 跳转模型社区 | | |
| H3 | UI | 🔁 | 点击 Hero “了解我们” | 跳转关于我们 | | |
| H4 | UI | 🔁 | 点击“业务平台”任意卡片 | 打开 VideoModal | | |
| H5 | UI | 🔁 | 弹窗内播放/暂停 | 进度与文案切换（模拟视频，非 API） | | |
| H6 | UI | 🔁 | 具身智能卡片弹窗底部按钮 | “申请训练数据服务”→ 联系页并关弹窗 | | |
| H7 | UI | 🔁 | 其它业务卡片弹窗底部按钮 | “浏览模型”→ 模型库并关弹窗 | | |
| H8 | UI | 🔁 | 弹窗按 Esc | 弹窗关闭 | | |
| H9 | UI | 🔁 | 点击遮罩 / 内容区 | 遮罩关闭；点内容不关闭 | | |
| H10 | UI | 🔁 | 点击“业务场景”任意卡片 | 打开对应场景 VideoModal | | |
| H11 | UI | 🔁 | 底部 CTA “联系我们” | 跳转联系页 | | |
| H12 | UI | 🔁 | Footer 导航 | 首页/社区/关于跳转正常 | | |
| H13 | UI | 📱 | 移动端整页 | 无横向溢出 | | |
| H14 | 🔌 | 🔁 | 观察 Footer 电话/邮箱/备案等 | 来自 `site-config`（dev 库可为占位或 admin 改写值） | | |

---

## 三、模型社区入口页 ModelCommunity（`src/app/ModelCommunity.tsx`）

> 精选模型：**🔌** `GET /api/models?page=1&pageSize=6&sort=recommended`（失败回退本地静态前 6 条）。

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| C1 | UI | 🔁 | 进入模型社区页 | “模型社区”高亮；为浏览入口非公司介绍长文 | | |
| C2 | UI | 🔁 | Hero “浏览模型” | 跳转模型库 | | |
| C3 | UI | 🔁 | “查看全部” | 跳转模型库 | | |
| C4 | UI | 🔁 | CTA “联系我们” | 跳转联系页 | | |
| C5 | 🔌 | 🔁 | 浏览精选模型卡片 | 数据来自后端（或降级静态）；点击携带 id 进模型库详情 | | |
| C6 | UI | 📱 | 移动端整页 | 无横向溢出 | | |

---

## 四、模型库列表页 ModelLibrary（`src/app/ModelLibrary.tsx`）

### 4.1 列表 / 筛选 / 排序 / 搜索（🔌 `categories` + `models`）

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| L1 | 🔌 | 🔁 | 进入模型库 | 显示卡片网格；“共 N 个模型”N=`GET /models` 的 total | | |
| L2 | 🔌 | 🔁 | 切换类型分类 | 列表按 `type` 过滤，N 更新；分类来自 `GET /categories`（失败用静态） | | |
| L3 | 🔌 | 🔁 | 搜索框输入关键词 | 点击搜索后按 `keyword` 请求过滤 | | |
| L4 | 🔌 | 🔁 | 点击“搜索” | 失焦；结果与 keyword 一致 | | |
| L5 | 🔌 | 🔁 | 切换四种排序 | 顺序随 `sort` 变化（recommended 当前等同 latest，属已知） | | |
| L6 | 🔌 | 🔁 | 无匹配关键词 | 空状态，不白屏 | | |
| L7 | 🔌 | 🔁 | “加载更多” | 有下一页时可点击追加；全部加载后禁用并提示已加载全部 | | |

### 4.2 模型详情 ModelDetailPage（🔌 `GET /models/:id` + 互动写接口）

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| L8 | 🔌 | 🔁 | 点击模型卡片 | 进入详情，字段来自后端 | | |
| L8a | 🔌 | 🔁 | 有 `viewerUrl` 的模型 | iframe 内嵌 Viewer（Sketchfab 等为技术验证素材） | | |
| L8b | 🔌 | 🔁 | 无 `viewerUrl` 的模型 | 网格占位 UI，不报错 | | |
| L8c | UI | 🔁 | iframe 详情全屏/重置 | 全屏含 iframe；重置重新加载 | | |
| L9 | 🔌 | 🔁 | 从社区带 id 进入 | 直接打开对应详情 | | |
| L10 | UI | 🔁 | 详情「返回社区」 | 回 `/models`；**Vite** 单页内可保留筛选状态；**Next.js** 独立路由返回可能重置筛选（已知架构差异，不计失败 unless 产品要求保留） | | |
| L11a | 🔌 | 🔁 | **已登录**点赞/收藏 | 调用写接口；刷新后状态保持；计数更新 | | |
| L11b | 🔌 | 🔁 | **未登录**点赞/收藏 | toast 提示登录并引导 AuthPage | | |
| L11c | UI | 🔁 | 分享 | 复制链接/Web Share（无后端） | | |
| L12 | 🔌 | 🔁 | 非法/不存在 id | “模型不存在/返回列表”，不白屏 | | |

### 4.3 发布 UploadModal / 训练 TrainingModal / 个人中心 PersonalCenter

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| L13 | UI | 🔁 | 点击发布入口（须先登录） | `/models` 顶栏「发布模型」或 `/models/me`「我的模型」虚线卡（Next 8C）打开发布弹窗 | | |
| L14 | UI | 🔁 | 发布弹窗关闭方式 | Esc/遮罩/关闭按钮正常 | | |
| L15a | 🔌 | 🔁 | 训练申请弹窗内容与提交 | 仅机器人训练场景；`POST /training-applications` 成功态；失败 toast | | |
| L15b | 🔌 | 🔁 | 登录后提交训练申请 | 「我的申请」可见该条（游客提交不进本人列表） | | |
| L16 | 🔌 | 🔁 | 个人中心四 Tab | 数据来自 `users/me/*` + `me/stats` 角标 | | |
| L17 | 🔌 | 🔁 | 我的模型/收藏卡片点击 | 进入对应详情；下架收藏灰显不可点 | | |
| L18 | UI | 📱 | 各弹窗移动端 | 可滚动、可关闭、无横向溢出 | | |
| L19 | 🔌 | 🔁 | **viewerUrl 发布**（不选文件） | 填 https 查看链接 + 必填项 → `POST /api/models` 成功 → `/models` 列表可见（**当前环境可完整验收**） | | |
| L20 | 🔌 | 🔁 | **选模型/封面文件**（无 R2 时） | presign **503**，提示「R2 对象存储未配置…」，不伪造成功（**当前环境可验收负向路径**） | | |
| L21 | 🔌 | ➖ | **R2 文件直传发布**（须真实凭证+CORS） | presign 200 → PUT → callback → 带 fileId 发布成功 | ➖ | **待 R2 配置后验收，不计入当前 Next 用户侧收口** |

---

## 五、关于我们页 AboutUs（`src/app/AboutUs.tsx`）

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| A1 | UI | 🔁 | 进入关于我们 | 结构完整，“关于我们”高亮 | | |
| A2 | UI | 🔁 | “了解核心能力” | 平滑滚动到核心区 | | |
| A3 | UI | 🔁 | Hero/CTA “联系我们” | 跳转联系页 | | |
| A4 | UI | 🔁 | 核对卡片内容 | 6+6 项完整 | | |
| A5 | UI | 🔁 | Footer 导航 | 跳转正常 | | |
| A6 | UI | 📱 | 移动端 | 无横向溢出 | | |
| A7 | 🔌 | 🔁 | Footer 联系方式 | 来自 `site-config` | | |

---

## 六、注册登录页 AuthPage（`src/app/AuthPage.tsx`）

> 全节 **🔌** `/api/auth/*`（开发环境发码成功 toast 可显示 `devCode`）。

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| U1 | UI | 🔁 | 进入页 | 独立顶部；默认“登录”Tab | | |
| U2 | UI | 🔁 | Logo / 返回官网 | 回首页 | | |
| U3 | UI | 🔁 | 登录/注册 Tab 切换 | 表单切换 | | |
| U4 | UI | 🔁 | 密码眼睛图标 | 明文/密文切换 | | |
| U5 | 🔌 | 🔁 | 密码登录成功 | `POST /login` → token → 跳模型库；NavBar 显示昵称 | | |
| U6 | 🔌 | 🔁 | 注册发验证码 | `POST /send-code` 成功后才 60s 倒计时 | | |
| U7 | 🔌 | 🔁 | 未勾选协议 | “注册”禁用 | | |
| U8 | 🔌 | 🔁 | 勾选后注册 | `POST /register` 成功 → 跳模型库 | | |
| U9 | UI | 🔁 | 注册成功态“返回官网” | 回首页（若仍显示成功态属 UI 保留） | | |
| U10 | 🔌 | 🔁 | 验证码登录切换 | `loginType=code` + send-code(scene=login) + login | | |
| U11 | 🔌 | 🔁 | 忘记密码 | send-code(reset) + reset-password；成功后可用新密码登录 | | |
| U12 | UI | 🔁 | 用户协议/隐私政策链接 | 仍为占位（已知限制） | | |
| U13 | UI | 📱 | 移动端 | 表单单列无溢出 | | |

---

## 七、联系我们页 ContactPage（`src/app/ContactPage.tsx`）

> **🔌** `GET /contact/options` + `POST /contact/leads`；侧栏/Footer **🔌** `site-config`。

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| T1 | UI | 🔁 | 进入联系页 | 各区块完整 | | |
| T2 | UI | 💻 | 右上角“注册/登录” | 跳转 AuthPage | | |
| T3 | UI | 📱 | 移动菜单“注册/登录” | 跳转 AuthPage | | |
| T4 | UI | 🔁 | “提交需求”滚动 | 滚到表单区 | | |
| T5 | UI | 🔁 | “查看模型库” | 跳转模型库 | | |
| T6 | 🔌 | 🔁 | 数据类型多选 | 选项来自 options（失败用本地默认） | | |
| T7 | 🔌 | 🔁 | 项目阶段单选 | 同上 | | |
| T8 | 🔌 | 🔁 | 业务场景/预算下拉 | 同上 | | |
| T9 | 🔌 | 🔁 | 填写各字段 | 受控输入；必填校验 | | |
| T10 | 🔌 | 🔁 | 提交需求 | `POST /contact/leads` loading → 成功态；失败 toast | | |
| T11 | UI | 🔁 | 成功态“返回表单” | 回到表单 | | |
| T12 | UI | 🔁 | Footer 导航 | 跳转正常 | | |
| T13 | UI | 📱 | 移动端 | 表单不溢出 | | |

---

## 八、跨页 / 响应式 / 通用质量

| # | 类型 | 设备 | 操作步骤 | 预期结果 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
| X1 | UI+🔌 | 🔁 | 全站页面跳转 | 无断链/白屏；后端离线时 🔌 项应有错误提示 | | |
| X1b | UI | 🔁 | 跳转后滚动位置 | 新页在顶部 | | |
| X2 | UI | 📱 | 移动端各页 | 无严重横向溢出 | | |
| X3 | UI | 🔁 | 文案 | 无乱码；dev 库 address「请填写」可为占位 | | |
| X4 | UI | 🔁 | 视觉风格 | 黑灰白 + 少量冰蓝 | | |
| X5 | UI | 🔁 | 弹窗 | 开闭/Esc/遮罩正常 | | |
| X6 | UI | 💻 | 控制台 | 无明显运行时错误 | | |
| X7 | UI | 🔁 | 构建 | 根目录 `pnpm build`（Vite）与 `cd web && pnpm build`（Next.js）均 Exit code 0 | | |
| X8 | 🔌 | 💻 | 刷新页面保持登录 | 有 token 时 `GET /auth/me` 恢复，NavBar 仍显示昵称 | | |
| X9 | 🔌 | 💻 | 后端停止时打开模型库 | 列表错误 toast/提示，不显示假数据为“成功” | | |

---

## 九、已知限制（非缺陷，验收时不计为失败）

### 仍属 UI / 产品占位（未接 API 或故意保留）

- 首页 **VideoModal** 为模拟进度，未接真实视频 URL API。
- **用户协议 / 隐私政策** 链接为占位。
- 模型详情 **分享** 为浏览器剪贴板/Web Share，无后端短链。
- **iframe 无兜底**：外部 Viewer 禁止内嵌时可能空白，二期补「新窗口打开」。
- 发布成功文案写「审核通过后展示」，与 `visibility=public` 立即可见列表存在文案口径差（UI 未改）。
- `recommended` 排序当前与 `latest` 等同；精选区可能含 dev 冒烟模型（id≥11）。
- `communityData.ts` 仅在 **接口失败** 时降级精选/分类，非主数据源。
- `SiteConfigProvider` 仅在挂载时拉一次配置，后台改值后需刷新页面才更新 Footer（无 admin 前台）。
- **Vite** 个人中心「发布新模型」虚线卡仍为视觉占位；**Next.js**（8C）已接线打开 UploadModal（「我的模型」有数据时显示虚线卡）。
- **Next.js**「我的模型」为空时无虚线卡，首发布走 `/models` 顶栏（与 Vite 一致）。
- 开发验证码：后端返回 `devCode`，前端 toast 展示，**非生产短信**。

### 未完成项（➖ 或单独计划，不计当前 Next 用户侧验收失败）

| 项 | 说明 |
|----|------|
| **真实 R2 文件直传** | 需 R2 凭证 + 桶 CORS；验收项 **L21**；代码路径已保留 |
| **后台 Admin 前端** | `/api/admin/*` 无 UI；审核/用户/分类/线索/申请/站点维护 |
| **真实线上部署** | 生产 Docker、Cloudflare、域名、生产短信与 R2；Next 生产环境 `/api` 须反向代理（dev rewrites 仅开发态） |

### 已完成（不再列为迁移阻塞）

| 项 | 说明 |
|----|------|
| **Next.js 用户侧页面迁移** | `web/` 步骤 0–8C 已完成（见 `dev-checkpoint.md`「一·续三」） |
| **viewerUrl 发布** | Vite + Next.js 均可验收（**L19**） |

---

## 十、验收结论

| 项目 | 结果 |
|---|---|
| 验收人 | |
| 验收日期 | |
| 联调环境（4000+DB）已就绪 | ✅ / ❌ |
| **Next.js** 联调（**3000**+4000+DB）已就绪 | ✅ / ❌ |
| Vite 对照（5173+4000，可选） | ✅ / ❌ / ➖ |
| UI 项（无 🔌）桌面端 — **Next 主验** | ✅ / ❌ |
| UI 项移动端 — **Next 主验** | ✅ / ❌ |
| 🔌 真实接口项（auth/models/表单等）— **Next 主验** | ✅ / ❌ / 有条件通过 |
| viewerUrl 发布（L19）— **可验收** | ✅ / ❌ / ➖ |
| R2 503 负向提示（L20） | ✅ / ❌ / ➖ |
| R2 文件直传（L21）— **待 R2 凭证** | ✅ / ❌ / ➖ |
| `cd web && pnpm build` | ✅ / ❌ |
| 根目录 Vite `pnpm build`（可选对照） | ✅ / ❌ / ➖ |
| 阻塞性问题数量 | |
| 总体结论 | 通过 / 有条件通过 / 不通过 |

> **有条件通过** 典型口径：Next 用户侧全站 🔌 项通过 + L19/L20 通过 + L21 标 ➖（R2 未配置）+ Admin/部署未做。
