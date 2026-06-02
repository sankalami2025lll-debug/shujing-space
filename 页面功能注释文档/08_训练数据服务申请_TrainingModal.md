# 08 训练数据服务申请 TrainingModal 说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/ModelLibrary.tsx`
- 内部组件：`TrainingModal`

## 功能定位

该弹窗只用于「具身智能机器人训练场景」的训练数据服务申请。不要扩展成多个普通数据服务类型。

## 触发入口

- 模型卡片类型为「具身智能机器人训练场景」时显示「申请训练数据服务」。
- 模型详情页中，如果当前模型是具身智能训练场景，也显示申请按钮。

## 表单字段

| 字段 | 类型 | 说明 |
|---|---|---|
| 联系人 | 文本输入 | 申请人姓名 |
| 手机 / 微信 | 文本输入 | 联系方式 |
| 公司名称 | 文本输入 | 申请方公司 |
| 机器人类型 | 下拉选择 | 巡检、服务、清洁、配送、工业机器人等 |
| 训练任务 | 多选标签 | 导航、避障、巡检、目标识别、空间交互、任务理解、路径规划 |
| 场景需求描述 | 文本域 | 说明训练空间类型、任务目标和数据用途 |

## 状态说明

| 状态 | 说明 |
|---|---|
| `selectedTasks` | 当前选择的训练任务 |
| `submitted` | 提交成功状态 |

## 代码注释建议

```tsx
// TrainingModal：具身智能机器人训练数据服务申请弹窗，仅针对机器人训练场景开放。
// selectedTasks：训练任务多选状态，如导航、避障、巡检等。
// submitted：模拟提交成功，正式开发应根据接口响应显示成功或失败。
```

## 后端接口建议

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/training-applications` | POST | 提交训练数据服务申请 |
| `/api/training-applications/my` | GET | 查询我的申请记录 |
| `/api/admin/training-applications` | GET | 后台查看申请列表 |
| `/api/admin/training-applications/:id/status` | PATCH | 后台更新申请状态 |

## 申请状态建议

| 状态 | 说明 |
|---|---|
| `submitted` | 已提交 |
| `contacted` | 已联系 |
| `evaluating` | 需求评估中 |
| `quoted` | 已报价 |
| `closed` | 已关闭 |

## 验收标准

- 只有具身智能训练场景显示申请入口。
- 训练任务可多选。
- 提交后显示“申请已提交”。
- 关闭弹窗后返回原模型页面。
