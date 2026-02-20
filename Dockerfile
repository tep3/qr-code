# --- Stage 1: Builder ---
FROM oven/bun:1.3-slim AS builder

WORKDIR /app

# คัดลอกเฉพาะไฟล์จัดการ dependencies ก่อน เพื่อใช้ Cache ของ Docker
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# คัดลอก Source code และตั้งค่า
COPY src ./src
COPY public ./public
# COPY drizzle ./drizzle
COPY tsconfig.json ./

# คอมไพล์เป็น Executable Binary
RUN bun build src/index.ts --compile --minify --outfile app


# --- Stage 2: Runtime ---
# เปลี่ยนมาใช้ debian เปล่าๆ เพราะไฟล์ app ของเรามี Bun runtime ฝังอยู่แล้ว
FROM debian:bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE $PORT

# ติดตั้ง Fonts และ Utilities ที่จำเป็น (รวมถึง fontconfig สำหรับ sharp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu \
    fonts-liberation \
    fonts-thai-tlwg \
    fontconfig \
    && fc-cache -f -v \
    && rm -rf /var/lib/apt/lists/*

# สร้าง non-root user
RUN adduser --disabled-password --gecos "" appuser

# คัดลอกไฟล์จาก builder พร้อมเปลี่ยนสิทธิ์เจ้าของเป็น appuser ทันที (ประหยัด Layer)
COPY --from=builder --chown=appuser:appuser /app/app ./app
# ถ้าใช้ sharp จำเป็นต้องเอา node_modules มาด้วย แต่ถ้าไม่ได้ใช้ native module สามารถลบบรรทัดล่างทิ้งได้เลย
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/public ./public
# COPY --from=builder --chown=appuser:appuser /app/drizzle ./drizzle

# เปลี่ยนสิทธิ์ให้ execute ได้
RUN chmod +x ./app

# สลับไปใช้ user ที่สร้างไว้
USER appuser

# สั่งรันแอป
CMD ["./app"]