# 10 关于我们 AboutUs 页面说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/AboutUs.tsx`

## 页面定位

关于我们页面用于建立公司可信度，说明数境空间的公司定位、核心能力、服务场景和长期愿景。

## 页面结构

| 区域 | 功能 |
|---|---|
| Hero | 品牌使命：让真实世界进入数字空间 |
| Company Intro | 公司介绍：真实三维空间数据服务 |
| Core Capabilities | 核心能力展示 |
| Service Scenarios | 服务场景展示 |
| Vision | 公司愿景 |
| CTA | 引导用户联系或进入社区 |
| Footer | 底部信息 |

## 核心能力

来源于 `capabilities`：

- 真实空间采集与重建
- BIM / 模型处理能力
- 云端展示与平台接入
- 数字孪生数据底座
- 空间资产管理
- 具身智能空间训练数据

## 服务场景

来源于 `scenarios`：

- 工程改造
- 数字文旅
- 游戏影视
- 数字存档
- 云上营销
- 具身智能训练

## 当前交互

- 「了解核心能力」按钮滚动到 `core-capabilities` 区域。
- 「联系我们」按钮当前样式存在，但建议正式开发绑定 `onNavigateContact`。

## 代码注释建议

```tsx
// AboutUs：公司介绍页，用于建立品牌可信度和解释真实三维空间数据服务能力。
// capabilities：核心能力卡片数据，正式项目可由 CMS 或后台配置。
// scenarios：服务场景列表，与首页业务场景保持一致。
// core-capabilities：页面锚点，用于 Hero 按钮平滑滚动。
```

## 后端 / CMS 建议

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/site/about` | GET | 获取关于我们页面配置 |
| `/api/site/capabilities` | GET | 获取核心能力卡片 |
| `/api/site/scenarios` | GET | 获取服务场景 |

## 验收标准

- 页面内容与公司定位一致。
- 核心能力卡片数量和内容完整。
- 移动端布局不挤压。
- CTA 能正确跳转联系或社区。
