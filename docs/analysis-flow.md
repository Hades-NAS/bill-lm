# Flujo de análisis de facturas

> Estado: flujo cloud con BYOK de Fase 1 y referencias fiscales autogestionadas de Fase 2-A implementados en código; ver [BYOK cloud](./byok-cloud.md) para el mapa técnico de credenciales, contratos y bifurcaciones.
> Actualizado: 2026-09-03.
>
> Este documento describe qué ocurre desde el clic en **Analizar colección** hasta que se guardan el resultado y el progreso. La sección BYOK es comportamiento actual de código; aún falta comprobarlo contra servicios reales tras aplicar la migración.

## Resumen visual

```text
Usuario autenticado
  -> página de colección y modal Mantine
  -> tRPC collections.analyze
  -> valida autorización + conexión BYOK + referencias fiscales + selección de facturas
  -> Firestore: notificación/progreso
  -> BullMQ/Redis: trabajo interno
  -> worker: proveedor LLM nuevo para ese job
  -> caso de uso + servicio de análisis
  -> MinIO: Markdown de referencias autogestionadas + XML original -> parser -> factura normalizada actual
  -> prompt -> proveedor LLM -> { percentage, reason }
  -> Prisma/PostgreSQL: actualiza BillHeader
  -> Firestore: progreso, telemetría y estado final
  -> onSnapshot del navegador: actualiza Zustand/UI
```

## Qué debe estar funcionando antes de analizar

La aplicación no analiza directamente desde el navegador. Para que un clic pueda terminar correctamente deben estar disponibles estas piezas del servidor:

