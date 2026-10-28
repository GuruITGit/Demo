FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++ chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont font-noto-cjk
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY package*.json ./

# ---- Dependencies ----
FROM base AS deps
RUN npm ci --only=production

FROM base AS dev-deps
RUN npm ci

# ---- Build ----
FROM dev-deps AS build
COPY . .
RUN npm run build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    mkdir -p /app/.storage /app/uploads && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000

# รัน migration ที่ค้างก่อนสตาร์ท (ถ้าล้มเหลว container จะ exit เพื่อกัน schema ไม่ตรง)
CMD ["sh", "-c", "node dist/run-migrations.js && node dist/main.js"]
