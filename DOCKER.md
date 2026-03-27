# Docker Deployment Guide - bill-lm

Este documento describe cómo deployar bill-lm usando Docker en tu NAS.

## Estructura

```
docker/
├── Dockerfile          # Server (TanStack Start)
└── Dockerfile.worker   # Background Job Worker
```

## Prerequisitos

- Docker & Docker Compose en el NAS
- Registry local en `localhost:5000` (o tu registry privado)
- Secretos configurados en GitHub Actions
- Bases de datos (PostgreSQL, Firebase) accesibles

## Build Local

### Server

```bash
docker build -f docker/Dockerfile \
  --build-arg PORT=3001 \
  --build-arg ENVIRONMENT=prod \
  --build-arg DATABASE_URL="postgresql://user:pass@localhost:5432/bill-lm" \
  --build-arg MINIO_ENDPOINT="minio.local" \
  --build-arg MINIO_ACCESS_KEY="key" \
  --build-arg MINIO_SECRET_KEY="secret" \
  --build-arg MINIO_BUCKET="invoices" \
  --build-arg GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json" \
  --build-arg FIREBASE_PROJECT_ID="bill-lm" \
  --build-arg FIREBASE_STORAGE_BUCKET="bill-lm.firebasestorage.app" \
  --build-arg CLERK_SECRET_KEY="sk_live_..." \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="pk_live_..." \
  --build-arg VITE_FIREBASE_API_KEY="AIzaSy..." \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="bill-lm.firebaseapp.com" \
  --build-arg VITE_FIREBASE_PROJECT_ID="bill-lm" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="bill-lm.firebasestorage.app" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="123456789" \
  --build-arg VITE_FIREBASE_APP_ID="1:123456789:web:abc123def456" \
  --build-arg LLM_PROVIDER="openai" \
  --build-arg LLM_MODEL="gpt-4-mini" \
  --build-arg LLM_API_KEY="sk-proj-..." \
  --build-arg LLM_API_URL="https://api.openai.com/v1" \
  --build-arg LLM_TEMPERATURE="0.7" \
  -t bill-lm-server:latest .
```

### Worker

```bash
docker build -f docker/Dockerfile.worker \
  --build-arg DATABASE_URL="postgresql://user:pass@localhost:5432/bill-lm" \
  --build-arg GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json" \
  --build-arg FIREBASE_PROJECT_ID="bill-lm" \
  --build-arg LLM_PROVIDER="openai" \
  --build-arg LLM_MODEL="gpt-4-mini" \
  --build-arg LLM_API_KEY="sk-proj-..." \
  --build-arg LLM_API_URL="https://api.openai.com/v1" \
  --build-arg LLM_TEMPERATURE="0.7" \
  -t bill-lm-worker:latest .
```

## GitHub Actions Workflow

El archivo `.github/workflows/deploy-build-push.yml` automatiza:

1. **Build** - Compila imágenes Docker para Server y Worker
2. **Semantic Versioning** - Genera tags de versión automáticamente
3. **Health Checks** - Valida que las imágenes inician correctamente
4. **Push to Registry** - Envía a `localhost:5000`
5. **Cleanup** - Mantiene solo las 3 últimas versiones

Se dispara automáticamente con push a `main`.

### Secretos Requeridos (GitHub)

Configura estos secretos en tu repositorio:

```
# Database
DATABASE_URL

# Minio
MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET

# Firebase/Google
GOOGLE_APPLICATION_CREDENTIALS
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET

# Clerk
CLERK_SECRET_KEY
VITE_CLERK_PUBLISHABLE_KEY

# Firebase Web SDK
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID

# LLM
LLM_PROVIDER
LLM_MODEL
LLM_API_KEY
LLM_API_URL
LLM_TEMPERATURE
```

## Ejecutar en el NAS

### Con Docker Run

**Server:**
```bash
docker run -d \
  --name bill-lm-server \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e PORT=3001 \
  -e ENVIRONMENT=prod \
  -e MINIO_ENDPOINT="minio.local" \
  -e MINIO_ACCESS_KEY="key" \
  -e MINIO_SECRET_KEY="secret" \
  -e MINIO_BUCKET="invoices" \
  -e FIREBASE_PROJECT_ID="bill-lm" \
  -e FIREBASE_STORAGE_BUCKET="bill-lm.firebasestorage.app" \
  -e GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json" \
  -e CLERK_SECRET_KEY="sk_live_..." \
  -e VITE_CLERK_PUBLISHABLE_KEY="pk_live_..." \
  -e VITE_FIREBASE_API_KEY="AIzaSy..." \
  -e VITE_FIREBASE_AUTH_DOMAIN="bill-lm.firebaseapp.com" \
  -e VITE_FIREBASE_PROJECT_ID="bill-lm" \
  -e VITE_FIREBASE_STORAGE_BUCKET="bill-lm.firebasestorage.app" \
  -e VITE_FIREBASE_MESSAGING_SENDER_ID="123456789" \
  -e VITE_FIREBASE_APP_ID="1:123456789:web:abc123def456" \
  -e LLM_PROVIDER="openai" \
  -e LLM_MODEL="gpt-4-mini" \
  -e LLM_API_KEY="sk-proj-..." \
  -e LLM_API_URL="https://api.openai.com/v1" \
  -e LLM_TEMPERATURE="0.7" \
  -e NODE_ENV=production \
  localhost:5000/bill-lm-server:1.0.0
```

