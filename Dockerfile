# ============ Build Stage ============
FROM node:22-alpine AS builder

WORKDIR /app

# 安装构建依赖（Prisma 需要）
RUN apk add --no-cache libc6-compat openssl

# 复制依赖配置
COPY package.json package-lock.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

# 安装依赖（跳过 postinstall，因为数据库还没就绪）
RUN npm ci --ignore-scripts

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码
COPY . .

# 构建
RUN npm run build

# ============ Production Stage ============
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 从 builder 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 启动脚本（启动时自动执行数据库迁移）
COPY scripts/startup.sh /usr/local/bin/startup.sh
RUN chmod +x /usr/local/bin/startup.sh

EXPOSE 3000

CMD ["startup.sh"]
