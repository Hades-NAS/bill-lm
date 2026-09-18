# Desarrollo de Bill-LM

Esta guía reúne los requisitos y procedimientos para ejecutar, probar y operar
Bill-LM. El [README](README.md) explica el producto, su alcance actual y los
límites de sus modos locales.

## Stack

- Bun y TypeScript.
- TanStack Start y React para la aplicación web.
- Prisma y PostgreSQL para datos de aplicación.
- Firebase Authentication y Firestore para identidad y progreso de trabajos.
- MinIO para archivos XML.
- BullMQ y Redis para la cola de análisis.
- OpenAI y Claude mediante conexiones aportadas por cada persona.

## Requisitos

- Bun 1.x.
- PostgreSQL, Redis y MinIO accesibles para el entorno elegido.
- Un proyecto Firebase con Email/Password y Google habilitados.
- Un service account de Firebase disponible solo para los procesos de servidor.

## Instalación y configuración local

1. Instala dependencias:

   ```bash
   bun install
   ```

2. Copia `.env.example` a `.env.local` y completa la configuración del entorno.
   No subas valores reales al repositorio.

3. Genera el cliente de Prisma y aplica las migraciones en la base autorizada:

   ```bash
   bun run db:gen
   bun run db:deploy
   ```

   Usa `db:deploy` para una base existente. No uses `db:push` ni `db:migrate`
   contra un entorno compartido o de producción.

4. Inicia la web y el worker en terminales distintas:

   ```bash
   bun run dev
   bun run worker:dev
   ```

La web corre en el puerto 3000 por defecto.

El comando de raíz delega al app root `apps/web`. También puedes ejecutar las
comprobaciones de la aplicación directamente desde ese workspace:

```bash
bun run --cwd apps/web typecheck
bun run --cwd apps/web test
bun run --cwd apps/web build
```

La configuración Vite, el servidor de producción, las rutas, la interfaz y el
artefacto `apps/web/dist` pertenecen a `apps/web`. La raíz solo delega los
comandos de comodidad y conserva la orquestación compartida.

## Visor y daemon locales

Este flujo es independiente de la aplicación web, PostgreSQL, Redis, MinIO y
Firebase. Después de ejecutar `bun install`, abre dos terminales desde la raíz
del repositorio.

En la primera, inicia el daemon que mantiene la biblioteca local y escucha solo
en `127.0.0.1:4318`:

```bash
bun run daemon:local
```

En la segunda, inicia el visor React. Vite lo publica en
`http://127.0.0.1:4319` y reenvía `/api` al daemon:

```bash
bun run dev:local
```

Abre `http://127.0.0.1:4319` en el navegador. La biblioteca se guarda en
`$XDG_DATA_HOME/bill-lm` o, si `XDG_DATA_HOME` no está definida, en
`~/.local/share/bill-lm`. Para usar otra ubicación, define
`BILL_LM_LOCAL_LIBRARY_DIR` con una ruta absoluta antes de iniciar el daemon:

`dev:local` delega al app root `apps/local-viewer`. Para revisar solamente el
visor, ejecuta `bun run --cwd apps/local-viewer typecheck`, `test` o `build`.

```bash
BILL_LM_LOCAL_LIBRARY_DIR=/ruta/absoluta/a/mis-facturas bun run daemon:local
```

Como verificación mínima, el daemon debe mostrar que escucha en
`http://127.0.0.1:4318`; después confirma la API y ejecuta la suite enfocada:

```bash
curl http://127.0.0.1:4318/api/v1/rulesets
bun run test:local
```

Usa `Ctrl+C` para detener cada proceso. Este flujo no inicia OAuth ni persiste
tokens OAuth; la integración de un agente local mediante OAuth sigue pendiente.
Perfiles, actividades y colecciones del visor usan exclusivamente la API Hono
local y SQLite, sin llamadas a la aplicación cloud.

## Variables de entorno

`.env.example` documenta las variables requeridas. Las categorías principales
son:

