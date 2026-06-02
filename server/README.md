# 数境空间官网后端（server）

NestJS + Prisma + PostgreSQL 后端 API。架构与接口的第一依据见 `../docs/backend-architecture-plan.md`。

> 当前阶段：**脚手架已落地**（可启动、可连库、统一响应、健康检查、Swagger、Dockerfile）。
> 业务接口（认证 / 模型 / 上传 / 训练申请 / 联系 / 后台）尚未实现，按架构文档「九、开发顺序」逐步推进。

## 技术栈

- 运行时：Node.js 20（本地兼容 22）
- 框架：NestJS 10（TypeScript）
- ORM：Prisma 6 + PostgreSQL 16
- 包管理：pnpm（`server/` 自带 `pnpm-workspace.yaml`，独立于根前端工作区）

## 本地启动

```bash
# 1) 启动本地 PostgreSQL（在仓库根目录执行）
docker compose -f deploy/docker-compose.dev.yml up -d

# 2) 进入后端目录，安装依赖（server/ 自带 pnpm-workspace.yaml，已与根前端工作区隔离）
cd server
pnpm install

# 3) 生成 Prisma Client
pnpm prisma:generate

# 4) 准备环境变量
#    复制 .env.example 为 .env（已提供本地默认 .env），按需修改 DATABASE_URL

# 5) 启动开发服务（默认 http://localhost:4000）
pnpm dev
```

## 健康检查

- `GET http://localhost:4000/api/health`
- 返回统一响应体：`{ "code": 0, "message": "ok", "data": { "status": "ok", "db": "up", ... } }`

## API 文档（Swagger）

- `SWAGGER_ENABLED=true` 时：`http://localhost:4000/api/docs`

## 统一约定

- 全局路由前缀：`/api`
- 成功响应：`{ code: 0, message: 'ok', data }`（由 `TransformInterceptor` 包装）
- 异常响应：`{ code, message, data: null }`（由 `AllExceptionFilter` 统一）
- 入参校验：全局 `ValidationPipe`（`whitelist` + `transform`）

## 数据库建模

- `prisma/schema.prisma` 当前仅含 datasource/generator；完整 10 张表建模与 `seed.ts`（灌入 communityData）在「开发顺序第 3 步」落地。

## 构建与镜像

```bash
pnpm build                 # 产物输出 dist/
docker build -t shujing-api .   # 多阶段构建后端镜像
```
