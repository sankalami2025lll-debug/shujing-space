# 上传体系 3A 至 3B-3C 总归档 / 最终验收

## 一、阶段总览

- **3A：上传任务持久化**  
  完成上传任务持久化落库与页面恢复基础能力，前端任务卡可读取服务端任务状态，为刷新后恢复、失败态重试和后续 multipart 续传打底。
- **3B-1：后端 multipart 表和 API**  
  完成 multipart session/part 快照相关表结构与 API，覆盖初始化、查询 session、分片 presign、part complete、multipart complete、verify、cancel/interrupt 等服务端能力。
- **3B-2：前端 multipart runner**  
  完成前端 multipart runner，`model` 文件默认走 multipart；浏览器端按 part 切片直传 OSS，采用 `fetch` + 60 秒超时，当前并发固定为 1；已通过小模型与大模型主链路、取消 abort、part 失败不 publish 的真实验收。
- **3B-3A：恢复卡片 + 重新选择文件 + fingerprint 校验**  
  完成恢复卡片展示与“继续上传”入口；刷新后任务卡可恢复，但必须由用户重新选择原文件；对同名同大小文件执行 fingerprint 校验，错误文件拒绝，正确文件进入 `resume_ready`。
- **3B-3B：missing parts 续传 + complete + publish**  
  完成真正的断点续传：仅补传 `missingParts`，不重复上传 `uploadedParts`；当 `missingParts=[]` 时可直接 `complete`；`complete` 后绑定 `modelFileId`，再调用 `publish` 创建模型，成功后任务卡按 `createdModelId` 去重隐藏。
- **3B-3C：异常全量回归 / 清理策略**  
  完成异常边界验收与最小修复，确认再次刷新/多次中断、publish 失败重试、列表刷新失败、重复点击拦截、session/uploadId 失效、错误文件拒绝、`canceled` 禁止恢复等行为；同时归档孤儿 multipart 清理策略，但未实现定时任务。
- **当前整体状态**  
  上传体系 3A 至 3B-3C 已阶段性封板。
- **当前上线修复（2026-06-14）**  
  本阶段完成三项稳定性与用户体验修复：  
  ① **publish 接口异步化**：LCC/LCC2 ZIP 解压处理从 publish HTTP 请求中拆出，改为后台异步执行，不再因处理耗时导致请求超时。  
  ② **重复卡片修复**：个人中心上传任务区只显示 `createdModelId == null` 的任务，已生成 Model 的任务不再与 Model 卡片重复展示。  
  ③ **失败模型可删除**：解析失败的模型卡片增加"删除"按钮，复用已有 `DELETE /api/users/me/models/:id` 软删除接口。

## 二、最终上传能力

- `model` 文件默认全部走 multipart。
- `cover` 仍走旧 `presign -> PUT -> callback` 链路，不参与 multipart。
- multipart 并发暂定 1，以稳定性优先。
- part PUT 使用 `fetch` + 60s timeout。
- 上传任务已持久化，刷新后任务卡可恢复。
- 恢复时必须由用户重新选择同一原文件，再进行 fingerprint 校验。
- 恢复上传只续传 `missingParts`，`uploadedParts` 不重复上传。
- 当 `missingParts=[]` 时可直接 `complete`。
- `complete` 成功后绑定 `modelFileId`。
- `publish` 成功后创建模型，并在个人中心按去重规则隐藏对应任务卡。

## 三、最终验收证据

- **3B-2 最终证据**  
  `tmp-browser-fixtures/results/postfix-acceptance-1780908337322.json`
- **3B-3A 最终证据**  
  `tmp-browser-fixtures/results/resume-ready-1780911174900.json`
- **3B-3B 最终证据**  
  `tmp-browser-fixtures/results/resume-missing-parts-1780914415706.json`
- **3B-3C 最终证据**  
  `tmp-browser-fixtures/results/resume-exception-regression-1780916462570.json`

## 四、关键验收结论

- 小模型 multipart 通过。
- 大模型 multipart 通过。
- 取消 abort 通过。
- part 失败不 publish 通过。
- `interrupted` / `failed` 可继续上传。
- `canceled` 不可继续上传。
- 错误文件拒绝。
- 正确文件进入 `resume_ready`。
- 中断后只补传 `missingParts`。
- `missingParts=[]` 直接 `complete`。
- `failed` 后可继续。
- `publish` 后任务卡去重隐藏。
- 再次刷新 / 多次中断通过。
- `publish` 失败可重试。
- 列表刷新失败后刷新可去重。
- 重复点击已拦截。
- session / `uploadId` 失效有明确失败态。
- 旧 model `/uploads/presign` 未触发。
- `cover` 旧链路未受影响。