- `DATABASE_URL` para PostgreSQL.
- `MINIO_*` para almacenamiento de facturas.
- `GOOGLE_APPLICATION_CREDENTIALS` y `FIREBASE_*` para procesos de servidor.
- `VITE_FIREBASE_*` para la configuración pública del cliente Firebase.
- `BYOK_ENCRYPTION_KEY` para cifrar conexiones de proveedores. Web y worker que
  comparten base deben usar el mismo valor.
- `LLM_SMOKE_TEST` para recorrer el flujo sin enviar prompts ni generar consumo.
  Debe tener el mismo valor en web y worker.

Nunca pongas secretos en variables `VITE_*`, argumentos de build, código fuente
ni registros. Las claves de proveedores pertenecen a cada persona usuaria y la
app las cifra en el servidor.

## Comandos frecuentes

| Objetivo                 | Comando                |
| ------------------------ | ---------------------- |
| Desarrollo web           | `bun run dev`          |
| Worker en desarrollo     | `bun run worker:dev`   |
| Daemon local             | `bun run daemon:local` |
| Visor local              | `bun run dev:local`    |
| Pruebas del daemon local | `bun run test:local`   |
| Typecheck                | `bun run typecheck`    |
| Límites de workspace     | `bun run boundaries:check` |
| Tests unitarios          | `bun run test`         |
| Build                    | `bun run build`        |
| Verificación completa    | `bash health.sh`       |
| Cliente Prisma           | `bun run db:gen`       |
| Migraciones autorizadas  | `bun run db:deploy`    |

`health.sh` usa `.env.health` y no carga credenciales reales. Ejecuta
typecheck, build, Vitest y Playwright. Puedes omitir Playwright con:

```bash
SKIP_E2E=true bash health.sh
```

`boundaries:check` comprueba que no haya código de aplicación en la raíz ni
referencias desde `apps/*` o configuración hacia una antigua `src/`. Cada
responsabilidad pertenece a su app de composición o a `packages/*`; el
inventario final y sus regresiones viven en
[`scripts/legacy-root-source-manifest.json`](scripts/legacy-root-source-manifest.json).
La guía de propiedad del workspace está en
[`docs/architecture/physical-workspace-ownership.md`](docs/architecture/physical-workspace-ownership.md).

## Rulesets SRI

El flujo técnico de reglas es:

```text
check → fetch → extract → split → diff → revisión humana
      → promote → validate → build → sync:db → activate:db
```

El [README operativo de rulesets SRI](resources/tax-rules/ec/sri/README.md)
describe cada comando, sus validaciones y cómo seleccionar un entorno de base
de datos. La [referencia técnica de rulesets](docs/architecture/sri-rulesets-flujo-tecnico.md)
explica cómo la web, el servidor y el worker consumen un bundle activo.

## Docker y despliegue

[DOCKER.md](DOCKER.md) describe imágenes, variables runtime, smoke test y
migraciones para el despliegue. Mantén `BYOK_ENCRYPTION_KEY` fuera de la imagen
y compártela únicamente entre procesos que usen la misma base de datos.

El despliegue separa calidad (`Tests`/`tests`) de construcción, validación y
publicación (`Default`/`self-hosted`). Antes de mover el job de calidad, prueba
en el runner Tests: `PLAYWRIGHT_PORT=3100 GOOGLE_APPLICATION_CREDENTIALS=/home/cardor/secrets/bill-lm/bill-lm-firebase.json SKIP_E2E=true bash health.sh`.
Las cachés BuildKit de servidor y worker son independientes. Para revisar la
retención del registry, ejecuta manualmente el workflow **Registry Retention**
en `preview`; `apply` exige además confirmar exactamente `DELETE`. Conserva
tres tags de producción, tres `-dev` y `buildcache` por repositorio. La
eliminación de tags no ejecuta garbage collection ni garantiza liberar espacio:
esa ventana corresponde al NAS.

## Más referencias

- [Índice de documentación](docs/README.md)
- [Arquitectura del flujo de análisis](docs/architecture/analysis-flow.md)
- [Prueba autenticada con proveedor real](docs/operations/analysis-real-provider-smoke-test.md)
- [Pruebas y límites de evidencia](docs/operations/testing-and-evidence.md)
