# Despliegue Docker de Bill-LM

Las imágenes no contienen secretos de infraestructura ni claves de proveedores. Los únicos build args del server son `VITE_FIREBASE_*`, configuración pública que se incorpora al bundle web. PostgreSQL, MinIO, Redis, Firebase Admin y `BYOK_ENCRYPTION_KEY` se inyectan únicamente al iniciar cada contenedor.

## Construcción

```bash
docker build -f docker/Dockerfile \
  --build-arg VITE_FIREBASE_API_KEY=... \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
  --build-arg VITE_FIREBASE_PROJECT_ID=... \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=... \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=... \
  --build-arg VITE_FIREBASE_APP_ID=... \
  -t bill-lm-server:latest .

docker build -f docker/Dockerfile.worker -t bill-lm-worker:latest .
```

No uses `--build-arg` para `DATABASE_URL`, MinIO, Redis, service accounts, `BYOK_ENCRYPTION_KEY`, ni API keys OpenAI/Claude.

## Variables runtime

Web y worker requieren las mismas conexiones a infraestructura: `DATABASE_URL`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `REDIS_HOST`, `ANALYZE_QUEUE_NAME` y `GOOGLE_APPLICATION_CREDENTIALS`. También ambos requieren el mismo valor de `BYOK_ENCRYPTION_KEY` cuando comparten PostgreSQL.

La API web además usa las variables públicas `VITE_FIREBASE_*` para su bundle y el worker no necesita API keys de ningún proveedor.

## Arranque de referencia

```bash
docker run -d --name bill-lm-server -p 3001:3000 \
  --env-file /ruta/segura/bill-lm-server.env \
  -v /ruta/segura/firebase.json:/run/secrets/firebase.json:ro \
  bill-lm-server:latest

docker run -d --name bill-lm-worker \
  --env-file /ruta/segura/bill-lm-worker.env \
  -v /ruta/segura/firebase.json:/run/secrets/firebase.json:ro \
  bill-lm-worker:latest
```

El env file de ambos procesos debe contener `BYOK_ENCRYPTION_KEY` idéntica y apuntar `GOOGLE_APPLICATION_CREDENTIALS` al archivo montado. No incluyas API keys de usuarios en env files: se cifran en PostgreSQL a través de Ajustes.

## Migración BYOK

Antes de publicar una versión que use conexiones BYOK, toma backup de PostgreSQL y aplica la migración con la imagen o checkout de esa misma versión:

```bash
bun run db:deploy
```

La migración crea `provider_connections`. No uses `db push`. Después inicia server y worker con la misma raíz BYOK, crea una conexión de prueba desde Ajustes y comprueba `probe -> analyze`.

## Pipeline

`.github/workflows/deploy-build-push.yml` construye imágenes sin secretos runtime y, durante su smoke test, entrega `BYOK_ENCRYPTION_KEY` solo a los contenedores temporales. En el NAS, reproduce esa separación con un secret store o env files fuera del repositorio.
