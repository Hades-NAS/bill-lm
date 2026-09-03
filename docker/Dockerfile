# Dockerfile para bill-lm Server - Bun Runtime
# Multi-stage build: Reduce image size y evita dependencias de desarrollo

# ===== STAGE 1: Builder =====
FROM oven/bun:latest as builder

WORKDIR /app

# Argumentos para el builder stage
ARG DATABASE_URL=postgresql://localhost/bill-lm
ARG ENVIRONMENT=dev
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

# Establecer variables de entorno para el builder
ENV DATABASE_URL=${DATABASE_URL}
ENV ENVIRONMENT=${ENVIRONMENT}
ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
ENV VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
ENV VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
ENV VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}

# Copiar dependencias
COPY package.json bun.lock ./
COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY vite.config.ts ./
COPY postcss.config.cjs ./

# Copiar código fuente
COPY src ./src
COPY prisma ./prisma
COPY public ./public
COPY index.html ./

# Instalar dependencias (incluyendo dev para build)
RUN bun install

# Generar cliente de Prisma
RUN bun run db:gen

# Build de la aplicación
RUN bun run build

# ===== STAGE 2: Runtime =====
FROM oven/bun:latest

WORKDIR /app

# La infraestructura heredada se entrega durante el build para compatibilidad
# con el despliegue NAS actual. Las API keys de proveedores y BYOK nunca van aquí.
ARG PORT=3000
ARG DATABASE_URL
ARG ENVIRONMENT=prod
ARG MINIO_ENDPOINT
ARG MINIO_ACCESS_KEY
ARG MINIO_SECRET_KEY
ARG REDIS_HOST
ARG REDIS_PORT
ARG MINIO_BUCKET_NAME=invoices
ARG GOOGLE_APPLICATION_CREDENTIALS
ARG ANALYZE_QUEUE_NAME
ENV PORT=${PORT}
ENV DATABASE_URL=${DATABASE_URL}
ENV ENVIRONMENT=${ENVIRONMENT}
ENV MINIO_ENDPOINT=${MINIO_ENDPOINT}
ENV MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
ENV MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
ENV REDIS_HOST=${REDIS_HOST}
ENV REDIS_PORT=${REDIS_PORT}
ENV MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME}
ENV GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}
ENV ANALYZE_QUEUE_NAME=${ANALYZE_QUEUE_NAME}
ENV NODE_ENV=production
ENV TZ=UTC

# Copiar solo las dependencias de producción desde builder
COPY --from=builder /app/node_modules ./node_modules

# Copiar output del build (TanStack Start)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./
# Copiar package.json para referencia
COPY package.json bun.lock tsconfig.json prisma.config.ts ./
COPY scripts/start.sh ./start.sh
COPY server.ts ./server.ts
# Exponer puerto
EXPOSE $PORT

RUN chmod +x ./start.sh

# Ejecutar servidor
ENTRYPOINT ["./start.sh"]
