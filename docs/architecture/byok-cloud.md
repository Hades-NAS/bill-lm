# BYOK cloud

## Estado y límite

Esta fase habilita conexiones cloud de OpenAI y Claude por usuario. No incluye daemon local, GPU, MCP, historial de resultados ni rulesets. La identidad se toma del principal Firebase ya verificado; el navegador no envía `userId` ni recibe secretos.

## Configuración de despliegue

Todos los procesos que comparten la misma base PostgreSQL —web, worker y cualquier entorno que escriba conexiones— deben usar exactamente el mismo valor secreto de `BYOK_ENCRYPTION_KEY`. Es una cadena Base64 que representa 32 bytes y se configura solo en el entorno runtime del servidor. No se agrega a variables `VITE_`, a argumentos de Docker, ni al repositorio. La infraestructura heredada puede seguir llegando como build args para compatibilidad NAS; ver `DOCKER.md`.

Antes de desplegar, aplicar la migración versionada con el proceso normal de Prisma. No usar `db push`: la migración crea `provider_connections`, su enum y el índice parcial que garantiza una sola conexión predeterminada activa por usuario.

## Flujo

1. En **Configuración**, el usuario envía etiqueta, proveedor, modelo y API key por HTTPS una sola vez.
2. tRPC autentica el principal, cifra la clave con AES-256-GCM y guarda ciphertext, IV, tag, versión y últimos cuatro caracteres en PostgreSQL. El AAD ata el secreto a `userId`, `connectionId`, proveedor y versión.
3. La API pública devuelve únicamente metadatos: proveedor, modelo, estado, timestamps y últimos cuatro caracteres.
4. Al pulsar **Analizar**, el navegador envía opcionalmente el `credentialId`; si no lo hace, el servidor selecciona la conexión predeterminada activa. Sin conexión activa, se rechaza la operación y la UI dirige a Configuración.
5. BullMQ y Firestore transportan `credentialId`, `userId`, colección y trabajo; nunca la key.
6. El worker verifica de nuevo `collection -> user -> connection`, descifra solo en memoria, crea un cliente LLM nuevo para ese trabajo y ejecuta el análisis.

## Mapa técnico del código

Esta sección es el punto de partida para seguir el flujo en el repositorio. Los nombres son símbolos reales, no pseudocódigo.

```text
Ruta React /user
  src/routes/(private)/user.tsx
  └─ useTRPC().providerConnections.{list,create}
       └─ src/integrations/trpc/router.ts
            └─ providerConnectionsRouter
                 src/integrations/trpc/procedures/provider-connections/index.ts
                 ├─ Prisma: provider_connections
                 └─ AES-GCM: byok-crypto.server.ts

Ruta React /collections/$id
  src/routes/(private)/collections/$id.tsx
  └─ collections.analyze(AnalyzeCollectionRequestSchema)
       └─ collectionsRouter.analyze
            ├─ resolveConnection(userId, credentialId?)
            ├─ Firestore analyze-v1/{jobId} (DTO público)
            └─ BullMQ AnalyzeQueue (payload interno)
                 └─ jobHandler en integrations/jobs/analyze-job.ts
                      ├─ Prisma: collection + providerConnection
                      ├─ decryptProviderSecret(...)
                      ├─ new LLMProviderFactory().create(...)
                      └─ AnalyzeBillsUseCase.execute(...)
```

### Entrada, contratos y salidas

| Capa                  | Archivo/símbolo                                                     | Input admitido                                                                                       | Salida o efecto                                                              |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| UI de configuración   | `src/routes/(private)/user.tsx`                                     | proveedor, etiqueta, modelo y `apiKey`                                                               | Llama solamente a tRPC; no persiste claves en React.                         |
| Contrato de conexión  | `src/schema/provider-connections.ts`                                | `CreateProviderConnectionSchema`, `UpdateProviderConnectionSchema`, `RotateProviderConnectionSchema` | `ProviderConnectionPublicSchema` no contiene ciphertext, IV, tag ni API key. |
| API de conexiones     | `src/integrations/trpc/procedures/provider-connections/index.ts`    | Principal autenticado más input Zod                                                                  | Registros propios del usuario; devuelve solo `publicSelect`.                 |
| Criptografía          | `src/integrations/llm/byok-crypto.server.ts`                        | secreto en memoria y contexto                                                                        | `{ ciphertext, iv, authTag }`; descifra solo en proceso servidor.            |
| Contrato del análisis | `src/schema/collections.ts` / `AnalyzeCollectionRequestSchema`      | `collectionId`, preset, tipo, IDs y `credentialId?`                                                  | `AnalyzeJobData` tiene referencia, nunca API key.                            |
| API del análisis      | `src/integrations/trpc/procedures/collections/index.ts` / `analyze` | Principal + request validado                                                                         | Firestore + BullMQ y respuesta `{jobId, collectionId, collectionName}`.      |
| Worker                | `src/integrations/jobs/analyze-job.ts` / `jobHandler`               | `AnalyzeJobData` de BullMQ                                                                           | Cliente LLM nuevo y resultado de análisis; actualiza estado Firestore.       |

