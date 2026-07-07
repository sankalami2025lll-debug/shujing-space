# LCC 底部标识 / appKey 排查与临时视觉兜底记录

> 更新时间：2026-07-07
> 范围：记录 LCC Web SDK 0.6.1 在线上出现 `XGRIDS / FPS N/A` 的排查口径，以及无法立即取得 appKey 时的临时视觉兜底边界。本文不代表官方去水印能力。

## 1. 当前结论

- 本地、生产仓库、生产容器、公网实际加载的 LCC Web SDK 文件 hash 已确认一致。
- 当前运行版本为 LCC Web SDK `0.6.1`。
- 已记录 hash：
  - `lcc-web-sdk.umd.js = 8adb7a0848b747e0f558e0f3ae0e35d4e87833e1801d197e111a5e4a300b29b6`
  - `lcc-web-sdk.js = 419b770edd6e08c302f64ea9c3bb0b09c218ff109ad5778c9f6a3fd37055a885`
- 线上控制台曾出现：

```txt
Warning: No appKey provided to the WebSDK!
watermark info ---> shujingspace.com undefined
```

因此，生产环境出现 `XGRIDS / FPS N/A` 时，优先按 **appKey 未注入、域名白名单或官方授权配置** 排查，而不是优先归因为 SDK 文件版本不一致。

## 2. 已废弃的旧口径

以下旧方案不再作为当前方案维护：

- `LCC_WATERMARK_CROP_PX = 8`
- `LCC_WATERMARK_BOTTOM_BAR_PX = 16`
- 渲染容器 `bottom: -8px`
- loaded 后增加 `16px` 实心黑边

废弃原因：

- 用户已确认本地正确效果没有底部黑边。
- 黑边/裁切容易误伤模型画面，也会让维护者误以为这是正式解决方案。
- 正式问题应回到 WebSDK appKey 与域名授权链路解决。

## 3. 禁止方案

不得使用以下方式处理线上底部标识：

- 修改 SDK 文件或混淆代码。
- DOM 删除 SDK 插入元素。
- CSS 硬遮官方标识。
- 恢复旧的 `8px` 底部裁切。
- 恢复旧的 `16px` 实心黑边。
- 把临时视觉处理写成“官方去水印”或“已永久解决”。

## 4. 正式修复路线

正式路线是让生产 web 构建阶段正确注入官方要求的 appKey，并确保域名授权配置正确：

- 通过环境变量注入 `NEXT_PUBLIC_LCC_APP_KEY`。
- 不把真实 appKey 写入 Git。
- 生产构建时确认 `.next` bundle 中可读取到公开运行时变量。
- 确认 `shujingspace.com` 已按官方要求加入白名单或授权域名。
- 重新构建并重启 web 容器后，用生产页面控制台确认不再出现 `No appKey provided`。

## 5. 临时视觉兜底

在暂时无法取得 appKey 的情况下，可以保留一个轻量的底部虚化安全条作为展示兜底，但必须满足：

- 不修改 SDK。
- 不删除 DOM。
- 不遮挡交互区域。
- `pointer-events-none`。
- 不影响工具栏、测量点线、测量标签、剖切面板、全屏和手机分享页。
- 只作为临时视觉兜底，不能替代官方授权配置。

当前临时效果口径：

- 底部高度约 `16px`。
- 使用轻微渐变/虚化过渡。
- 不使用实心黑边。

## 6. 验收入口

本地与生产建议使用同一模型、同一路由对比：

```txt
/viewer/lcc/35?t=sdk-watermark-check
/models/35?t=sdk-watermark-check
/models/35/view?t=sdk-watermark-check
```

验收项：

- SDK URL 为 `/vendor/lcc-web/0.6.1/lcc-web-sdk.umd.js`。
- SDK hash 与本地一致。
- 控制台不再出现 `No appKey provided`。
- 模型正常加载。
- 工具栏正常。
- 测量、点云切换、设置-环境、左右/上下剖切正常。
- 92% Loading 不残留。
