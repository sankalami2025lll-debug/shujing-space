# 03 顶部导航 NavBar 页面组件说明


> 项目：数境空间公司官网  
> 来源：Figma Make 当前链接导出源码  
> 设计依据：Figma 当前导出版本  
> 前端技术栈：React + Vite + TypeScript + Tailwind CSS + lucide-react + shadcn/ui
> 技术栈说明：当前 Vite + React 前端为 UI 原型基准（视觉/文案/交互的还原依据，不得删除）；最终生产前端将迁移至 Next.js，迁移后保持现有 UI/文案/交互一致。后端 NestJS、数据库 PostgreSQL、部署 1Panel + Docker，详见 docs/backend-architecture-plan.md。  
> 说明：本文档按页面/模块拆分，供前端、后端和 AI 编程工具直接理解页面功能、交互、状态、接口与注释位置。


## 对应源码

- `src/app/NavBar.tsx`

## 组件定位

`NavBar` 是全站公共顶部导航组件，用于所有主页面：

- 首页
- 模型社区
- 模型库
- 关于我们
- 联系我们

登录注册页 `AuthPage` 使用独立顶部结构，不直接复用 `NavBar`。

## Props 说明

| Prop | 类型 | 说明 |
|---|---|---|
| `activePage` | `string` | 当前激活页面，用于导航高亮 |
| `onNavigateHome` | `() => void` | 跳转首页 |
| `onNavigateCommunity` | `() => void` | 跳转模型社区 |
| `onNavigateAbout` | `() => void` | 跳转关于我们 |
| `onNavigateContact` | `() => void` | 跳转联系我们 |
| `onNavigateAuth` | `() => void` | 跳转注册 / 登录 |

## UI 结构

| 区域 | 功能 |
|---|---|
| Logo | 点击返回首页 |
| PC 导航链接 | 首页、模型社区、关于我们 |
| PC 右侧按钮 | 注册 / 登录、联系我们 |
| 移动端菜单按钮 | 打开 / 关闭移动端下拉菜单 |
| 移动端菜单 | 页面导航 + 注册 / 登录 + 联系我们 |

## 当前交互逻辑

- `mobileOpen` 控制移动端菜单展开。
- 点击任何移动端菜单项后，自动关闭菜单。
- `activePage` 等于当前链接 key 时，显示高亮下划线。

## 代码注释建议

```tsx
// NavBar：全站公共导航栏，接收父组件传入的页面跳转函数。
// activePage 用于控制当前页面高亮，不负责真实路由逻辑。
// mobileOpen 用于移动端菜单展开/收起，点击任意导航项后需要关闭菜单。
```

## 正式开发建议

- 使用 `react-router-dom` 的 `NavLink` 替代手动 active 判断。
- 登录后将「注册 / 登录」替换为用户头像或个人中心入口。
- 联系我们按钮保持强转化样式，不能弱化。
- 移动端菜单需要增加页面滚动锁定，防止背景滚动。

## 验收标准

- PC 端导航横向显示。
- 移动端显示菜单按钮，展开后全宽菜单正常显示。
- 点击 Logo 返回首页。
- 当前页面导航项有明确高亮状态。