### Persistencia y campos

`prisma/schema.prisma` define `ProviderConnection`; la migración materializada es `prisma/migrations/20260903160000_add_provider_connections/migration.sql`.

| Dónde                             | Contiene                                                                                     | No contiene                           |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| PostgreSQL `provider_connections` | ownership (`userId`), proveedor/modelo, estado, ciphertext, IV, tag, versión, últimos cuatro | API key en claro.                     |
| BullMQ `AnalyzeJobData`           | `jobId`, `userId`, `credentialId`, datos de colección/facturas                               | ciphertext, IV, tag, API key.         |
| Firestore `analyze-v1/{jobId}`    | DTO de notificación, `firebaseUid`, `credentialId`, progreso                                 | `userId` interno y cualquier secreto. |
| Respuesta tRPC                    | metadatos públicos, IDs de job/colección                                                     | secretos criptográficos o API key.    |

### Bifurcaciones de código

1. `collectionsRouter.analyze` llama `resolveConnection(principal.userId, data.credentialId)`.
   - Si llega un `credentialId`, solo se acepta cuando pertenece al principal, está activo y no fue eliminado.
   - Si no llega, busca la conexión predeterminada activa del mismo usuario.
   - Si no hay una, lanza `PRECONDITION_FAILED`; la whitelist no interviene.
2. `jobHandler` vuelve a buscar **a la vez** colección y conexión por `userId` con `Promise.all`.
   - Si cualquiera desapareció, fue desactivada o pertenece a otro usuario, termina seguro sin fallback a `OPENAI_API_KEY`/`CLAUDE_API_KEY` globales.
3. Con autorización válida, `decryptProviderSecret` usa AAD `bill-lm:provider-connection:v1:userId:connectionId:provider:version`.
   - Cambiar usuario, ID, proveedor o versión hace que AES-GCM rechace el ciphertext.
4. `LLMProviderFactory.create` elige OpenAI o Claude y crea una instancia local al job. No hay cache ni singleton de clave de usuario.

### Operaciones tRPC exactas

`providerConnectionsRouter` expone `list`, `create`, `update`, `rotate`, `remove` y `probe`.

- `create`: genera UUID antes de cifrar, para incluirlo en AAD; la primera conexión pasa a default dentro de una transacción Prisma.
- `update`: permite etiqueta/modelo/estado/default y desmarca defaults previos en la misma transacción.
- `rotate`: incrementa `secretVersion`, cifra el nuevo material y reinicia el resultado del probe.
- `remove`: soft delete, desactiva, quita default y vacía ciphertext/IV/tag.
- `probe`: descifra en memoria, crea proveedor temporal y registra únicamente éxito o error genérico.

`src/integrations/llm/__tests__/byok-crypto.test.ts` cubre el AAD: cambiar propietario, conexión, proveedor o versión impide descifrar el mismo ciphertext.

La pantalla actual de Ajustes consume todas esas operaciones: lista/crea, edita etiqueta/modelo, marca default, activa/desactiva, ejecuta probe, rota y elimina. La API conserva la validación de ownership; ocultar o deshabilitar un control en Mantine no sustituye ese gate.

## Operaciones

El router `providerConnections` expone: listar, crear, actualizar etiqueta/modelo/estado/default, rotar, probe y eliminación lógica. Rotar incrementa la versión criptográfica. Eliminar borra los campos cifrados y bloquea usos futuros. El probe hace una llamada mínima al proveedor y registra solamente fecha o un mensaje genérico, sin respuesta ni secreto.

## Controles de seguridad

- No hay clave en BullMQ, Firestore, respuestas tRPC, DTOs públicos, telemetría ni logs.
- Un worker no acepta una conexión que no sea del mismo `userId` ni una colección de otro usuario.
- La whitelist de Firebase ya no autoriza el análisis; la conexión activa y propia es el gate funcional.
- Las ejecuciones ya encoladas sin `credentialId` fallan de forma segura y no caen al API key global heredado.

## Verificación pendiente de entorno

El código y contratos se pueden comprobar estáticamente. Para probar el flujo real se requiere aplicar la migración en una base no productiva, iniciar web y worker con la misma `BYOK_ENCRYPTION_KEY`, guardar una key de prueba, ejecutar probe y analizar una colección. No se debe usar una key real en tests ni en la consola del navegador.
