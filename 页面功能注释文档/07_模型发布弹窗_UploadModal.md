# 07 模型发布弹窗 UploadModal 说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/ModelLibrary.tsx`
- 内部组件：`UploadModal`

## 功能定位

模型发布弹窗用于社区用户上传并发布自己的模型。当前 Figma 原型中是前端表单模拟，正式开发需要接入文件上传、模型审核和用户权限。

## 表单字段

| 字段 | 类型 | 说明 |
|---|---|---|
| 模型文件 | 上传区域 | 支持 glb、gltf、ifc、3d tiles、点云等格式，当前为 UI 占位 |
| 模型名称 | 文本输入 | 用户填写模型标题 |
| 模型分类 | 下拉选择 | 实景三维、BIM 模型、构件级模型、具身智能机器人训练场景 |
| 应用场景 | 多选标签 | 数字文旅、工程改造、数字运维等 |
| 模型简介 | 文本域 | 描述模型内容、空间特点、适用场景 |
| 封面图片 | 上传按钮 | 模型封面图 |
| 发布权限 | 单选标签 | 公开发布、仅自己可见、审核后公开 |

## 状态说明

| 状态 | 说明 |
|---|---|
| `selectedScenes` | 用户选择的应用场景数组 |
| `visibility` | 当前发布权限 |
| `submitted` | 是否提交成功，提交后显示成功状态 |

## 代码注释建议

```tsx
// UploadModal：模型发布弹窗，当前只完成 UI 和前端状态，正式开发必须接入文件上传、表单校验和审核流程。
// selectedScenes：应用场景多选状态。
// visibility：发布权限状态，决定模型发布后是否公开展示。
// submitted：模拟提交成功状态，正式开发应根据接口返回结果切换。
```

## 前端校验建议

- 模型名称不能为空。
- 必须选择模型分类。
- 至少选择一个应用场景。
- 模型简介建议限制 20 - 500 字。
- 模型文件必须限制格式和大小。
- 封面图必须限制格式、比例和大小。

## 后端接口建议

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/uploads/model-file` | POST | 上传模型文件，返回文件地址和资源 ID |
| `/api/uploads/cover` | POST | 上传封面图 |
| `/api/models` | POST | 创建模型发布记录 |
| `/api/models/:id/submit-review` | POST | 提交审核 |

## 数据库字段建议

| 字段 | 说明 |
|---|---|
| `id` | 模型 ID |
| `user_id` | 发布用户 ID |
| `title` | 模型名称 |
| `type` | 模型类型 |
| `scenes` | 应用场景数组 |
| `description` | 模型简介 |
| `file_url` | 模型文件地址 |
| `cover_url` | 封面图地址 |
| `visibility` | 发布权限 |
| `status` | draft / pending / published / rejected |

## 验收标准

- 点击「发布模型」能打开弹窗。
- 点击遮罩或关闭按钮能关闭弹窗。
- 应用场景可多选。
- 发布权限只能选择一个。
- 提交后显示成功提示。
