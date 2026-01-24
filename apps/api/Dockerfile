FROM node:22-alpine

WORKDIR /app
RUN corepack enable

# 1. Кэширование зависимостей (самый долгий этап)
COPY pnpm-lock.yaml ./
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