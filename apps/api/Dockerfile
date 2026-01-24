FROM node:22-alpine

WORKDIR /app
RUN corepack enable

# 1. Кэширование зависимостей (самый долгий этап)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
RUN pnpm fetch

# 2. Копирование кода (меняется часто)
COPY . .

# 3. Быстрая оффлайн установка
RUN pnpm install --frozen-lockfile --offline

# 4. Запуск
WORKDIR /app/apps/api

# Если у вас в package.json есть скрипт build (обычно для NestJS/TS он нужен), 
# то раскомментируйте следующую строку:
# RUN pnpm build

EXPOSE 8080
CMD ["pnpm", "start"]
