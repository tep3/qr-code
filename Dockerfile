# --- Stage 1: Builder ---
FROM oven/bun:1.3-slim AS builder

WORKDIR /app

# 1. ติดตั้ง Dependencies (Bun จะโหลด sharp สำหรับ linux-x64 มาไว้ใน node_modules)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 2. คัดลอก Source Code
COPY src ./src
COPY public ./public
COPY tsconfig.json ./

# 3. สร้าง Executable (จุดสำคัญ: ใช้ --external sharp)
# --external sharp จะบอกให้ Bun ไม่ต้องแพ็ค sharp เข้าไปในไฟล์ app
RUN bun build src/index.ts --compile --minify --external sharp --outfile app


# --- Stage 2: Runtime ---
FROM debian:bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE $PORT

# 4. ติดตั้ง Fonts และ Utilities ที่จำเป็นสำหรับ Sharp 
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu \
    fonts-liberation \
    fonts-thai-tlwg \
    fontconfig \
    && fc-cache -f -v \
    && rm -rf /var/lib/apt/lists/*

# 5. สร้าง non-root user
RUN adduser --disabled-password --gecos "" appuser

# 6. คัดลอกไฟล์จาก Builder
# เอาไฟล์ Binary มา
COPY --from=builder --chown=appuser:appuser /app/app ./app
# เอาโฟลเดอร์ public มา
COPY --from=builder --chown=appuser:appuser /app/public ./public
# (สำคัญมาก) เอา node_modules มาด้วย เพื่อให้ไฟล์ app เรียกใช้ sharp แบบ external ได้
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules

# เปลี่ยนสิทธิ์ให้ execute ได้
RUN chmod +x ./app

# สลับไปใช้ user ที่สร้างไว้เพื่อความปลอดภัย
USER appuser

# รันด้วยไฟล์ Binary โดยตรง!
CMD ["./app"]