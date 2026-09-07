# Desarrollo de Bill-LM

Esta guía reúne los requisitos y procedimientos para ejecutar, probar y operar
Bill-LM. El [README](README.md) explica el producto, su alcance actual y los
modos locales propuestos.

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

| Objetivo | Comando |
| --- | --- |
| Desarrollo web | `bun run dev` |
| Worker en desarrollo | `bun run worker:dev` |
| Typecheck | `bun run typecheck` |
| Tests unitarios | `bun run test` |
| Build | `bun run build` |
| Verificación completa | `bash health.sh` |
| Cliente Prisma | `bun run db:gen` |
| Migraciones autorizadas | `bun run db:deploy` |

`health.sh` usa `.env.health` y no carga credenciales reales. Ejecuta
typecheck, build, Vitest y Playwright. Puedes omitir Playwright con:

```bash
SKIP_E2E=true bash health.sh
```

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

## Más referencias

- [Índice de documentación](docs/README.md)
- [Arquitectura del flujo de análisis](docs/architecture/analysis-flow.md)
- [Prueba autenticada con proveedor real](docs/operations/analysis-real-provider-smoke-test.md)
- [Pruebas y límites de evidencia](docs/operations/testing-and-evidence.md)
