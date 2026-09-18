# Despliegue Docker de Bill-LM

Por compatibilidad con el despliegue NAS actual, las imágenes reciben infraestructura (PostgreSQL, MinIO, Redis, cola y ruta del service account) como build args. Las claves API de proveedores y `BYOK_ENCRYPTION_KEY` no se incorporan a imágenes: se inyectan únicamente al iniciar cada contenedor.

## Construcción

```bash
docker build -f docker/Dockerfile \
  --build-arg DATABASE_URL=... \
  --build-arg MINIO_ENDPOINT=... \
  --build-arg MINIO_ACCESS_KEY=... \
  --build-arg MINIO_SECRET_KEY=... \
  --build-arg REDIS_HOST=... \
  --build-arg MINIO_BUCKET_NAME=... \
  --build-arg ANALYZE_QUEUE_NAME=... \
  --build-arg VITE_FIREBASE_API_KEY=... \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
  --build-arg VITE_FIREBASE_PROJECT_ID=... \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET=... \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=... \
  --build-arg VITE_FIREBASE_APP_ID=... \
  -t bill-lm-server:latest .

docker build -f docker/Dockerfile.worker -t bill-lm-worker:latest .
```

No uses `--build-arg` para `BYOK_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `CLAUDE_API_KEY` o cualquier API key de usuario.

## Variables runtime

Web y worker reciben las mismas conexiones a infraestructura desde la imagen. Ambos requieren el mismo valor runtime de `BYOK_ENCRYPTION_KEY` cuando comparten PostgreSQL.

La API web usa las variables públicas `VITE_FIREBASE_*` para su bundle. El worker no usa API keys de proveedores, pero comparte `apps/web/src/env.ts` con la web y esa validación exige `VITE_FIREBASE_*` al iniciar. Por tanto, inclúyelas también como build args de la imagen worker; son configuración pública de Firebase, no claves de proveedor ni de usuarios.

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

El env file de ambos procesos solo necesita `BYOK_ENCRYPTION_KEY` idéntica. Mantén montado el service account en la ruta que fue configurada durante el build. No incluyas API keys de proveedores ni de usuarios: las de usuarios se cifran en PostgreSQL a través de Ajustes.

## Smoke test sin consumo de LLM

Para comprobar el flujo de análisis sin enviar prompts ni generar consumo,
declara `LLM_SMOKE_TEST=true` en los entornos runtime de **server y worker**.
Ambos procesos deben tener exactamente el mismo valor; el worker bloquea la
ejecución si el snapshot creado por server no coincide. El worker aún descifra
la conexión BYOK y crea el cliente, pero sustituye la llamada al proveedor por
una respuesta fiscal determinista marcada como **Simulado** en el historial.

```yaml
services:
  server:
    environment:
      LLM_SMOKE_TEST: 'true'
  worker:
    environment:
      LLM_SMOKE_TEST: 'true'
```

Este modo no confirma que la API key sea válida, tenga permisos, ni que el
modelo esté disponible. Para volver a ejecuciones reales, elimina la variable
o usa `LLM_SMOKE_TEST=false` en ambos servicios y reinícialos.

## Migración BYOK

Antes de publicar una versión que use conexiones BYOK, toma backup de PostgreSQL y aplica la migración con la imagen o checkout de esa misma versión:

```bash
bun run db:deploy
```

La migración crea `provider_connections`. No uses `db push`. Después inicia server y worker con la misma raíz BYOK, crea una conexión de prueba desde Ajustes y comprueba `probe -> analyze`.

## Pipeline

`.github/workflows/deploy-build-push.yml` conserva la configuración de infraestructura en build args y entrega `BYOK_ENCRYPTION_KEY` solo a los contenedores temporales. En el NAS, pasa esa única raíz por secret store o env file fuera del repositorio.
