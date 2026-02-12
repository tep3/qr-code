FROM oven/bun:1.2-slim as builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY public ./public
# COPY drizzle ./drizzle
COPY tsconfig.json ./

# Build binary
RUN bun build src/index.ts --compile --minify --outfile app

# Runtime stage
FROM oven/bun:1.3-slim
WORKDIR /app

# Copy compiled binary and necessary files
COPY --from=builder /app/app ./app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
# COPY --from=builder /app/drizzle ./drizzle

RUN chmod +x ./app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE $PORT

# --------------------------------------------------------
# Update System & Install Fonts + Utilities
# --------------------------------------------------------
# adduser: สำหรับสร้าง user ปลอดภัย
# fonts-dejavu, fonts-liberation: ฟอนต์พื้นฐาน (Latin)
# fonts-thai-tlwg: ฟอนต์ภาษาไทย (จำเป็นต้องใส่เพื่อให้ Sharp วาดภาษาไทยได้)
# fontconfig: ระบบจัดการฟอนต์
RUN apt-get update && apt-get install -y --no-install-recommends \
    adduser \
    fonts-dejavu \
    fonts-liberation \
    fonts-thai-tlwg \
    fontconfig \
    && fc-cache -f -v \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

CMD ["./app"]