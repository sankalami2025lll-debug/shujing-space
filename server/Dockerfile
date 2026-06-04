# 数境空间官网后端 多阶段构建（仅后端 API）
# 阶段 1：安装全部依赖
FROM node:22-alpine AS deps
WORKDIR /app
ARG PNPM_REGISTRY=https://registry.npmmirror.com
ARG PNPM_FETCH_RETRIES=5
ARG PNPM_FETCH_RETRY_FACTOR=2
ARG PNPM_FETCH_RETRY_MINTIMEOUT=20000
ARG PNPM_FETCH_RETRY_MAXTIMEOUT=120000
ARG PNPM_FETCH_TIMEOUT=300000
ENV npm_config_registry=${PNPM_REGISTRY} \
    npm_config_fetch_retries=${PNPM_FETCH_RETRIES} \
    npm_config_fetch_retry_factor=${PNPM_FETCH_RETRY_FACTOR} \
    npm_config_fetch_retry_mintimeout=${PNPM_FETCH_RETRY_MINTIMEOUT} \
    npm_config_fetch_retry_maxtimeout=${PNPM_FETCH_RETRY_MAXTIMEOUT} \
    npm_config_fetch_timeout=${PNPM_FETCH_TIMEOUT} \
    PNPM_HOME=/pnpm \
    PNPM_STORE_DIR=/pnpm/store
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN mkdir -p /pnpm/store
RUN --mount=type=cache,id=shujing-space-server-pnpm-store,target=/pnpm/store \
    pnpm config set registry "${npm_config_registry}" && \
    pnpm config set fetch-retries "${npm_config_fetch_retries}" && \
    pnpm config set fetch-retry-factor "${npm_config_fetch_retry_factor}" && \
    pnpm config set fetch-retry-mintimeout "${npm_config_fetch_retry_mintimeout}" && \
    pnpm config set fetch-retry-maxtimeout "${npm_config_fetch_retry_maxtimeout}" && \
    pnpm config set fetch-timeout "${npm_config_fetch_timeout}" && \
    pnpm config set store-dir "${PNPM_STORE_DIR}" && \
    pnpm install --frozen-lockfile --prefer-offline

# 阶段 2：生成 Prisma Client 并编译
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

# 阶段 3：仅保留生产依赖与构建产物
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/main.js"]
