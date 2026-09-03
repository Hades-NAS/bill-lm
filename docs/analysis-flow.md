# Flujo de análisis de facturas

> Estado: implementación actual más la base de aislamiento de Fase 0.
> Actualizado: 2026-09-03.
>
> Este documento describe qué ocurre desde el clic en **Analizar colección** hasta que se guardan el resultado y el progreso. Distingue el comportamiento disponible hoy del comportamiento BYOK que todavía no existe, para no confundir diseño con funcionalidad desplegable.

## Resumen visual

```text
Usuario autenticado
  -> página de colección y modal Mantine
  -> tRPC collections.analyze
  -> valida autorización + colección + selección de facturas
  -> Firestore: notificación/progreso
  -> BullMQ/Redis: trabajo interno
  -> worker: proveedor LLM nuevo para ese job
  -> caso de uso + servicio de análisis
  -> MinIO: XML original -> parser -> factura normalizada actual
  -> prompt -> proveedor LLM -> { percentage, reason }
  -> Prisma/PostgreSQL: actualiza BillHeader
  -> Firestore: progreso, telemetría y estado final
  -> onSnapshot del navegador: actualiza Zustand/UI
```

## Qué debe estar funcionando antes de analizar

La aplicación no analiza directamente desde el navegador. Para que un clic pueda terminar correctamente deben estar disponibles estas piezas del servidor:

| Pieza | Uso en el flujo | Configuración relevante |
| --- | --- | --- |
| Firebase Auth + Admin SDK | La tRPC privada deriva `Principal`; Firestore publica el progreso. | Variables `VITE_FIREBASE_*` para web y `GOOGLE_APPLICATION_CREDENTIALS` para servidor. |
| PostgreSQL/Prisma | Comprueba propiedad de la colección, encuentra facturas y guarda la proyección final. | `DATABASE_URL`. |
| MinIO | Recupera el original por `storagePath`. | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`. |
| Redis/BullMQ | Recibe y entrega el job al worker. | `REDIS_HOST`, `REDIS_PORT`, `ANALYZE_QUEUE_NAME`. |
| Proceso web | Sirve UI y API tRPC. | `bun run dev` o imagen server. |
| Proceso worker | Consume la misma cola y llama al proveedor. | `bun run worker:dev` o imagen worker. |
| Proveedor LLM actual | OpenAI, Claude o LM Studio; se resuelve por job. | `LLM_PROVIDER` y variables del proveedor. |

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
collectionId, collectionName, instructions?, preset?, type, billIds
```

El servidor sigue este orden:

1. Deriva `principal` de la sesión Firebase verificada por el middleware tRPC.
2. Ejecuta la autorización funcional actual: `checkUserCanAnalyzeCollection` consulta `config-v1/whitelist` en Firestore.
   - documento inexistente: `FORBIDDEN`;
   - whitelist deshabilitada: permite;
   - usuario o email incluido: permite;
   - resto: `FORBIDDEN`.
3. Busca la colección por `id` **y** `userId`; si no pertenece al usuario responde `NOT_FOUND`.
4. Selecciona facturas según `type`:
   - `all`: todas las de la colección;
   - `missing`: donde `percentage` y `reason` son `null`;
   - `analyzed`: donde alguno de esos dos campos ya tiene valor;
   - `specific`: solo IDs solicitados que pertenecen a la colección.
5. Si no quedaron facturas, responde `BAD_REQUEST`.
6. Construye `AnalyzeJobData` con IDs, instrucciones, preset, contadores iniciales y `credentialId: null`.
7. Escribe una versión pública del job en Firestore `analyze-v1/{jobId}`. La variante pública elimina el `userId` interno y añade `firebaseUid` para que el navegador pueda suscribirse.
8. Encola el payload interno en BullMQ con `AnalyzeQueue.add`.
9. Devuelve al navegador únicamente `jobId`, `collectionId` y `collectionName`.

### Límite de secretos de Fase 0

`credentialId` es una referencia opaca y actualmente es `null`: todavía no hay conexiones BYOK persistidas. Una API key no forma parte del schema del job, documento de Firestore, telemetría ni respuesta tRPC. Los schemas Zod descartan campos extra y el logger redacta campos sensibles y patrones conocidos de keys.

La clave de despliegue existente sigue estando únicamente en las variables del worker para mantener el comportamiento anterior. En Fase 1, el worker resolverá un secreto cifrado a partir de `credentialId`, después de comprobar propiedad; jamás se añadirá la key al job.

## Worker y proveedor por ejecución

El worker (`src/integrations/jobs/analyze-job.ts`) escucha `ANALYZE_QUEUE_NAME` mediante BullMQ. Cuando recibe un trabajo:

