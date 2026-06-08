# 部署编排（deploy）

本目录存放数境空间官网的生产部署配置。第一依据见 `../docs/backend-architecture-plan.md`。

## 文件

| 文件 | 用途 | 状态 |
|------|------|------|
| `docker-compose.dev.yml` | 本地开发：仅启动 PostgreSQL | 已就绪 |
| `docker-compose.prod.yml` | 生产编排骨架 | 待补全 |
| `docker-compose.prod.local.yml` | 生产本地测试 | 待补全 |
| `nginx.conf` | Nginx/OpenResty 反向代理模板 | 已就绪 |
| `.env.prod.example` | 生产环境变量模板 | 已就绪 |

---

## 本地开发

```bash
# 1. 启动 PostgreSQL（仅本地开发需要）
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. 启动后端 dev
cd server && pnpm dev

# 3. 启动前端 dev（另开终端）
cd web && pnpm dev
```

- 前端：`http://localhost:3000`
- 后端：`http://localhost:4000`
- dev 模式下，Next.js 自动将 `/api/*` 代理到 `localhost:4000`（见 `web/next.config.ts`）

---

## 生产构建与部署

### 1. API 基址注入规则

前端生产环境默认读取 `NEXT_PUBLIC_API_BASE_URL`，未设置时回退到 `/api`。
当前项目的标准生产方案是：

1. `web/lib/http.ts` 默认使用 `/api`
2. `web/next.config.ts` 只在 `development` 下做 `/api -> http://localhost:4000/api` rewrite
3. `production` 不在 Next.js 内写死 rewrite，由 Nginx / OpenResty 统一把 `/api/*` 反代到 `server:4000`

**标准做法（推荐）**

```bash
cd web
NEXT_PUBLIC_API_BASE_URL=/api pnpm build
# 或直接默认（/api），由反代层处理
pnpm build
```

因此生产前端代码继续 `fetch("/api/...")`，由 Nginx / OpenResty 将所有 `/api/*` 请求转发到后端 NestJS 服务。

**如果你需要在 build 时指定完整 URL（例如分域名部署）**

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com pnpm build
```

**不推荐**

- 不要在 `next.config.ts` 中追加 production rewrite 指向 `localhost:4000`
- 不要把生产后端地址硬编码到业务代码
- 不要在前端页面里直接拼 `http://127.0.0.1:4000`

### 2. 生产环境变量

复制模板并填入真实值：

```bash
cp deploy/.env.prod.example deploy/.env.prod
# 编辑 .env.prod 填入数据库连接串、OSS 密钥、JWT_ACCESS_SECRET 等
```

**必须配置的变量**

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `NODE_ENV` | 生产环境标识 | `production` |
| `PORT` | NestJS 监听端口 | `4000` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/db?schema=public` |
| `CORS_ORIGIN` | 允许的前端来源 | `https://your-domain.com` |
| `SWAGGER_ENABLED` | 生产是否暴露 Swagger | `false` |
| `JWT_ACCESS_SECRET` | JWT 签名密钥 | `至少 32 位随机长串` |
| `JWT_ACCESS_EXPIRES` | JWT 有效期 | `7d` |
| `STORAGE_DRIVER` | 对象存储驱动 | `oss` |
| `OSS_ACCESS_KEY_ID` | 阿里云 AccessKey ID | — |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | — |
| `OSS_BUCKET` | OSS Bucket 名称 | `your-bucket` |
| `OSS_REGION` | OSS 地域 / region | `cn-shenzhen` |
| `OSS_ENDPOINT` | OSS 端点 | `https://oss-cn-shenzhen.aliyuncs.com` |
| `OSS_PUBLIC_BASE` | OSS 公网访问地址 | `https://your-bucket.oss-cn-shenzhen.aliyuncs.com` |
| `OSS_FORCE_PATH_STYLE` | 阿里云 OSS 一般为 false | `false` |
| `OSS_PRESIGN_EXPIRES` | 预签名 PUT 有效期（秒） | `900` |
| `MAX_MODEL_SIZE_MB` | 模型上传大小上限 | `500` |
| `MAX_COVER_SIZE_MB` | 封面上传大小上限 | `5` |
| `VIEWER_URL_ALLOWED_HOSTS` | 外链 viewer 域名白名单 | `sketchfab.com,www.sketchfab.com` |

完整变量列表见 [.env.prod.example](.env.prod.example)。

> 注意：后端当前真实读取的是 `PORT / JWT_ACCESS_SECRET / JWT_ACCESS_EXPIRES / MAX_MODEL_SIZE_MB`，不是旧口径的 `SERVER_PORT / JWT_SECRET / JWT_EXPIRES_IN / MAX_FILE_SIZE_MB`。

### 3. 反向代理（Nginx / OpenResty）

生产环境不要在前端代码里写死后端地址，而是通过反代层将 `/api/*` 发给后端。

**配置位置**

将 `nginx.conf` 部署到 `/etc/nginx/conf.d/shujing-space.conf`。
文中的域名和证书路径均为占位示例，部署时必须替换为正式值。

**最小反代草案**

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    client_max_body_size 200m;
}
```

如果前端与后端同机部署，推荐同时保留：

- `/api/*` -> `127.0.0.1:4000`
- `/*` -> `127.0.0.1:3000`

**路由规则**

| 路径 | 目标 | 说明 |
|------|------|------|
| `/_next/static/*` | → `localhost:3000` | 前端静态资源，长期缓存 |
| `/api/*` | → `localhost:4000` | 后端 API、上传 callback、后台接口 |
| `/*` | → `localhost:3000` | 前端页面（支持 WebSocket） |

**SSL 证书**

推荐使用 Let's Encrypt / Certbot 自动续签：

```bash
sudo certbot --nginx -d your-domain.com
```

### 4. 对象存储

- 存储后端：**阿里云 OSS**
- 访问方式：Bucket 公有读 + 预签名上传（Presigned URL）
- 文件类型：模型文件（.lcc/.lcc2/.glb/.splat）、封面图、视频
- 代码中使用 `OSS_*` 环境变量（历史 `R2_*` 已统一迁移至此命名）

### 5. 安全约束

- `db` / `cache`（如 Redis）不暴露宿主机公网端口
- `.env` 不提交到版本库，经 `env_file` 注入容器
- 生产 CORS 应严格限制为前端域名：`https://your-domain.com`
- 外层由 Cloudflare（CDN / DDoS / SSL / WAF）提供基础防护
- `NEXT_PUBLIC_API_BASE_URL` 若未显式设置，保持默认 `/api` 即可；仅在分域名直连部署时改为完整 HTTPS URL
