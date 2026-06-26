# 数境空间官网前端（Next.js）生产镜像
# 目标：
# 1. 构建阶段执行 pnpm build
# 2. 运行阶段执行 next start
# 3. 不在镜像中写入任何真实环境变量

FROM node:22-alpine AS deps
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm@11.9.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NODE_ENV=production
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["pnpm", "start", "--hostname", "0.0.0.0", "--port", "3000"]
