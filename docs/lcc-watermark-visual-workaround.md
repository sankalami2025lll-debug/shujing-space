# LCC 水印内部视觉处理记录

> 更新时间：2026-06-12
> 范围：仅记录当前仓库对 `XGRIDS` 水印的内部视觉处理现状，不代表官方去水印能力。

## 1. 前提结论

- 当前 `XGRIDS` 水印不是普通页面 DOM，更接近 SDK / 授权链写入画布的品牌层。
- 公开文档未查到正式“去水印 / 品牌控制”开关。
- 当前方案只用于内部展示：
  - 不修改 SDK 文件
  - 不修改 iframe 外层完成协议
  - 不修改 `completeViewerLoading("onLoadedStable")` 收口逻辑

## 2. 当前实施位置

- 文件：`web/components/models/lcc-viewer.tsx`

## 3. 当前参数

- 底部微裁切：`8px`
- 底部黑边高度：`16px`
- 底边颜色：`#0d0d0d`
- 显示时机：仅 `viewerStatus === "loaded"` 后显示

## 4. 当前实施方式

- 将 `mountRef` 所在渲染区域包在 `overflow-hidden` 容器中。
- 通过向下扩展 `8px` 的方式做极小底部裁切，尽量自然抬高 viewer 可视区域。
- 在加载完成后于底部加一条全宽 `16px` 底边，用于覆盖剩余水印区域。
- 底边保持 `pointer-events-none`，避免干扰模型旋转、缩放与拖拽。

## 5. 当前验收口径

- `/viewer/lcc/[id]` 与 `/models/[id]` 中都应生效。
- 不应影响：
  - `data-lcc-loaded=true`
  - `data-lcc-complete-reason=onLoadedStable`
  - 画布交互
  - 外层唯一品牌 Loading 的显示/隐藏

## 6. 当前限制

- 这不是官方授权去水印方案。
- 若 SDK 后续调整水印位置，当前参数可能需要再次微调。
- 若模型主体经常贴近底边，需继续人工评估裁切和底边的视觉影响。

## 7. 回退方式

- 删除 `LCC_WATERMARK_CROP_PX` 与 `LCC_WATERMARK_BOTTOM_BAR_PX`
- 恢复旧的 `mountRef` 结构：`absolute inset-0`
- 删除 `viewerStatus === "loaded"` 时附加的底部黑边
