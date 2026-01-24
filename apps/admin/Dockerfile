FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# 1. Сначала копируем манифесты
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/

# 2. Скачиваем зависимости в кэш (этот слой не будет пересобираться при изменении кода)
RUN pnpm fetch

# 3. Теперь копируем весь исходный код
COPY . .

# 4. Устанавливаем зависимости из кэша (быстро)
RUN pnpm install --frozen-lockfile --offline

# 5. Собираем приложение
WORKDIR /app/apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Runner Stage ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Копируем standalone сборку
# Next.js standalone в монорепозитории сохраняет структуру путей, поэтому копируем в корень /app
COPY --from=build /app/apps/admin/.next/standalone ./

# Копируем статику (оставляем вашу логику дублирования для надежности путей)
COPY --from=build /app/apps/admin/.next/static /app/apps/admin/.next/static
COPY --from=build /app/apps/admin/.next/static /app/.next/static

# Копируем public
COPY --from=build /app/apps/admin/public /app/apps/admin/public

EXPOSE 3001

# Запускаем сервер
CMD ["node", "apps/admin/server.js"]
