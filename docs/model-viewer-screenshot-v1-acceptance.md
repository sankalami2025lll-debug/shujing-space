# 模型浏览器拍照 / 当前视角截图 V1 验收与封板记录

> 文档用途：封板「模型浏览器工具面板拍照 / 当前视角截图 V1」。记录功能定位、完成范围、技术实现、红线、验收清单与构建记录。
> 文档性质：验收与封板记录，不作为业务代码修改依据。如需变更功能，先更新本文档并经评审。

---

## 1. 功能定位

- 模型浏览器当前视角截图 / 拍照。
- 所有查看者可用（非 owner-only）。
- readonly 分享页可用。
- V1 桌面优先，手机端暂未接入口（`MobileLccViewerChrome` 未新增拍照入口）。
- 仅本地保存，不上传服务器、不写数据库、不存 OSS。

---

## 2. 完成范围

- 工具栏「拍照」按钮接真实功能（不再为永久禁用占位）。
- 点击后弹出「保存当前视角图片」对话框。
- 支持自定义文件名。
- 自动清理非法字符（`\ / : * ? " < > |`）。
- 自动补 `.png` 后缀；空文件名回退默认名。
- 默认文件名：`shujing-model-{modelId}-{yyyyMMdd-HHmmss}.png`。
- 截图只导出 WebGL canvas 当前画面。
- 不包含工具栏、顶部导航、右侧栏、标注标题 / 内容框、编辑器、帮助面板等任何 DOM UI。
- 不上传服务器、不写数据库、不存 OSS。
- 默认 PNG 格式。
- Chrome / Edge 使用 `showSaveFilePicker`，可选择保存位置。
- 不支持 `showSaveFilePicker` 的浏览器降级为 `a.download`。
- 用户取消保存位置选择时不报错（toast 提示「已取消保存」）。

---

## 3. 技术实现

### 3.1 Viewer Handle 扩展

`ModelViewerHandle` 新增可选方法：

```ts
captureScreenshot?: (options?: {
  mimeType?: "image/png" | "image/jpeg";
  quality?: number;
  clean?: boolean;
}) => Promise<Blob | null>;
```

- 不改变已有 `applyView` / `getCurrentView` / `flyToView` / `resetView` 等方法。
- `LCC_VIEWER_CAPABILITIES.screenshot` 开启为 `true`。

### 3.2 LccViewer captureScreenshot 实现

- `lccRender.update()` 同步一次。
- `renderer.render(scene, camera)` 强制渲染当前帧。
- `canvas.toBlob()` 导出 Blob。
- 返回 `Blob` / `null`（失败时记录日志）。
- `preserveDrawingBuffer: true` 已在 renderer 创建时开启，`toBlob` 可稳定获取当前画面。
- `clean` 选项为语义占位：因只读取 WebGL canvas，DOM overlay 天然不会被截入。
- 不改变相机视角、不改变纯净模式状态、不销毁 viewer、不重建 LCC Viewer。

### 3.3 Toolbar 接入

- `web/components/models/model-viewer-toolbar.tsx` 复用已声明的 `onTakeScreenshot` prop（未重复新增 `onCaptureScreenshot`，避免双语义）。
- `canUseScreenshot = capabilities.screenshot && typeof onTakeScreenshot === "function"`。
- 按钮文案「拍照」，所有用户可见，不放在 owner-only 区。

### 3.4 保存对话框

- 新增 `web/components/models/model-screenshot-dialog.tsx`。
- 黑灰极简风格，与标注编辑器 / 帮助面板一致，不使用大面积蓝色。
- Esc / 点击遮罩 / 取消按钮关闭；保存中禁用关闭与按钮并显示 loading。

### 3.5 保存流程

- `/viewer/lcc/[id]/page.tsx` 接入：
  - `handleOpenScreenshotDialog`：生成默认文件名并打开对话框。
  - `sanitizeScreenshotFileName`：清理非法字符 + 补 `.png`。
  - `saveScreenshotBlob`：优先 `showSaveFilePicker`，降级 `a.download`。
  - `handleConfirmScreenshot`：调用 `viewerHandle.captureScreenshot` → 保存 → toast。
- 用户取消（`AbortError`）静默提示，不报错。

