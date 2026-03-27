# Dockerfile para bill-lm Server - Bun Runtime
# Multi-stage build: Reduce image size y evita dependencias de desarrollo

# ===== STAGE 1: Builder =====
FROM oven/bun:latest as builder

WORKDIR /app

# Argumentos para el builder stage
ARG DATABASE_URL=postgresql://localhost/bill-lm
ARG ENVIRONMENT=dev

# Establecer variables de entorno para el builder
ENV DATABASE_URL=${DATABASE_URL}
ENV ENVIRONMENT=${ENVIRONMENT}

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

# Argumentos de build para las variables de entorno
ARG PORT=3000
ARG DATABASE_URL=postgresql://localhost/bill-lm
ARG ENVIRONMENT=prod
ARG MINIO_ENDPOINT
ARG MINIO_ACCESS_KEY
ARG MINIO_SECRET_KEY
ARG MINIO_BUCKET=invoices
ARG GOOGLE_APPLICATION_CREDENTIALS
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_STORAGE_BUCKET
ARG CLERK_SECRET_KEY
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG LLM_PROVIDER
ARG LLM_MODEL
ARG LLM_API_KEY
ARG LLM_API_URL
ARG LLM_TEMPERATURE

# Establecer variables de entorno
ENV PORT=${PORT}
ENV DATABASE_URL=${DATABASE_URL}
ENV ENVIRONMENT=${ENVIRONMENT}
ENV MINIO_ENDPOINT=${MINIO_ENDPOINT}
ENV MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
ENV MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
ENV MINIO_BUCKET=${MINIO_BUCKET}
ENV GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS}
ENV FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
ENV FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET}
ENV CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
ENV VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
ENV VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
ENV VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}
ENV LLM_PROVIDER=${LLM_PROVIDER}
ENV LLM_MODEL=${LLM_MODEL}
ENV LLM_API_KEY=${LLM_API_KEY}
ENV LLM_API_URL=${LLM_API_URL}
ENV LLM_TEMPERATURE=${LLM_TEMPERATURE}
ENV NODE_ENV=${ENVIRONMENT}
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
# Exponer puerto
EXPOSE $PORT

RUN chmod +x ./start.sh

# Ejecutar servidor
ENTRYPOINT ["./start.sh"]
