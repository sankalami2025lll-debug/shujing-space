# 部署编排（deploy）

本目录存放数境空间官网的容器编排文件。第一依据见 `../docs/backend-architecture-plan.md`。

## 文件

| 文件 | 用途 | 阶段 |
|---|---|---|
| `docker-compose.dev.yml` | 本地开发：仅启动 PostgreSQL，供后端连接 | 已就绪 |
| `docker-compose.prod.yml` | 生产：web(Next.js) + api(NestJS) + db(+cache)，网络隔离、仅内网端口 | 待第 11 步补全 |

## 本地起 PostgreSQL

```bash
# 在仓库根目录执行
docker compose -f deploy/docker-compose.dev.yml up -d

# 查看状态
docker compose -f deploy/docker-compose.dev.yml ps

# 停止（保留数据）
docker compose -f deploy/docker-compose.dev.yml down

# 停止并清空数据
docker compose -f deploy/docker-compose.dev.yml down -v
```

- 连接串（对应 `server/.env` 的 `DATABASE_URL`）：
  `postgresql://postgres:postgres@localhost:5432/shujing_dev?schema=public`
- 仅监听 `127.0.0.1:5432`，不对公网暴露。

## 生产部署约束（届时遵循）

- `db`/`cache` 不暴露宿主机公网端口，仅 Compose 内网供 `api` 访问。
- `.env` 经 `env_file` 注入，不入库；密钥仅服务器/容器内。
- 外层由 1Panel 反代 + Cloudflare（DNS/CDN/SSL/WAF）。
- 模型文件/图片/视频存 Cloudflare R2，不落服务器本地。
