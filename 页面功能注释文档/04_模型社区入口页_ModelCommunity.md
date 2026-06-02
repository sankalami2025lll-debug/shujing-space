# 04 模型社区入口页 ModelCommunity 说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/ModelCommunity.tsx`
- 依赖：`communityData.ts`

## 页面定位

这是「模型社区」的宣传入口页，不是完整的模型库列表页。它的作用是：

- 解释模型社区是什么。
- 展示真实空间数据资产类型。
- 展示精选模型。
- 引导用户进入真正的模型浏览页 `ModelLibrary`。
- 引导用户联系数据服务。

## 页面结构

| 区域 | 功能 |
|---|---|
| Hero | 说明“真实三维空间数据资产库”定位 |
| 数据类型 | 展示实景三维、BIM、构件级、具身智能训练场景等类型 |
| 精选模型 | 取 `communityModels.slice(0, 6)` 展示前 6 个模型 |
| 服务入口 | 展示数据服务能力，引导联系或浏览模型 |
| Footer | 底部导航和品牌信息 |

## 精选模型逻辑

```ts
const featuredModels = communityModels.slice(0, 6);
```

点击精选模型时：

```tsx
onClick={() => onNavigateModels?.(model.id)}
```

含义：

- 传入模型 ID。
- 跳转到模型库页面。
- 模型库根据 `initialModelId` 直接打开详情页。

## UI 注释建议

```tsx
{/* Hero：模型社区入口页首屏，重点解释空间数据资产库定位 */}
{/* Data Types：展示社区支持的模型数据类型 */}
{/* Model Gallery：展示精选模型，点击后进入模型详情 */}
{/* Service Cards：展示围绕模型数据的服务能力 */}
```

## 后端接口建议

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/community/featured-models` | GET | 获取精选模型 |
| `/api/community/data-types` | GET | 获取数据类型配置 |
| `/api/community/services` | GET | 获取服务卡片配置 |

## 注意事项

- 该页面不要写成公司介绍页。
- 该页面不要放过多公司解释，重点是社区入口和模型展示。
- 「浏览模型」按钮必须进入真正的模型库页面。
- 具身智能机器人训练场景仅作为社区模型类型和服务方向，不要混成普通模型申请。

## 验收标准

- 点击「浏览模型」进入模型库。
- 点击「联系数据服务」进入联系页面。
- 点击精选模型进入对应模型详情。
- 精选模型样式与模型库卡片风格保持一致。