**Worker:**
```bash
docker run -d \
  --name bill-lm-worker \
  -e DATABASE_URL="postgresql://..." \
  -e FIREBASE_PROJECT_ID="bill-lm" \
  -e GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json" \
  -e LLM_PROVIDER="openai" \
  -e LLM_MODEL="gpt-4-mini" \
  -e LLM_API_KEY="sk-proj-..." \
  -e LLM_API_URL="https://api.openai.com/v1" \
  -e LLM_TEMPERATURE="0.7" \
  -e NODE_ENV=production \
  localhost:5000/bill-lm-worker:1.0.0
```

### Con Docker Compose

Crea un archivo `compose/docker-compose.yml`:

```yaml
version: '3.9'

services:
  server:
    image: localhost:5000/bill-lm-server:${VERSION:-latest}
    ports:
      - '3001:3001'
    environment:
      PORT: 3001
      ENVIRONMENT: prod
      DATABASE_URL: ${DATABASE_URL}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET: ${MINIO_BUCKET}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_STORAGE_BUCKET: ${FIREBASE_STORAGE_BUCKET}
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase.json
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
      VITE_CLERK_PUBLISHABLE_KEY: ${VITE_CLERK_PUBLISHABLE_KEY}
      VITE_FIREBASE_API_KEY: ${VITE_FIREBASE_API_KEY}
      VITE_FIREBASE_AUTH_DOMAIN: ${VITE_FIREBASE_AUTH_DOMAIN}
      VITE_FIREBASE_PROJECT_ID: ${VITE_FIREBASE_PROJECT_ID}
      VITE_FIREBASE_STORAGE_BUCKET: ${VITE_FIREBASE_STORAGE_BUCKET}
      VITE_FIREBASE_MESSAGING_SENDER_ID: ${VITE_FIREBASE_MESSAGING_SENDER_ID}
      VITE_FIREBASE_APP_ID: ${VITE_FIREBASE_APP_ID}
      LLM_PROVIDER: ${LLM_PROVIDER}
      LLM_MODEL: ${LLM_MODEL}
      LLM_API_KEY: ${LLM_API_KEY}
      LLM_API_URL: ${LLM_API_URL}
      LLM_TEMPERATURE: ${LLM_TEMPERATURE}
      NODE_ENV: production
    volumes:
      - /path/to/firebase-serviceAccount.json:/run/secrets/firebase.json:ro
    restart: unless-stopped
    networks:
      - bill-lm

  worker:
    image: localhost:5000/bill-lm-worker:${VERSION:-latest}
    environment:
      DATABASE_URL: ${DATABASE_URL}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase.json
      LLM_PROVIDER: ${LLM_PROVIDER}
      LLM_MODEL: ${LLM_MODEL}
      LLM_API_KEY: ${LLM_API_KEY}
      LLM_API_URL: ${LLM_API_URL}
      LLM_TEMPERATURE: ${LLM_TEMPERATURE}
      NODE_ENV: production
    volumes:
      - /path/to/firebase-serviceAccount.json:/run/secrets/firebase.json:ro
    restart: unless-stopped
    depends_on:
      - server
    networks:
      - bill-lm

networks:
  bill-lm:
    driver: bridge
```

Crea `.env` en el mismo directorio:

```env
VERSION=1.0.0
DATABASE_URL=postgresql://user:pass@localhost:5432/bill-lm
MINIO_ENDPOINT=minio.local
MINIO_ACCESS_KEY=key
MINIO_SECRET_KEY=secret
MINIO_BUCKET=invoices
FIREBASE_PROJECT_ID=bill-lm
FIREBASE_STORAGE_BUCKET=bill-lm.firebasestorage.app
CLERK_SECRET_KEY=sk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=bill-lm.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bill-lm
VITE_FIREBASE_STORAGE_BUCKET=bill-lm.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
LLM_PROVIDER=openai
LLM_MODEL=gpt-4-mini
LLM_API_KEY=sk-proj-...
LLM_API_URL=https://api.openai.com/v1
LLM_TEMPERATURE=0.7
```

Ejecuta:
```bash
docker compose -f compose/docker-compose.yml up -d
```

## Logs

```bash
# Server
docker logs bill-lm-server -f

# Worker
docker logs bill-lm-worker -f
```

## Actualizar a Nueva Versión

1. Haz push a `main`
2. GitHub Actions automáticamente:
   - Compila v1.1.0
   - Valida
   - Pushea a registry
3. En el NAS, actualiza:
   ```bash
   docker pull localhost:5000/bill-lm-server:1.1.0
   docker pull localhost:5000/bill-lm-worker:1.1.0
   docker stop bill-lm-server bill-lm-worker
   docker rm bill-lm-server bill-lm-worker
   docker compose -f compose/docker-compose.yml up -d
   ```

## Troubleshooting

### Server no inicia
```bash
docker logs bill-lm-server
# Revisa DATABASE_URL, MINIO_ENDPOINT, Firebase config
```

### Worker no procesa jobs
```bash
docker logs bill-lm-worker
# Revisa Firestore, credenciales de Firebase
```

### Puerto en uso
```bash
lsof -i :3001
kill -9 <PID>
```

### Limpiar imágenes viejas
```bash
docker image prune -a
```

### Ver imágenes disponibles en registry
```bash
curl -s http://localhost:5000/v2/_catalog | jq .repositories
```
