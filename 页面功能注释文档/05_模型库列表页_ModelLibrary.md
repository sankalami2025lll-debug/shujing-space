# 05 模型库列表页 ModelLibrary 说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/ModelLibrary.tsx`
- 主要组件：`ModelLibrary`、`ModelCard`
- 依赖：`communityData.ts`

## 页面定位

模型库列表页是真正承载大量模型浏览、搜索、筛选、发布和个人中心入口的页面。用户进入后可以：

- 搜索模型。
- 按模型类型筛选。
- 按排序方式切换。
- 查看模型卡片。
- 打开模型详情。
- 发布自己的模型。
- 进入个人中心。

## 页面状态

| 状态 | 类型 | 说明 |
|---|---|---|
| `activeType` | `string` | 当前模型分类筛选 |
| `activeSort` | `string` | 当前排序方式 |
| `searchQuery` | `string` | 搜索关键词 |
| `showUpload` | `boolean` | 是否显示发布模型弹窗 |
| `detailModel` | `ModelItem \| null` | 当前打开的模型详情 |
| `showTraining` | `boolean` | 是否显示训练数据申请弹窗 |
| `showPersonal` | `boolean` | 是否进入个人中心 |

## 模型分类

```ts
const MODEL_TYPES = ["全部模型", "实景三维", "BIM 模型", "构件级模型", "具身智能机器人训练场景"];
```

## 搜索筛选逻辑

当前前端逻辑：

```ts
const filtered = models.filter(m => {
  const matchType = activeType === "全部模型" || m.type === activeType;
  const matchSearch = !searchQuery || m.title.includes(searchQuery) || m.author.includes(searchQuery) || m.tags.some(t => t.includes(searchQuery));
  return matchType && matchSearch;
});
```

正式开发应改为后端分页查询。

## 模型卡片功能

每个模型卡片包含：

- 模型封面视觉。
- 模型类型标签。
- 模型标题。
- 标签列表。
- 作者。
- 发布时间。
- 浏览量。
- 点赞数。
- 浏览模型按钮。
- 点赞 / 收藏 / 分享操作。
- 如果是「具身智能机器人训练场景」，显示「申请训练数据服务」。

## 代码注释建议

```tsx
// ModelLibrary：模型库主页面，负责搜索、分类、排序、模型卡片列表、发布弹窗和个人中心入口。
// filtered：当前仅在前端基于静态数据筛选，正式项目应改为后端分页查询。
// detailModel：不为空时显示模型详情页，模拟 /models/:id 路由效果。
// showUpload：控制发布模型弹窗。
// showPersonal：控制个人中心子页面。
```

## 后端接口建议

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/models` | GET | 模型列表，支持 `type`、`keyword`、`sort`、`page`、`pageSize` |
| `/api/models/:id` | GET | 模型详情 |
| `/api/models/:id/like` | POST/DELETE | 点赞 / 取消点赞 |
| `/api/models/:id/favorite` | POST/DELETE | 收藏 / 取消收藏 |
| `/api/models/:id/share` | POST | 记录分享行为 |

## 正式开发注意事项

- 「共 128 个模型」目前是静态展示，正式开发应使用接口返回的 `total`。
- 「加载更多」应实现分页或无限滚动。
- 搜索按钮目前不单独触发接口，正式开发可支持回车和点击搜索。
- 排序按钮当前只改变状态，正式开发应影响接口查询参数。

## 验收标准

- 搜索关键词能按标题、作者、标签筛选。
- 分类按钮能切换模型类型。
- 点击模型卡片能进入详情页。
- 发布模型按钮能打开上传弹窗。
- 个人中心按钮能进入个人中心。
- 具身智能训练场景卡片显示专属申请入口。
