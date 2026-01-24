FROM node:22-alpine

WORKDIR /app
RUN corepack enable

# 1. Копируем только лок-файл для кэширования загрузок
COPY pnpm-lock.yaml ./

# 2. Скачиваем пакеты в виртуальное хранилище (этот слой будет закэширован!)
# Если pnpm-lock.yaml не менялся, Docker пропустит этот шаг мгновенно
RUN pnpm fetch

# 3. Теперь копируем исходный код проекта
COPY . .

# 4. Устанавливаем зависимости из кэша (режим --offline)
# Это происходит очень быстро, так как ничего не скачивается из интернета
RUN pnpm install --frozen-lockfile --offline

# 5. Переходим в папку веб-приложения и собираем его
WORKDIR /app/apps/web
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]