# 13 模型数据结构 communityData 说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/communityData.ts`

## 当前数据作用

`communityData.ts` 是当前 Figma 原型中的静态模型数据文件，被以下页面使用：

- `ModelCommunity.tsx`：展示精选模型。
- `ModelLibrary.tsx`：展示模型列表和详情。

## 当前字段结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | number | 模型 ID |
| `title` | string | 模型标题 |
| `type` | string | 模型类型 |
| `tags` | string[] | 标签数组 |
| `author` | string | 作者名称 |
| `views` | string | 浏览量展示值 |
| `likes` | number | 点赞数 |
| `time` | string | 发布时间展示值 |
| `color` | string | Tailwind 渐变色类 |
| `pattern` | string | 封面纹理类型：grid / lines / dots |
| `viewerUrl` | string | 外部三维 Viewer 在线浏览地址（对应后端 `model_url`）；模型详情页用 iframe 内嵌，为空字符串时回退占位 UI。当前为测试用 Sketchfab 公开 demo 链接 |

## 当前模型类型

- 实景三维
- BIM 模型
- 构件级模型
- 具身智能机器人训练场景

## 类型标签样式

`typeTagColor` 根据模型类型输出不同标签样式：

```ts
export const typeTagColor: Record<string, string> = {
  "实景三维": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "BIM 模型": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "构件级模型": "bg-slate-500/10 text-slate-300 border-slate-500/20",
  "具身智能机器人训练场景": "bg-violet-500/10 text-violet-400 border-violet-500/20",
};
```

## 正式后端模型表建议

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 主键 |
| `user_id` | bigint | 发布用户 ID |
| `title` | varchar | 模型标题 |
| `type` | varchar | 模型类型 |
| `tags` | json | 标签数组 |
| `description` | text | 模型详情说明 |
| `cover_url` | varchar | 封面图地址 |
| `model_url` | varchar | 模型资源地址 |
| `viewer_type` | varchar | 查看器类型 |
| `file_format` | varchar | 文件格式 |
| `views_count` | int | 浏览量 |
| `likes_count` | int | 点赞量 |
| `favorites_count` | int | 收藏量 |
| `visibility` | varchar | 公开 / 私有 / 审核后公开 |
| `status` | varchar | 草稿 / 审核中 / 已发布 / 已驳回 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

## 代码注释建议

```ts
// communityModels：Figma 原型静态模型数据，正式开发时应替换为后端接口返回的数据。
// typeTagColor：模型类型对应的视觉标签样式，新增模型类型时必须同步补充样式。
// CommunityModel：通过 typeof communityModels[0] 推导出的模型类型，正式开发建议改为显式 interface。
```

## AI 开发注意事项

- 不要直接把静态数据写死在页面组件中。
- 模型类型应使用枚举或字典表管理。
- 具身智能机器人训练场景需要单独标识，因为它关联训练数据申请流程。