1. Extrae `jobId`, `billIds` y preset del payload.
2. Llama `createEnvironmentLLMProvider(env)`. Hoy consulta la selección de proveedor de Firebase (`config-v1/llm-provider-config`) y, si no existe o es inválida, usa `LLM_PROVIDER` del entorno.
3. Construye un proveedor **nuevo** para este job. No hay singleton compartido entre jobs.
4. Construye `AnalyzeBillsUseCase(provider)` y ejecuta los IDs de factura.
5. Al terminar, marca el documento Firestore como `completed` si no hubo fallos o `failed` si hubo al menos uno.
6. Si el caso de uso lanza un error, escribe `failed` y el mensaje de error en Firestore; el handler devuelve `null`.

Ramas del proveedor actual:

| `LLM_PROVIDER` | Variables utilizadas | Comportamiento |
| --- | --- | --- |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL_ID`, `OPENAI_PROJECT_ID?`, `OPENAI_ORGANIZATION?` | Crea un `OpenAI` y un `OpenAIChatCompletionsModel` propios del proveedor de ese job. |
| `claude` | `CLAUDE_API_KEY`, `CLAUDE_MODEL_ID` | Crea un cliente Anthropic propio y usa Messages API. |
| `lm-studio` | `LLM_BASE_URL`, `MODEL_KEY` | Crea cliente OpenAI-compatible propio; puede comprobar/cargar el modelo local. |

OpenAI y LM Studio ya no llaman `setDefaultOpenAIClient`: la configuración del SDK no se comparte globalmente. La prueba de concurrencia verifica que dos ejecuciones crean proveedores y clientes distintos.

## Caso de uso y análisis de cada factura

`AnalyzeBillsUseCase` prepara el contexto `{ jobId, userId, collectionId, collectionName, preset, instructions }` y entrega el proveedor inyectado a `BillAnalysisService`.

El servicio ejecuta esta secuencia:

1. Comprueba si el modelo está cargado. Para OpenAI/Claude es un no-op; LM Studio puede cargarlo con reintentos.
2. Busca los `BillHeader` solicitados en PostgreSQL y obtiene `id`, `billType` y `storagePath`.
3. Para cada factura, recupera el objeto de MinIO y ejecuta `parseAndValidateInvoiceXML`.
4. Si el XML no puede leerse o validarse, agrega un resultado fallido para esa factura y continúa con las demás.
5. Convierte XML válido en `ParsedBill`: proveedor, identificador/comprador, líneas, totales y tipo (`PERSONAL`, `PROFESSIONAL` u `OTHER`).
6. Construye el prompt v1. Incluye proveedor, descripciones de ítems, totales, tipo de factura y, si es `PROFESSIONAL`, las instrucciones personalizadas de la colección.
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

| Momento | Condición | Resultado actual |
| --- | --- | --- |
| Antes del modal | No hay facturas o `canAnalyze` es falso | Botón deshabilitado. |
| tRPC | Sesión inválida | Middleware privado rechaza. |
| tRPC | Whitelist ausente/no coincide | `FORBIDDEN`; sigue siendo la autorización de hoy. |
| tRPC | Colección de otro usuario | `NOT_FOUND`. |
| tRPC | Selección vacía | `BAD_REQUEST`. |
| Worker | No existe config de proveedor válida o falta variable necesaria | El job falla antes de analizar. |
| Servicio | No hay `BillHeader` encontrados | Error de base de datos; job fallido. |
| Por factura | MinIO/XML inválido o proveedor devuelve error | Esa factura falla; las demás continúan. |
| Firestore de progreso | La actualización falla | Se registra el fallo, pero no se detiene el análisis. |
| Al final | Hubo una o más facturas fallidas | El worker marca el job `failed`, aunque sí puede haber filas actualizadas exitosamente. |

## Limitaciones explícitas del flujo actual

- Aunque la carga acepta `application/pdf`, el worker intenta parsear el contenido como XML. PDF no está soportado de forma real.
- `BillHeader.percentage` y `reason` son una proyección sobrescrita: no existe historial de `AnalysisRun`/`AnalysisResult` todavía.
- El prompt incorpora reglas fijas de gastos personales 2026. No hay rulesets versionados ni verificación de vigencia.
- La whitelist continúa siendo la autorización funcional hasta Fase 1.
- No hay CRUD, probe, rotación, cifrado de sobre ni selección de conexiones OpenAI/Claude por usuario.
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

## Próximo cambio: Fase 1 BYOK

Fase 1 conectará el campo `credentialId` con una conexión cifrada propiedad del usuario. Antes de encolar, el servidor verificará que la conexión esté activa y sea compatible. El worker repetirá la verificación por `collection -> user -> connection`, descifrará el secreto solo para el proveedor de ese job y lo descartará al terminar. La UI sustituirá el bloqueo por whitelist con la guía **Configurar proveedor**. Nada de eso está implementado aún.
