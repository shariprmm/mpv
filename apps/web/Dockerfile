FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

# 1. Копируем манифесты для кэширования зависимостей
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/

# 2. Скачиваем пакеты в виртуальное хранилище (этот слой будет закэширован!)
RUN pnpm fetch

# 3. Теперь копируем исходный код проекта
COPY . .

# 4. Устанавливаем зависимости из кэша (режим --offline)
RUN pnpm install --frozen-lockfile --offline

# 5. Собираем приложение
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Runner Stage ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Копируем standalone сборку
COPY --from=build /app/apps/web/.next/standalone ./

# Копируем статику
COPY --from=build /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=build /app/apps/web/.next/static /app/.next/static

# Копируем public
COPY --from=build /app/apps/web/public /app/apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
