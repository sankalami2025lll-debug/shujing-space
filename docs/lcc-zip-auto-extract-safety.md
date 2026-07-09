# LCC/LCC2 ZIP 自动解包生产安全策略封板

> 文档用途：封板「LCC/LCC2 ZIP 自动解包上限可配置 + 生产安全收口 + `.lcc/.lcc2` 入口链接原生发布」。
> 对应提交：
> - `54c4f9e` `feat: make LCC/LCC2 ZIP auto-extract limit configurable`
> - `ac52985` `feat: harden LCC zip publishing flow`
> 文档性质：验收与运维口径记录，不作为业务代码修改依据。如需变更策略，先更新本文档并经评审。
> 更新日期：2026-07-09

---

## 1. 背景与事故结论

生产服务器规格为 **2C4G**。曾将 `LCC_ZIP_AUTO_EXTRACT_MAX_MB` 调到 `2048` 后，用户上传约 1GB LCC/LCC2 ZIP，server 进入整包下载 + 解压 + 回传 `processed/lcc` 流程，CPU/IO 被打满，导致 SSH 与官网不可用。

临时恢复措施（运维侧，非代码）：

- 生产环境变量已手动降回 `LCC_ZIP_AUTO_EXTRACT_MAX_MB=512`
- 卡住的 `uploadTask` / `model` 已手动改为 `failed`
- 宿主机 nginx 已 disable，1Panel OpenResty 已恢复
- 官网 HTTPS 已恢复 200

正式代码收口目标：防止后续误把自动解包上限调高后再次拖死 2C4G 服务器；同时保证「填写 `.lcc/.lcc2` 入口在线链接」按原生 LCC Viewer 打开，而不是 iframe 外链。

---

## 2. 环境变量口径

| 变量 | 默认值 | 说明 |
|---|---|---|
| `LCC_ZIP_AUTO_EXTRACT_MAX_MB` | **512** | LCC/LCC2 ZIP 成果包自动解包上限（MB） |

落点：

- `server/src/config/env.validation.ts` — Zod 默认 `512`
- `server/src/config/configuration.ts` — `upload.lccZipAutoExtractMaxBytes = MB × 1024 × 1024`
- `server/src/modules/models/lcc-zip.service.ts` — `resolveAutoExtractMaxBytes()` 读取配置；缺失/非法回退默认 `512MB`
- `server/.env.example` / `deploy/.env.prod.example` / `deploy/README.md` — 示例与说明同步为 `512`

运维硬约束：

- **2C4G 生产服务器不建议调高该值。**
- 512MB 以上 LCC/LCC2 成果包请先本地解包并上传整个目录到 OSS，再填写 `.lcc/.lcc2` 入口文件在线链接。
- 修改该变量后必须重启 server 容器/进程才生效。

---

## 3. ZIP 自动解包策略

### 3.1 ≤ 上限（默认 ≤ 512MB）

- 继续走现有自动解包：`headObject` → `downloadObject` → 安全解压 → 上传 `processed/lcc/{modelId}/...` → 回写入口 URL。
- `processingStatus`：处理中 → 成功后 `ready`；失败则 `failed`。
- 不改入口 URL 规则、不恢复 dataPath、不依赖 `meta.lcc / meta.lcc2 / meta.splat`。

### 3.2 > 上限（默认 > 512MB）— 快速失败

超过上限时必须：

- **不下载** ZIP
- **不解压** ZIP
- **不扫描** ZIP 内部文件
- **不上传** `processed/lcc`
- **不进入**长时间 CPU/IO 任务
- **不阻塞** server 主进程（异步 `processLccZip` 内快速 `markFailed`）

实现要点：`LccZipService.processUploadedZip` 先 `headObject` 取 `size`，超限立即抛 `BadRequestException`，其后才可能 `downloadObject`。

错误文案（写入 `model.processingError` / `upload_tasks.last_error_message`）：

```text
大模型 ZIP 已上传成功，但超过自动解包上限（最大 512MB）。请先将成果包解压上传至 OSS，再填写 .lcc/.lcc2 入口文件在线查看链接。
```

（文案中的 `512MB` 随当前配置值变化。）

解压后总大小超限时，使用同类明确指引文案，同样引导用户改用入口链接发布。

---

## 4. `.lcc` / `.lcc2` 入口链接原生发布