| Pieza                     | Uso en el flujo                                                                       | Configuración relevante                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Firebase Auth + Admin SDK | La tRPC privada deriva `Principal`; Firestore publica el progreso.                    | Variables `VITE_FIREBASE_*` para web y `GOOGLE_APPLICATION_CREDENTIALS` para servidor. |
| PostgreSQL/Prisma         | Comprueba propiedad de la colección, encuentra facturas y guarda la proyección final. | `DATABASE_URL`.                                                                        |
| MinIO                     | Recupera el original por `storagePath`.                                               | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`.         |
| Redis/BullMQ              | Recibe y entrega el job al worker.                                                    | `REDIS_HOST`, `REDIS_PORT`, `ANALYZE_QUEUE_NAME`.                                      |
| Proceso web               | Sirve UI y API tRPC.                                                                  | `bun run dev` o imagen server.                                                         |
| Proceso worker            | Consume la misma cola y llama al proveedor.                                           | `bun run worker:dev` o imagen worker.                                                  |
| Proveedor LLM cloud       | OpenAI o Claude, resuelto por `credentialId` en cada job.                             | `BYOK_ENCRYPTION_KEY` compartida por web/worker.                                       |
| Referencias fiscales      | Material global autoaprobado del usuario, usado como contexto de prompt.              | Hasta tres Markdown o PDFs con texto; se normalizan y guardan en MinIO.                |

El archivo que valida el contrato real de variables es `src/env.ts`. `.env.example` todavía usa nombres antiguos como `LLM_API_KEY` y menciona Clerk; no es una fuente fiable para el flujo actual. Debe alinearse en una tarea separada antes de usarlo como guía de despliegue.

## Punto de entrada en la interfaz

La página `src/routes/(private)/collections/$id.tsx` carga la colección y consulta `collections.checkUserCanAnalyze`.

1. El botón **Analizar colección** solo se habilita si hay colección, al menos una factura y `canAnalyze` es verdadero.
2. Al abrirse el modal, el usuario elige el preset: `strict`, `balanced` o `creative`.
3. La interfaz calcula el estado actual a partir de `BillHeader.percentage`:
   - ninguna analizada: ofrece **Analizar** (`type: all`);
   - parcialmente analizada: ofrece **Analizar pendientes** (`type: missing`) y **Re-analizar todo** (`type: all`);
   - todas analizadas: ofrece **Re-analizar todo** (`type: all`).
4. `analyzeByType` invoca `useAnalyzeCollectionMutation`, que usa la mutación tRPC `collections.analyze`.

El botón no es una frontera de seguridad. La tRPC vuelve a comprobar identidad, autorización y propiedad.

## API: validación y creación del job

`collections.analyze` recibe `AnalyzeCollectionRequestSchema`:

```text
collectionId, collectionName, instructions?, preset?, type, billIds, credentialId?
```

El servidor sigue este orden:

1. Deriva `principal` de la sesión Firebase verificada por el middleware tRPC.
2. Ejecuta `resolveConnection`: acepta una conexión activa propia indicada por `credentialId`, o la predeterminada activa del usuario. Si no existe, responde `PRECONDITION_FAILED`.
3. Exige al menos una referencia fiscal autogestionada activa del mismo usuario; si no existe, responde `PRECONDITION_FAILED`.
4. Busca la colección por `id` **y** `userId`; si no pertenece al usuario responde `NOT_FOUND`.
5. Selecciona facturas según `type`:
   - `all`: todas las de la colección;
   - `missing`: donde `percentage` y `reason` son `null`;
   - `analyzed`: donde alguno de esos dos campos ya tiene valor;
   - `specific`: solo IDs solicitados que pertenecen a la colección.
6. Si no quedaron facturas, responde `BAD_REQUEST`.
7. Construye `AnalyzeJobData` con IDs, instrucciones, preset, contadores iniciales y el `credentialId` de la conexión autorizada.
8. Escribe una versión pública del job en Firestore `analyze-v1/{jobId}`. La variante pública elimina el `userId` interno y añade `firebaseUid` para que el navegador pueda suscribirse.
9. Encola el payload interno en BullMQ con `AnalyzeQueue.add`.
10. Devuelve al navegador únicamente `jobId`, `collectionId` y `collectionName`.

### Límite de secretos de Fase 0

`credentialId` es una referencia opaca a `provider_connections`. Una API key no forma parte del schema del job, documento de Firestore, telemetría ni respuesta tRPC. El worker resuelve el secreto cifrado a partir de esta referencia y lo conserva únicamente en memoria durante la llamada al proveedor.

## Worker y proveedor por ejecución

El worker (`src/integrations/jobs/analyze-job.ts`) escucha `ANALYZE_QUEUE_NAME` mediante BullMQ. Cuando recibe un trabajo:

1. Extrae `jobId`, `billIds` y preset del payload.
2. Busca conexión y colección con el mismo `userId`, exige conexión activa/no eliminada y descifra el secreto con AES-GCM.
3. Vuelve a exigir referencias fiscales activas propias y descarga solo sus Markdown normalizados desde MinIO. El contenido no entra en Firestore, BullMQ ni telemetría.
4. Construye un proveedor **nuevo** para este job. No hay singleton compartido entre jobs ni fallback a una key global.
5. Construye `AnalyzeBillsUseCase(provider)` y ejecuta los IDs de factura con ese contexto autogestionado.
6. Al terminar, marca el documento Firestore como `completed` si no hubo fallos o `failed` si hubo al menos uno.
7. Si el caso de uso lanza un error, escribe `failed` y el mensaje de error en Firestore; el handler devuelve `null`.

Ramas del proveedor actual:

| Conexión BYOK | Datos utilizados                           | Comportamiento                                                      |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| `OPENAI`      | modelo y secreto descifrado de la conexión | Crea un `OpenAI` y un `OpenAIChatCompletionsModel` propios del job. |
| `CLAUDE`      | modelo y secreto descifrado de la conexión | Crea un cliente Anthropic propio y usa Messages API.                |

OpenAI y LM Studio ya no llaman `setDefaultOpenAIClient`: la configuración del SDK no se comparte globalmente. La prueba de concurrencia verifica que dos ejecuciones crean proveedores y clientes distintos.

## Caso de uso y análisis de cada factura

`AnalyzeBillsUseCase` prepara el contexto `{ jobId, userId, collectionId, collectionName, preset, instructions }` y entrega el proveedor inyectado a `BillAnalysisService`.

El servicio ejecuta esta secuencia:

1. Comprueba si el modelo está cargado. Para OpenAI/Claude es un no-op; LM Studio puede cargarlo con reintentos.
2. Busca los `BillHeader` solicitados en PostgreSQL y obtiene `id`, `billType` y `storagePath`.
3. Para cada factura, recupera el objeto de MinIO y ejecuta `parseAndValidateInvoiceXML`.
4. Si el XML no puede leerse o validarse, agrega un resultado fallido para esa factura y continúa con las demás.
5. Convierte XML válido en `ParsedBill`: proveedor, identificador/comprador, líneas, totales y tipo (`PERSONAL`, `PROFESSIONAL` u `OTHER`).
6. Construye el prompt v1. Incluye proveedor, descripciones de ítems, totales, tipo de factura, referencias fiscales autogestionadas y, si es `PROFESSIONAL`, las instrucciones personalizadas de la colección. No presenta esas referencias como normativa oficial ni como un dictamen jurídico.
7. Invoca `provider.process` detrás de un circuit breaker. El resultado esperado es exactamente `{ percentage: 0..100, reason: string }`.
8. Valida la salida Zod, agrega versión de prompt, preset y timestamp. Si falla la llamada, el output o la validación, registra fallo para esa factura y continúa.
9. Tras procesar el lote, abre una transacción Prisma y actualiza los `BillHeader` exitosos con `percentage`, `reason` y `updatedAt`.

La ejecución por factura es secuencial dentro de un job; el parsing previo de los XML se hace con `Promise.all`. Los resultados parciales se preservan: un XML o una llamada LLM fallida no cancela las otras facturas del mismo job.

## Progreso, telemetría y vuelta al navegador

Después de cada análisis exitoso, el servicio calcula `(completadas / total) * 100` y actualiza el documento `analyze-v1/{jobId}`:

```text
pending -> in-progress -> completed
                     \-> failed
