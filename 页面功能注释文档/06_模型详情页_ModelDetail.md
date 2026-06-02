# 06 模型详情页 ModelDetailPage 说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/ModelLibrary.tsx`
- 内部组件：`ModelDetailPage`

## 页面定位

模型详情页用于展示单个三维模型的浏览、信息、操作和相关推荐。当前是内嵌在 `ModelLibrary.tsx` 中的条件渲染页面。

## UI 结构

| 区域 | 功能 |
|---|---|
| 左侧模型浏览器 | 模拟三维模型查看区域 |
| 右侧信息栏 | 模型标题、类型、作者、标签、数据说明 |
| 操作按钮 | 全屏、重置视角、收藏、分享 |
| 业务按钮 | 浏览模型 / 申请训练数据服务 |
| 相关推荐 | 展示其他模型卡片 |

## 状态说明

| 状态 | 说明 |
|---|---|
| `saved` | 当前模型是否收藏 |
| `isFullscreen` | 是否处于浏览器全屏状态 |
| `viewKey` | 重置模型视角时刷新模拟查看区域 |
| `shareToast` | 复制分享链接后的提示状态 |

## 交互逻辑

- 点击返回按钮：调用 `onBack()` 返回模型列表。
- 点击全屏：调用浏览器 Fullscreen API。
- 点击重置：更新 `viewKey`，触发查看区域重新渲染。
- 点击分享：优先使用 `navigator.share`，否则复制当前链接到剪贴板。
- 点击相关推荐：切换当前详情模型。
- 如果模型类型是「具身智能机器人训练场景」，显示申请训练数据服务入口。

## 代码注释建议

```tsx
// ModelDetailPage：模型详情页，当前作为 ModelLibrary 内部条件页面存在，正式开发建议拆成 /models/:id 路由页面。
// handleFullscreen：调用浏览器 Fullscreen API，让模型查看区域进入全屏浏览。
// handleReset：通过改变 viewKey 模拟重置三维视角，后续接入真实 viewer 后应调用 viewer.resetCamera()。
// handleShare：优先调用 Web Share API，不支持时复制链接到剪贴板。
```

## 真实三维模型接入建议

当前模型浏览器是 UI 占位，正式开发可接入：

- Three.js
- Cesium
- Potree
- Autodesk Viewer
- 3D Tiles Viewer
- Gaussian Splatting Viewer
- BIM/IFC Viewer

需要预留字段：

| 字段 | 说明 |
|---|---|
| `viewerType` | 模型查看器类型 |
| `modelUrl` | 模型文件地址 |
| `thumbnailUrl` | 封面图 |
| `metadataUrl` | 模型元数据 |
| `fileFormat` | glb、gltf、ifc、las、3dtiles 等 |

## 后端接口建议

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/models/:id` | GET | 获取模型详情 |
| `/api/models/:id/view` | POST | 记录浏览量 |
| `/api/models/:id/favorite` | POST/DELETE | 收藏 / 取消收藏 |
| `/api/models/:id/share` | POST | 分享记录 |
| `/api/models/:id/related` | GET | 获取相关推荐模型 |

## 验收标准

- 从列表进入详情后滚动回页面顶部。
- 返回按钮能回到模型列表。
- 分享功能在支持和不支持 Web Share API 的浏览器中都有反馈。
- 相关推荐点击后能切换详情内容。
- 具身智能模型显示训练数据服务申请按钮。