### 4.1 规则

当 `modelUrl` / `viewerUrl`（在线查看链接）后缀为 `.lcc` 或 `.lcc2`（剥 `?` / `#` 后取扩展名）时：

| 字段 | 结果 |
|---|---|
| `fileFormat` | `lcc` 或 `lcc2` |
| `viewerType` | **`native`**（强制，不按 iframe 外链） |
| `processingStatus` | **`ready`** |
| `modelUrl` | 保存入口文件 URL |
| ZIP 解包 | **不进入** |
| 下载入口文件到 server | **不下载** |
| meta / dataPath | **不依赖 / 不恢复** |

直传单独 `.lcc` / `.lcc2` 入口文件（非 ZIP）同样：`native` + `ready`，不走 ZIP 解包限制。

### 4.2 代码落点

- `server/src/modules/models/models.service.ts` — `create()` 识别入口后缀并强制 `viewerType=native`、`processingStatus=ready`
- `server/src/modules/upload-tasks/upload-tasks.service.ts` — `publish` 分支对 `.lcc/.lcc2` 在线链接传 `viewerType=native`、`allowIframe=false`

### 4.3 前端分发

- `web/lib/model-viewer-kind.ts` — `isLccModel` / `isLccFormat` 按 `fileFormat` 或 URL 后缀识别为 `lcc` kind
- `web/components/pages/model-detail-page.tsx` — LCC 模型挂载 `/viewer/lcc/[id]` iframe（桌面内嵌 / 手机竖屏 embed）
- 分享页继续 `/models/[id]/view` → `/viewer/lcc/[id]?context=share&readonly=1`（手机另加 `mobile=1`）
- **不得**把 `.lcc/.lcc2` 入口链接当成普通 iframe 外链预览

---

## 5. 前端发布提示文案

发布模型弹窗（Next.js + Vite 原型）提示：

```text
支持 lcc / lcc2 / ply / sog 等；也可在下方仅填写在线查看链接

512MB 以上 LCC/LCC2 成果包请先解包上传至 OSS，再填写 .lcc/.lcc2 入口文件链接；平台会按原生模型浏览器打开，不会作为 iframe 外链。
```

文件：

- `web/components/models/upload-modal.tsx`
- `src/app/ModelLibrary.tsx`（Vite 原型同步）

---

## 6. 红线（本策略未触碰）

- 不改 `LCCRender.load(...)` 入口 URL 模式
- 不恢复目录 `dataPath` 模式
- 不依赖 `meta.lcc` / `meta.lcc2` / `meta.splat`
- 不改 OSS 上传主链路（presign / callback / multipart）
- 不改数据库结构（失败原因复用现有 `processingError` / `lastErrorMessage`）
- 不改 LCC SDK 文件
- 不破坏测量、剖切、点云、标注、拍照、保存启动视图、手机分享 `mobile=1`

---

## 7. 验收清单

- [ ] `LCC_ZIP_AUTO_EXTRACT_MAX_MB` 默认值为 `512`；grep 业务代码/env example 不再把 `2048` 作为该上限默认值。
- [ ] 超过 512MB 的 LCC/LCC2 ZIP 发布后：不下载、不解压、不拖死服务器；`uploadTask`/`model` 快速 `failed`；错误文案含当前上限与入口链接指引。
- [ ] ≤512MB ZIP 仍可自动解包成功。
- [ ] 填写 `.lcc2` 在线链接发布：`fileFormat=lcc2`、`viewerType=native`、`processingStatus=ready`、`modelUrl` 为入口 URL。
- [ ] 填写 `.lcc` 在线链接发布：同上，`fileFormat=lcc`。
- [ ] 详情页打开走 `/viewer/lcc/[id]`，不走 iframe 外链预览。
- [ ] `cd server && pnpm build` / `cd web && pnpm build` 通过。

---

## 8. 相关文档索引

- `docs/lcc-web-sdk-integration.md` — LCC/LCC2 加载与 ZIP 处理历史记录
- `docs/upload-system-final-acceptance.md` — 上传体系总归档
- `docs/backend-architecture-plan.md` — 环境变量表
- `docs/model-viewer-architecture.md` — Viewer 分发与 iframe 架构
- `docs/dev-checkpoint.md` — 阶段检查点补记