## 五、架构边界

- 不做服务端代传，仍为浏览器直传 OSS。
- 不做自动拿回浏览器 `File`，刷新后必须用户重新选择原文件。
- 不做 `cover` multipart。
- 不做跨设备自动继续。
- 不做 WebWorker。
- 不做 IndexedDB 文件持久化。
- 不做并发提升，当前 multipart 并发固定为 1。
- 3B-4 再考虑多标签页锁和后端 lease。
- 孤儿 multipart 定时清理策略已记录，但本阶段未实现定时任务。

## 六、后续待办

1. **3B-4：多标签页同时恢复锁**
   - BroadcastChannel / localStorage lock
   - 后端 session owner / lease
   - 防止两个标签页同时恢复同一任务
2. **运维增强：孤儿 multipart 清理任务**
   - 清理 aborted session
   - 清理长期 `failed` / `interrupted` 未恢复 session
   - 调用 OSS AbortMultipartUpload
   - DB 标记 `expired` / `aborted`
   - 不影响已发布文件
3. **性能增强**
   - 稳定后评估并发从 1 提升到 2
   - 不在当前阶段做

## 七、运行和验收注意事项

- 3010 是本地前端验收口径。
- 4000 是本地后端口径。
- 如 Next dev 出现 `_next` 静态资源 404，先重启 3010。
- OSS 浏览器直传验收时注意代理 / CORS 口径。
- `web build` 必须通过。
- `server` 未改时无需重复 `server build`。

## 八、当前保留文件

- `docs/dev-checkpoint.md`
- `docs/upload-system-final-acceptance.md`
- `docs/lcc-zip-auto-extract-safety.md`（ZIP 自动解包生产安全封板）
- `tmp-browser-fixtures/results/postfix-acceptance-1780908337322.json`
- `tmp-browser-fixtures/results/resume-ready-1780911174900.json`
- `tmp-browser-fixtures/results/resume-missing-parts-1780914415706.json`
- `tmp-browser-fixtures/results/resume-exception-regression-1780916462570.json`
- `tmp-browser-fixtures/verify-3b3b-resume-missing-parts.cjs`
- `tmp-browser-fixtures/verify-3b3c-exception-regression.cjs`

## 九、LCC/LCC2 ZIP 自动解包生产安全收口（2026-07-08 / 2026-07-09）

> 详细封板见 `docs/lcc-zip-auto-extract-safety.md`。本节只记与上传/发布相关的口径变更。

### 9.1 事故与收口

- 2C4G 生产曾将 `LCC_ZIP_AUTO_EXTRACT_MAX_MB` 调到 `2048`，约 1GB ZIP 自动解包打满 CPU/IO，导致 SSH/官网不可用。
- 正式代码默认值已收口为 **`512`**；超过上限 **快速失败**（`headObject` 后即失败，不下载、不解压、不上传 `processed/lcc`）。
- 对应提交：`54c4f9e`（可配置上限）、`ac52985`（生产安全收口 + 入口链接原生发布）。

### 9.2 发布路径口径

| 发布方式 | 行为 |
|---|---|
| ≤512MB LCC/LCC2 ZIP | 继续自动解包 → `processed/lcc/...` 入口 URL → `ready` |
| >512MB LCC/LCC2 ZIP | ZIP 可上传成功，但解析快速 `failed`，提示改用入口链接 |
| 直传单独 `.lcc` / `.lcc2` | 不走 ZIP 解包；`viewerType=native`、`processingStatus=ready` |
| 仅填 `.lcc` / `.lcc2` 在线入口链接 | `fileFormat=lcc/lcc2`、`viewerType=native`、`processingStatus=ready`；**不按 iframe 外链** |
| 其它 https 外链 | 仍按 iframe 外链（域名白名单校验） |

### 9.3 前端提示

发布弹窗文案已明确：512MB 以上成果包请先解包上传 OSS，再填写 `.lcc/.lcc2` 入口链接；平台按原生模型浏览器打开。

### 9.4 未改边界

- 未改 OSS presign / callback / multipart 主链路。
- 未改数据库结构。
- 未改 `LCCRender.load` / dataPath / meta 依赖。

## 结论

- 上传体系 3A 至 3B-3C 的实现、真实浏览器验收证据、阶段边界与后续事项均已归档。
- 当前版本可作为上传体系阶段性总封板基线。
- LCC/LCC2 ZIP 自动解包生产安全策略已单独封板于 `docs/lcc-zip-auto-extract-safety.md`，与本上传体系总归档交叉引用。
