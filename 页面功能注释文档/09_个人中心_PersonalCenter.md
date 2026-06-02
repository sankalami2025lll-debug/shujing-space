# 09 个人中心 PersonalCenter 说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/ModelLibrary.tsx`
- 内部组件：`PersonalCenter`

## 页面定位

个人中心用于用户管理自己的社区行为和业务申请记录。当前是模型库中的内嵌页面，正式开发建议拆成独立路由。

## Tab 结构

| Tab | 说明 |
|---|---|
| 我的模型 | 用户拥有或上传过的模型 |
| 我的收藏 | 用户收藏的模型 |
| 我的发布 | 用户发布到社区的模型 |
| 我的申请 | 用户提交过的训练数据服务申请 |

## 当前状态

```ts
const [tab, setTab] = useState<"models" | "favorites" | "published" | "applications">("models");
```

## 代码注释建议

```tsx
// PersonalCenter：用户个人中心，当前内嵌在 ModelLibrary 中，正式项目建议拆分为 /user 路由。
// tab：控制当前展示我的模型、我的收藏、我的发布或我的申请。
// 我的申请应重点展示具身智能机器人训练数据服务申请状态。
```

## 后端接口建议

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/user/profile` | GET | 获取用户基本信息 |
| `/api/user/models` | GET | 我的模型 |
| `/api/user/favorites` | GET | 我的收藏 |
| `/api/user/published` | GET | 我的发布 |
| `/api/user/applications` | GET | 我的训练数据申请 |

## 权限说明

- 未登录用户点击个人中心，应跳转注册 / 登录页。
- 登录用户只能看到自己的数据。
- 管理员可以通过后台查看所有用户发布和申请。

## 验收标准

- 点击个人中心进入个人中心页。
- 点击返回社区能回到模型列表。
- Tab 切换有高亮状态。
- 后续接入真实数据后，每个 Tab 能显示独立列表。