---

## 4. 红线

- 不使用 `html2canvas` 截整个页面。
- 不截图 DOM overlay（工具栏 / 顶部导航 / 右侧栏 / 标注 / 编辑器 / 帮助面板）。
- 不修改 `LCCRender.load(...)`。
- 不修改 `entryUrl` / `dataPath` 规则。
- 不改后端 / 数据库 / OSS。
- 不上传截图到 OSS。
- 不写数据库。
- 不影响标注 V1 / V1.1、图片上传、`flyToView`、纯净模式、测量、剖切、点云、帮助、保存启动视图、手机分享页。
- 截图后当前模型视角不变化。
- 截图后纯净模式状态不变化。

---

## 5. 验收清单

- [ ] 打开 `/viewer/lcc/77`，调整到任意视角。
- [ ] 点击左下工具栏「拍照」。
- [ ] 弹出「保存当前视角图片」对话框，默认文件名已填入。
- [ ] 可输入自定义文件名。
- [ ] Edge / Chrome 弹出系统保存位置选择，可选目录保存。
- [ ] 保存后本地得到 PNG 图片。
- [ ] 图片只包含模型画面，不包含工具栏、顶部导航、右侧详情栏、标注标题 / 内容框、编辑器、帮助面板。
- [ ] 文件名自动补 `.png`，非法字符被清理。
- [ ] 用户取消保存位置选择时不报错，toast 提示「已取消保存」。
- [ ] 截图后当前模型视角不变化。
- [ ] 纯净模式状态不被改变。
- [ ] 标注飞行、测量、剖切、点云、帮助、保存启动视图不受影响。
- [ ] readonly 分享页可拍照保存本地。
- [ ] `cd web && pnpm build` 通过。

---

## 6. 主要文件

- `web/components/models/viewers/types.ts` — `ModelViewerHandle.captureScreenshot` 与 `LCC_VIEWER_CAPABILITIES.screenshot`。
- `web/components/models/lcc-viewer.tsx` — `captureScreenshot` 实现。
- `web/components/models/model-viewer-toolbar.tsx` — 拍照按钮接线。
- `web/components/models/model-screenshot-dialog.tsx` — 保存对话框（新增）。
- `web/app/viewer/lcc/[id]/page.tsx` — 保存流程接入。

---

## 7. 浏览器兼容降级

- 优先：`window.showSaveFilePicker`（Chrome / Edge），可选择保存位置并由系统处理覆盖确认。
- 降级：`URL.createObjectURL(blob)` + `<a download>` + `a.click()`（Safari / Firefox / 部分移动端），文件名重复由浏览器自动处理。
- 用户取消系统保存对话框抛 `AbortError`，静默提示，不报错。

---

## 8. 暂不做（不属于本次范围）

- 全景播放器。
- 视频播放器。
- 导览路线自动播放。
- 云端截图相册。
- 截图上传 OSS。
- 手机端拍照入口（V1 暂未接入 `MobileLccViewerChrome`）。
- JPEG 格式选项与质量参数 UI（V1 默认 PNG）。
- 截图失败时在对话框内联提示重试（当前仅 toast）。

---

## 9. 构建记录

- 本次仅改前端，`cd web && pnpm build` 已通过（exit 0，仅项目原有 ESLint `<img>` 告警，无新增类型错误）。
- 未改 server，本次无需 server build。
- `/viewer/lcc/[id]` 路由构建产物正常。

---

## 10. 禁止事项

- `server/.env` 为本地环境文件，不提交。
- 不把 `LCC-Web-0.6.1/` / `reference/` / 临时图片素材误提交。
- 不把 V2 功能混入本次封板。
- 全景、视频、导览路线、云端截图相册、截图上传 OSS 均不属于本次范围。

---

## 11. 相关文档索引（2026-07-09 补记）

- 标注 V1 / V1.1 / 手机端标注交互：`docs/model-annotation-v1-acceptance.md`
- LCC ZIP 自动解包生产安全：`docs/lcc-zip-auto-extract-safety.md`
- 模型浏览器架构（含社区筛选隐藏、入口链接原生分发）：`docs/model-viewer-architecture.md`
- 阶段检查点：`docs/dev-checkpoint.md`
