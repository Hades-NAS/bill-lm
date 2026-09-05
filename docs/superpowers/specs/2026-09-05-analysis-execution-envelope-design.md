# Envelope de ejecución y evidencia oficial para análisis V2

## Objetivo

Hacer reproducible cada análisis antes de construir los prompts V2. Un
`AnalysisRun` debe conservar exactamente los hechos y el material que podrá
llegar al modelo: no solo IDs que luego se vuelven a resolver contra datos
vivos.

Esta especificación corresponde a F3-01. No cambia todavía el formato de la
respuesta del modelo, la proyección legacy ni la UI de historial.

## Decisión

Se persiste un `AnalysisExecutionEnvelopeV2` completo dentro de
`AnalysisRun.inputSnapshot`. Incluye el Markdown normalizado exacto de los
fragmentos oficiales y de las referencias autogestionadas seleccionadas.

No se guarda XML crudo, PDFs, API keys, ciphertexts, ni identificadores
personales que no hagan falta para el análisis. Los objetos originales siguen
en MinIO y los hashes permiten detectar que una copia cambió.

La alternativa de guardar solo IDs y volver a leer la base fue descartada:
no permite reproducir el análisis si cambian reglas, referencias o facturas.
Archivar el material en nuevas tablas u objetos es una optimización posterior,
no necesaria para este MMVP.

## Modelo del envelope

El contrato mantiene `schemaVersion: "v2"` para ser compatible con los
contratos tributarios existentes y añade `envelopeVersion: "1"` para permitir
evoluciones independientes.

```text
AnalysisExecutionEnvelopeV2
  schemaVersion: "v2"
  envelopeVersion: "1"
  prompt
    templateId + templateVersion + templateHash (SHA-256)
  context
    collectionContextRevisionId + revision
    purpose
    period { startDate, endDate }
    notes?
  taxpayerProfile
    revisionId + revision + facts necesarios para el propósito
  activities[]
    revisionId + revision + facts declarados
  provider
    connectionId + provider + modelId
  ruleset
    id + version + contentHash + effective dates
  officialEvidence[]
    ruleSetFragmentId + fragmentId + fragmentContentHash
    source { id, title, issuer, officialUrl, contentHash }
    articleOrSection + purposes + taxRegimes + effective dates + markdown
  userReferences[]
    id + name + normalizedMarkdown + contentHash
  invoices[]
    billId + contentHash + parserVersion + normalized invoice facts
```

Los datos fiscales de perfil y actividad son los campos autogestionados que
fueron seleccionados por el usuario, no conclusiones del SRI. Para
`personal_expenses`, `activities` puede ser una lista vacía; para IVA e IR de
actividad se conserva al menos una revisión de actividad.

Los datos del proveedor excluyen por completo la clave y los campos cifrados.
El job BullMQ conserva únicamente `analysisRunId`, `credentialId` y los IDs
operativos ya permitidos; el envelope no se copia a Firestore ni a la cola.

## Selección determinista

Una única función de dominio/servidor reemplaza la consulta Prisma duplicada
del endpoint y el armado ad hoc del worker.

1. Selecciona un `TaxRuleSet` con estado `active` que coincida con propósito,
   régimen, periodicidad y todo el período civil.
2. Si hay más de uno, ordena por `effectiveFrom` descendente, `version`
   descendente e `id` ascendente.
3. Obtiene solo los `TaxRuleSetFragment` vinculados a ese ruleset.
4. Descarta fragmentos fuera de vigencia o cuyo propósito/régimen no coincida
   con el selector.
5. Ordena por fuente, artículo/sección e ID de fragmento para obtener una
   lista estable.
6. Materializa fuente, metadatos, hash y Markdown en `officialEvidence`.

Las actividades no se usarán para eliminar fragmentos mientras el modelo de
fragmentos no tenga una clasificación humana y versionada de aplicabilidad por
actividad. Inventar esa relación desde palabras clave sería una conclusión
tributaria no auditable. Las actividades sí quedan congeladas en el envelope y
serán insumo del prompt V2.

El selector devuelve un error bloqueante si el ruleset no existe, no está
vigente o no deja evidencia aplicable. Nunca descarga PDFs ni consulta
Internet durante un análisis.

## Presupuesto de evidencia

No se trunca un artículo ni se resume normativa de manera automática. Antes de
encolar, se calcula el tamaño del envelope y se compara contra un límite
configurable de caracteres para evidencia oficial y referencias de usuario.

Si la selección completa supera el límite, el análisis queda bloqueado con un
código estable y un mensaje accionable; el owner debe publicar un ruleset más
acotado o revisar su curaduría. Así se controla costo sin ocultar excepciones
o condiciones al modelo. F3-02 traducirá ese mismo presupuesto a la ventana de
contexto del proveedor elegido.

## Flujo

```text
colección + facturas
  -> selector de ruleset/evidencia
  -> normalizador de referencias del usuario
  -> snapshot de facturas normalizadas
  -> metadata inmutable del template de prompt V2
  -> AnalysisExecutionEnvelopeV2
  -> AnalysisRun + AnalysisRunInvoice (transacción)
  -> BullMQ solo con IDs opacos
  -> worker carga el envelope fijo
  -> F3-02 construye prompt V2 desde ese envelope
```

El worker no debe volver a cargar Markdown, referencias o fragmentos para
armar el prompt. Podrá consultar estado y propiedad en el gate de F3-03, pero
un cambio posterior no modifica el contenido fijado en el run.

## Errores y compatibilidad

- `MISSING_APPLICABLE_RULESET`: no existe ruleset activo compatible.
- `NO_APPLICABLE_OFFICIAL_EVIDENCE`: el ruleset no produce fragmentos vigentes
  para el selector.
- `ANALYSIS_CONTEXT_EXCEEDS_BUDGET`: el material completo excede el límite;
  no se llama al LLM.
- Los runs ya persistidos con el snapshot anterior siguen siendo legibles como
  legado y no se reescriben. Solo nuevos runs usan `envelopeVersion: "1"`.
- Las referencias autogestionadas son opcionales; ausencia de ellas no bloquea
  un análisis que ya cuenta con ruleset oficial aplicable.

## Archivos y límites de cambio

Se prevén cambios en:

- `src/schema/tax-analysis-v2.ts`: schemas del envelope, evidencia y errores.
- `src/integrations/tax-rules/selector.ts`: selección única y desempate estable.
- una nueva integración de envelope/snapshot para cargar y materializar datos.
- `src/integrations/trpc/procedures/collections/index.ts`: construir el
  envelope transaccionalmente antes de encolar.
- `src/integrations/jobs/analyze-job.ts`: consumir el envelope persistido en
  vez de referencias vivas.
- pruebas unitarias y de procedimiento para selección, snapshots y errores.

No se alteran los bundles publicados, sus hashes, la migración de fuentes, ni
los objetos originales de MinIO. F3-02 implementará el prompt; F3-03 el gate
doble; F3-04 el resultado especializado.

## Pruebas requeridas

1. Mismo selector y candidatos producen el mismo ruleset ante empates.
2. Un fragmento fuera de vigencia, propósito o régimen no entra al envelope.
3. `personal_expenses` admite cero actividades; IVA e IR de actividad no.
4. Cambiar un fragmento, referencia o factura después de encolar no cambia el
   envelope usado por el worker.
5. El envelope no contiene secretos ni XML/PDF crudo.
6. Exceso de presupuesto bloquea antes de encolar y antes de invocar un LLM.
7. El envelope conserva ID, versión y hash SHA-256 del template V2 sin incluir
   secretos ni configuración privada del proveedor.
