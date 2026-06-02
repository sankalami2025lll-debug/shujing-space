# Rules 编号说明

| 文件 | 主题 |
|------|------|
| `000-project-identity.mdc` | 项目身份、文档源、业务边界 |
| `010-frontend-stack.mdc` | React/Vite/Tailwind/shadcn（`src/**/*`） |
| `020-ui-fidelity.mdc` | Figma 还原、视觉禁忌 |
| `030-pages-routing.mdc` | 路由与页面拆分 |
| `040-data-api-permissions.mdc` | 接口、权限、数据 |
| `050-comments-docs.mdc` | 中文注释与文档同步 |
| `060-testing-build.mdc` | `pnpm build` 与验收 |
| `shujingkonjian.mdc` | 数境空间总纲（alwaysApply） |

`alwaysApply: true` 的规则无需手动加载；带 `globs` 的规则在编辑匹配路径时自动生效。
