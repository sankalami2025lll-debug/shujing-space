---
name: shujing-space-agent-guide
description: >-
  数境空间官网 Agent 上下文导航：按 AGENTS.md、.cursor/rules、.cursor/skills、
  subagents、页面功能注释文档 的顺序读取与执行任务。在开发/改页/接接口/提交前检查、
  或用户提到 AGENTS、rules、skills、subagents、页面功能注释文档 时使用。
---

# 数境空间 Agent 工作区导航

本 Skill 定义项目内 **AI 协作文件体系** 的读取顺序、分工与触发条件。不要跳过文档直接改代码。

## 目录地图

| 路径 | 作用 | 何时读 |
|------|------|--------|
| `AGENTS.md` | 总规则：技术栈、开发顺序、最高优先级、输出要求 | 每个任务开始前 |
| `.cursor/rules/` | 持久规则（项目身份、UI、路由、接口、注释、构建） | 编码全程生效；改对应领域前扫一眼文件名 |
| `.cursor/skills/` | 专项工作流（按文档实现页面、UI 检查、接口契约、提交前审查） | 任务类型匹配时 **显式加载** 对应 Skill |
| `.cursor/agents/` | **Cursor 正式 Subagent**（YAML frontmatter，Agent 自动识别与委派） | UI/契约/QA 等专项并行任务 |
| `.cursor/subagents/` | 子代理角色说明与索引（对应 `.cursor/agents/` 同名文件） | 查阅分工、手动引用时 |
| `.cursor/mcp.json.example` | MCP 配置示例（Playwright、Context7 等） | 用户要配 MCP、做浏览器验证或查库文档时 |
| `页面功能注释文档/` | 每页功能、交互、状态、接口的第一依据 | 实现或修改任何页面前 |

## 标准读取顺序

```
AGENTS.md
  → .cursor/rules/（alwaysApply 规则自动生效）
  → 页面功能注释文档/00_文档索引.md
  → 当前页面对应 MD（如 05_模型库列表页_ModelLibrary.md）
  → 目标源码文件
  →（按需）.cursor/skills/<专项>/
```

改代码前必须说明：要读哪些文件、要改哪些文件、修改目的、可能影响页面。  
完成后必须说明：改了什么、如何测试、是否运行 `pnpm build`、是否有报错、下一步建议。

## 内置 Skills 选型

| Skill 目录 | 使用场景 |
|------------|----------|
| `implement-page-from-doc` | 实现/修改/补全某个页面或模块 |
| `ui-fidelity-check` | UI、布局、响应式、Figma 还原 |
| `api-contract-check` | 后端接口、数据库、表单、上传、鉴权 |
| `code-review-before-commit` | 提交前、修 bug、稳定性检查 |

加载方式：在对话中引用 Skill 名称，或按上表在相关任务开始时阅读对应 `SKILL.md`。

## Subagents 选型

正式文件在 `.cursor/agents/`；`.cursor/subagents/` 为说明索引。

| Agent 文件 | 专注范围 |
|------------|----------|
| `frontend-ui-guardian.md` | UI 还原、结构、响应式、视觉；不改后端设计 |
| `backend-contract-architect.md` | 接口、库表、权限、数据流；不改视觉 |
| `qa-release-checker.md` | 构建、跳转、表单状态、移动端、发布前验收 |

显式调用：`/frontend-ui-guardian [任务说明]`

## 页面文档快速索引

完整清单见 `页面功能注释文档/00_文档索引.md`。常见映射：

- 首页 → `02_首页_Home.md` → `App.tsx`
- 导航 → `03_顶部导航_NavBar.md` → `NavBar.tsx`
- 模型社区 → `04_模型社区入口页_ModelCommunity.md`
- 模型库/详情/弹窗/个人中心 → `05`–`09`、`13`
- 关于/联系/登录 → `10`–`12`
- AI 约束全文 → `14_AI开发执行提示词.md`

## 业务硬约束（与 rules 一致）

- 设计依据：Figma 当前导出版本 + 页面功能注释文档。
- 模型社区 = 发布/浏览/搜索/查看模型，**不是**公司介绍页。
- 数据服务申请 **仅**「具身智能机器人训练场景」。
- 每次只改 **一个** 页面或功能模块；不删已有 UI；不无故全站重构。
- 关键状态、表单、接口调用处写 **中文注释**。

## MCP 配置

复制 `.cursor/mcp.json.example` 为 `.cursor/mcp.json`（勿提交密钥）。需要页面截图验证时用 Playwright MCP；需要框架文档时用 Context7。

## 更多细节

规则文件编号说明与 rules 清单见 [reference.md](reference.md)。