```

Los proveedores registran telemetría por llamada en `telemetry-v1`: job/bill IDs, tokens, modelo, preset, temperatura, duración, intentos, estado y versión de prompt. También incrementan `totalTokens` y `callCount` del job. La telemetría no tiene un campo de API key.

En el navegador, `useJobsSubscriptionManager` abre una única suscripción Firestore filtrada por `firebaseUid`, estados conocidos y `read: false`. Convierte timestamps, actualiza Zustand y, al completarse/fallar, invalida consultas de colección. Por eso la pantalla termina mostrando los valores nuevos de `percentage` y `reason` sin que el worker responda directamente al navegador.

## Condiciones y fallos que conviene reconocer

| Momento               | Condición                                          | Resultado actual                                                                        |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Antes del modal       | No hay facturas o `canAnalyze` es falso            | Botón deshabilitado.                                                                    |
| tRPC                  | Sesión inválida                                    | Middleware privado rechaza.                                                             |
| tRPC                  | No hay conexión activa propia/default              | `PRECONDITION_FAILED` y la UI ofrece Configurar proveedor.                              |
| tRPC                  | Colección de otro usuario                          | `NOT_FOUND`.                                                                            |
| tRPC                  | Selección vacía                                    | `BAD_REQUEST`.                                                                          |
| Worker                | La conexión, colección o propiedad ya no es válida | El job falla antes de analizar, sin usar una clave global.                              |
| Servicio              | No hay `BillHeader` encontrados                    | Error de base de datos; job fallido.                                                    |
| Por factura           | MinIO/XML inválido o proveedor devuelve error      | Esa factura falla; las demás continúan.                                                 |
| Firestore de progreso | La actualización falla                             | Se registra el fallo, pero no se detiene el análisis.                                   |
| Al final              | Hubo una o más facturas fallidas                   | El worker marca el job `failed`, aunque sí puede haber filas actualizadas exitosamente. |

## Limitaciones explícitas del flujo actual

- Aunque la carga acepta `application/pdf`, el worker intenta parsear el contenido como XML. PDF no está soportado de forma real.
- `BillHeader.percentage` y `reason` son una proyección sobrescrita: no existe historial de `AnalysisRun`/`AnalysisResult` todavía.
- Fase 2-A no crea snapshots inmutables ni proveniencia histórica del Markdown usado por cada ejecución. Las referencias activas se vuelven a resolver al ejecutar el worker; el historial versionado pertenece a una fase posterior.
- El prompt usa las referencias fiscales autogestionadas activas del usuario y las instrucciones de la colección. No hay rulesets oficiales/versionados ni verificación de vigencia en Fase 2-A.
- Hay conexión cifrada, selección por ejecución, default y autorización por ownership. La UI de Ajustes ya permite crear, seleccionar como predeterminada, activar/desactivar, probar, rotar y eliminar conexiones.
- El resultado no es dictamen tributario ni prueba de elegibilidad legal.

## Despliegue y operación

### Procesos que deben desplegarse juntos

La aplicación web/API y el worker son procesos distintos. Ambos necesitan acceso al mismo PostgreSQL, MinIO, Firebase, Redis y conjunto de configuración. Levantar solo el servidor web permite crear jobs, pero no consumirlos.

La CI actual (`.github/workflows/deploy-build-push.yml`) hace:

1. `bun install --frozen-lockfile` y `bash health.sh` con E2E omitido en el job de calidad.
2. Construye imágenes server y worker.
3. Valida imágenes y publica/despliega según las etapas posteriores del workflow.

### Riesgo de migración BYOK que debe corregirse en Fase 1

El workflow y los Dockerfiles actuales pasan secretos de infraestructura y `OPENAI_API_KEY` como `--build-arg`. Eso es aceptable solo como descripción del legado actual, no como diseño BYOK: puede dejar un secreto en capas/metadatos de imagen. La migración BYOK debe eliminar las API keys cloud globales de build args, imágenes y despliegue; los secretos de usuario se descifrarán solo en memoria del worker, justo antes de invocar el proveedor.

## Cómo comprobar el flujo

Validación estática y de interfaz:

```bash
bash health.sh
```

Incluye typecheck, build, Vitest y Playwright. No demuestra por sí solo Redis, MinIO, Firestore, una cuenta Firebase ni un proveedor LLM reales.

Para evidencia de ejecución real se necesita un entorno configurado, ambos procesos activos, una colección propia con XML válido y una credencial del proveedor disponible para el worker. Entonces se debe verificar:

1. la mutación devuelve `jobId`;
2. aparece el documento `analyze-v1/{jobId}` sin secrets;
3. BullMQ consume el job sin secrets;
4. cambian progreso y estado;
5. se actualizan solo los `BillHeader` de la colección propia;
6. la telemetría no contiene API keys.

## Evidencia pendiente

El código ha sido compilado y probado estáticamente. Falta evidencia de integración: aplicar la migración, iniciar web/worker con la misma raíz de cifrado, hacer `create -> probe -> analyze` con una key de prueba, e inspeccionar PostgreSQL, BullMQ, Firestore y telemetría para confirmar que no aparece un secreto.
