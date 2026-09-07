# Contexto tributario, actividades y rulesets para análisis de facturas

## Estado y propósito

Este documento define cómo Bill-LM debe analizar facturas de una persona natural
que puede tener únicamente ingresos en relación de dependencia, únicamente
ingresos mediante RUC, o ambos al mismo tiempo. Es una corrección y ampliación
del trabajo en progreso de perfiles, actividades y contratos de análisis V2.

La decisión central es separar tres elementos que no son intercambiables:

1. **Situación del contribuyente:** hechos declarados por la persona, como tener
   ingresos en relación de dependencia, RUC, régimen y obligaciones.
2. **Actividad económica:** bienes o servicios que generan ingresos mediante el
   RUC y las compras que el usuario considera relacionadas.
3. **Reglas tributarias:** contenido oficial curado, versionado y vigente que se
   selecciona por propósito y período; no forma parte de la actividad.

El sistema ofrece orientación y trazabilidad. No presenta el resultado del LLM
como decisión del SRI ni sustituye revisión contable o tributaria profesional.

## Alcance aprobado

La interfaz conserva un único botón **Analizar**, con dos opciones macro:

```text
Analizar facturas
├── Declaración de IVA
│   └── Crédito tributario de IVA
└── Impuesto a la Renta
    ├── Gastos de actividades económicas
    └── Gastos personales
```

Internamente existen exactamente tres propósitos ejecutables:

| Propósito             | Etiqueta de producto                 | Actividades requeridas |
| --------------------- | ------------------------------------ | ---------------------- |
| `vat_credit`          | Declaración de IVA                   | Una o más              |
| `business_income_tax` | IR: gastos de actividades económicas | Una o más              |
| `personal_expenses`   | IR: gastos personales                | Ninguna                |

No existe un propósito genérico `other`. Una configuración incompleta o
desconocida bloquea la ejecución antes de llamar al modelo.

Quedan fuera de este alcance el cálculo completo o presentación de declaraciones,
la proyección anual entregada al empleador, el acceso al portal SRI, la asesoría
tributaria automática y la determinación definitiva de obligaciones.

## Correcciones conceptuales

### Relación de dependencia no es una actividad económica

La relación de dependencia pertenece al perfil tributario. No se representa como
`EconomicActivity`, porque no describe una actividad que la persona factura con
su RUC. El empleador puede efectuar retenciones de Impuesto a la Renta; no se
modela como retención de IVA sobre el sueldo.

Una misma revisión de perfil puede declarar simultáneamente:

```text
ingresos en relación de dependencia = sí
RUC = sí
actividades = [desarrollo de software, consultoría]
```

### Tener RUC no determina por sí solo la periodicidad de IVA

El perfil conserva la obligación declarada por el usuario o verificada desde un
documento autorizado. No se infiere periodicidad a partir del nombre de la
actividad. La configuración mínima debe distinguir:

- sin obligación de IVA;
- declaración mensual;
- declaración semestral;
- periodicidad desconocida, que bloquea `vat_credit` hasta ser resuelta.

El régimen y la periodicidad se versionan porque pueden cambiar entre períodos.

### Los tres resultados tienen efectos distintos

`vat_credit`, `business_income_tax` y `personal_expenses` no deben compartir un
campo ambiguo llamado `deductiblePercentage`:

- En IVA se evalúa el crédito tributario potencial del impuesto pagado.
- En IR de actividad se evalúan relación causal, sustento y proporción de uso
  empresarial.
- En gastos personales se evalúan categoría y elegibilidad potencial para la
  rebaja del Impuesto a la Renta.

## Modelo de dominio objetivo

### Perfil y revisión del contribuyente

`TaxpayerProfile` es la identidad estable. `TaxpayerProfileRevision` fija los
hechos que pueden cambiar con el tiempo.

Campos mínimos propuestos para la revisión:

```text
displayName
personalIdNumber?
professionalIdNumber?
hasEmploymentIncome
hasRuc
taxRegime: general | rimpe_entrepreneur | rimpe_popular_business | unknown
vatFilingFrequency: none | monthly | semiannual | unknown
additionalFacts?
createdAt
```

Reglas:

- Un perfil de una persona únicamente asalariada puede existir sin actividades.
- `hasRuc = false` exige cero actividades y `vatFilingFrequency = none`.
- `hasRuc = true` permite una o más actividades, pero no habilita el análisis de
  IVA si régimen o periodicidad siguen en `unknown`.
- Los valores son hechos aportados por el usuario; no prueban por sí mismos una
  obligación ante el SRI.

### Actividad económica y revisión

La separación actual entre `EconomicActivity` y `EconomicActivityRevision` se
mantiene. Una revisión conserva:

```text
displayName
registeredActivityCode?
registeredActivityName
activityDescription
necessaryPurchases?
revenueVatTreatment
revenueVatTreatmentOther?
mixedUseDescription?
additionalFacts?
```

La actividad aporta contexto para evaluar una factura. `necessaryPurchases` no
es una lista de gastos preaprobados y `revenueVatTreatment` no reemplaza la
obligación registrada en el perfil.

### Contexto de colección y revisiones

Una colección tiene una configuración predeterminada editable, pero cada cambio
crea una `CollectionContextRevision` inmutable. Esta fija:

```text
collectionId
purpose
period.startDate
period.endDate
taxpayerProfileRevisionId
activityRevisionIds[]
notes?
revision
createdAt
```

Validación condicional:

- `vat_credit`: exige RUC, periodicidad de IVA resuelta y al menos una actividad.
- `business_income_tax`: exige RUC y al menos una actividad.
- `personal_expenses`: exige cero actividades; puede usarse con o sin RUC y con
  o sin relación de dependencia.
- El período de IR es anual. El período de IVA debe coincidir con un mes o
  semestre compatible con el perfil seleccionado.

La colección no guarda copias mutables de cédula, RUC o instrucciones fiscales.
Referencia revisiones concretas para que un análisis histórico sea reproducible.

### Factura compartida entre colecciones

La factura debe tener identidad propia dentro del usuario o biblioteca. Las
colecciones se relacionan mediante `CollectionMembership` en lugar de ser dueñas
exclusivas del archivo:

```text
Invoice 1 ── N CollectionMembership N ── 1 Collection
Invoice 1 ── N TaxAnalysisResult N ── 1 AnalysisRun
```

Una misma factura puede participar en una colección de IVA mensual y otra de IR
anual sin duplicar el XML ni sobrescribir su análisis anterior.

La identidad debe usar primero la clave de acceso del comprobante electrónico
cuando esté disponible. Como respaldo, puede usar una clave normalizada que
combine emisor, establecimiento, punto de emisión, secuencial, fecha, total y
hash del original. La restricción única debe existir en la base de datos; usar
`skipDuplicates` con IDs UUID distintos no deduplica.

## Flujo del modal de análisis

1. El usuario pulsa **Analizar**.
2. Selecciona `IVA` o `Impuesto a la Renta`.
3. Si selecciona IR, elige `actividad económica` o `gastos personales`.
4. El sistema propone el período a partir de la colección y el perfil.
5. Para IVA o IR de actividad, el usuario selecciona una o más actividades.
6. El sistema presenta el perfil, régimen, periodicidad y ruleset que fijará.
7. El usuario elige todas, pendientes o facturas seleccionadas.
8. El servidor valida propiedad y consistencia, crea el snapshot y encola el run.

La UI no decide la autorización ni la aplicabilidad. El servidor repite todas
las validaciones y devuelve bloqueos con una acción concreta para resolverlos.

## Selección determinista de reglas

Las reglas no se eligen solo por actividad. El selector usa:

```text
purpose
+ tax period
+ tax regime
+ VAT filing frequency
+ selected activities and their VAT treatment
= applicable ruleset
```

La descripción de actividad es contexto factual para el LLM. El propósito, la
vigencia y el régimen seleccionan el material normativo mediante código
determinista antes de construir el prompt.

Bloqueos mínimos:

| Código                        | Condición                                            |
| ----------------------------- | ---------------------------------------------------- |
| `MISSING_PROVIDER_CONNECTION` | No existe proveedor autorizado.                      |
| `MISSING_COLLECTION_CONTEXT`  | La colección no tiene contexto completo.             |
| `MISSING_TAXPAYER_PROFILE`    | No se fijó una revisión de perfil.                   |
| `MISSING_ECONOMIC_ACTIVITY`   | El propósito requiere actividades y no hay ninguna.  |
| `UNRESOLVED_TAX_REGIME`       | El régimen es necesario y permanece desconocido.     |
| `UNRESOLVED_VAT_FREQUENCY`    | IVA no tiene periodicidad resuelta.                  |
| `MISSING_APPLICABLE_RULESET`  | No existe ruleset revisado para propósito y período. |
| `OUTSIDE_COLLECTION_PERIOD`   | La factura queda fuera del período seleccionado.     |
| `NO_ELIGIBLE_INVOICES`        | La selección final está vacía.                       |

## Pipeline de fuentes SRI y rulesets

La adquisición, curado, publicación a PostgreSQL y distribución a SQLite se
especifican en [Ingesta y distribución de rulesets SRI](./2026-09-03-sri-ruleset-ingestion-distribution-design.md).

Las referencias autogestionadas actuales y las reglas oficiales son dominios
distintos:

- `FiscalReference`: contenido aportado por el usuario, opcional y no oficial.
- `TaxRuleSource`/`TaxRuleSet`: contenido oficial administrado, curado,
  versionado y aprobado para ejecución.

Pipeline objetivo:

```text
PDF/Markdown oficial original
→ validación y almacenamiento inmutable
→ extracción de texto
→ normalización a Markdown derivado
→ división por artículo o sección
→ etiquetado por propósito, régimen y vigencia
→ revisión humana
→ activación de una versión inmutable
→ selección de fragmentos para un AnalysisRun
```

Metadatos mínimos de una fuente o fragmento:

```text
sourceDocumentId
title
issuer
officialUrl
jurisdiction
articleOrSection
effectiveFrom
effectiveTo?
purposes[]
taxRegimes[]
contentHash
reviewStatus
reviewedBy
reviewedAt
```

El original y el Markdown derivado se conservan por separado. La extracción no
convierte automáticamente el texto en una regla aprobada. Un PDF sin texto
seleccionable queda bloqueado hasta contar con un proceso OCR explícito y
revisión humana.

No se inyecta el reglamento completo en cada factura. El compilador selecciona
fragmentos pequeños y aplicables, con identificadores de fuente que también se
guardan en el resultado.

## Construcción del prompt

El prompt se arma en capas y trata las referencias como datos, nunca como
instrucciones capaces de reemplazar el contrato del sistema:

```text
1. Instrucciones invariantes del analizador
2. Propósito y semántica exacta del resultado
3. Ruleset oficial seleccionado y sus referencias
4. Perfil tributario fijado
5. Actividades seleccionadas, si aplican
6. Notas y referencias autogestionadas del usuario, delimitadas como no oficiales
7. Factura normalizada
8. Schema de salida correspondiente al propósito
```

Reglas comunes del analizador:

- No afirmar que el SRI aceptará una factura.
- No convertir una compra mencionada en `necessaryPurchases` en elegible de
  forma automática.
- Relacionar una factura con cero, una o varias actividades.
- Distinguir hechos presentes en el XML de afirmaciones aportadas por el usuario.
- Emitir `needs_review` cuando falten datos para sostener la clasificación.
- Citar los IDs de los fragmentos normativos usados.
- Enumerar incertidumbres y evidencia faltante.

## Contratos de salida

### Campos comunes

```text
schemaVersion
runId
invoiceId
purpose
classification: eligible | ineligible | needs_review
reasoning
uncertainties[]
ruleReferenceIds[]
userReferenceIds[]
createdAt
```

### IVA

`VatCreditAssessment` añade:

```text
relatedActivityRevisionIds[]
invoiceVatAmount
potentialCreditableVatAmount?
creditablePercentage?
creditType: total | partial | none | undetermined
proportionalityRequired
missingEvidence[]
```

El porcentaje describe crédito tributario potencial, no deducibilidad general.

### IR de actividad económica

`BusinessIncomeTaxAssessment` añade:

```text
relatedActivityRevisionIds[]
businessUsePercentage?
potentialExpenseAmount?
mixedUseDetected
substantiationIssues[]
missingEvidence[]
```

`businessUsePercentage` representa atribución del uso a la actividad, no una
garantía de aceptación fiscal.

### Gastos personales

`PersonalExpenseAssessment` añade:

```text
personalExpenseCategory?
potentialEligibleAmount?
beneficiaryRelationship?
missingEvidence[]
```

Este resultado se expresa como elegibilidad potencial para rebaja de IR. No se
mezcla con gastos de la actividad ni calcula la declaración completa.

## Ejecuciones e historial

Cada `AnalysisRun` conserva un snapshot de:

```text
collectionContextRevisionId
taxpayerProfileRevisionId
activityRevisionIds[]
provider + model
promptVersion
rulesetId + version + hash
invoice snapshots/hashes
```

Los resultados V2 son registros independientes. No deben sobrescribir
`BillHeader.percentage` y `BillHeader.reason`. Esos campos pueden mantenerse
temporalmente como proyección de compatibilidad, derivada del último resultado
visible, mientras la UI migra al historial de runs.

La clave de idempotencia debe incluir propósito, revisión de contexto, ruleset,
modelo, versión de prompt y conjunto ordenado de facturas. Repetir exactamente
la misma solicitud no crea una ejecución accidentalmente duplicada.

## Comparación con el codebase en progreso

| Área                  | Estado encontrado                                               | Corrección requerida                                                                                       |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `TaxPurposeSchema`    | Ya define los tres propósitos aprobados.                        | Mantener los valores y agregar validación condicional.                                                     |
| Perfil                | Exige `activityRevisionIds.min(1)`.                             | Permitir cero para asalariados y gastos personales; añadir situación laboral, RUC, régimen y periodicidad. |
| Actividades           | Entidad y revisiones ya están modeladas.                        | Mantenerlas exclusivas para actividades con RUC y validar propiedad/vigencia.                              |
| Contexto de colección | Existe como schema, pero no como persistencia completa.         | Crear revisiones persistentes y relación con actividades.                                                  |
| Resultado V2          | Comparte `deductiblePercentage`.                                | Sustituir por un discriminated union con tres resultados especializados.                                   |
| Runs                  | El schema fija parte del snapshot.                              | Persistir run, facturas, ruleset y resultados inmutables.                                                  |
| Prompt V1             | Analiza deducibilidad genérica y adjunta todas las referencias. | Crear builder V2 por propósito y selector determinista de ruleset.                                         |
| Referencias PDF       | Extrae texto, normaliza, limita y calcula hash.                 | Reutilizar primitives, pero separar reglas oficiales de referencias del usuario.                           |
| Facturas cloud        | Cada carga crea UUID y ruta nueva.                              | Introducir identidad única y membresía muchos-a-muchos.                                                    |
| Biblioteca local      | La deduplicación y SQLite están documentados como destino.      | Implementar después contra el mismo contrato semántico; no presentarlo como comportamiento actual.         |
| Resultado legado      | Sobrescribe porcentaje y razón en `BillHeader`.                 | Mantener solo como proyección temporal y migrar UI al historial.                                           |

## Archivos y superficies afectadas

La implementación deberá revisar, como mínimo:

- `src/schema/tax-analysis-v2.ts`: contratos y validaciones condicionales.
- `prisma/schema.prisma`: perfiles, revisiones, contexto de colección, rulesets,
  identidad/membresías de factura, runs y resultados.
- `prisma/migrations/20260903213000_add_taxpayer_profiles_and_activities/`:
  conservar el carácter aditivo de la primera fase y decidir si la ampliación se
  entrega en una migración posterior.
- `src/integrations/trpc/procedures/taxpayer-profiles/`: perfil sin actividades y
  nuevos hechos tributarios.
- `src/integrations/trpc/procedures/collections`: CRUD/revisiones de actividades,
  contexto de colección, rulesets y runs.
- `src/integrations/prompts/bill-prompt-builder.ts`: mantener V1 durante la
  transición y crear builder V2 sin selección implícita de reglas.
- `src/integrations/fiscal-references/`: extraer primitives compartibles de
  validación, normalización y hash sin mezclar repositorios de dominio.
- `src/integrations/trpc/procedures/bills/`: identidad, deduplicación y membresía.
- `src/integrations/services/bill-analysis.service.ts`: producir resultados V2
  inmutables y dejar de tratar porcentaje/razón como fuente de verdad.
- `src/integrations/jobs/analyze-job.ts`: fijar y verificar snapshot/ruleset.
- `src/routes/(private)/collections/$id.tsx`: modal de propósito, período,
  actividades y selección de facturas.
- `src/routes/(private)/profiles.tsx`: situación laboral, RUC, régimen,
  periodicidad y actividades.
- `docs/architecture/analysis-flow.md`: actualizar solo cuando el comportamiento exista y
  haya sido verificado.
- `docs/architecture/byok-local-execution-design.md`: alinear nombres y marcar
  con claridad qué sigue siendo arquitectura destino.

## Estrategia de migración

### Fase 1: cerrar contratos

- Corregir perfil sin actividades.
- Añadir situación laboral, régimen y periodicidad.
- Convertir el resultado en unión discriminada por propósito.
- Definir schemas de ruleset, bloqueos y snapshots.
- Añadir pruebas de contratos sin conectar todavía el flujo V1.

### Fase 2: persistencia y APIs de contexto

- Persistir revisiones de perfil y actividades.
- Añadir `CollectionContextRevision` y sus relaciones.
- Implementar validaciones de propiedad y compatibilidad.
- Exponer bloqueos accionables antes del análisis.

### Fase 3: fuentes oficiales y rulesets

- Separar referencias del usuario de fuentes oficiales.
- Conservar originales y derivados normalizados.
- Implementar fragmentación, revisión y activación.
- Resolver ruleset por propósito, régimen y período.

### Fase 4: AnalysisRun y prompt V2

- Persistir snapshots y resultados especializados.
- Implementar builders V2 por propósito.
- Mantener V1 disponible durante migración controlada.
- Proyectar temporalmente el último resultado en campos legados si la UI lo
  necesita.

### Fase 5: identidad de factura y reutilización

- Añadir clave de acceso/hash normalizado e índice único.
- Separar `Invoice` de `CollectionMembership`.
- Migrar cargas existentes sin borrar originales.
- Permitir reutilizar facturas entre IVA e IR.

### Fase 6: modal y experiencia completa

- Implementar las dos opciones macro y tres propósitos internos.
- Mostrar perfil, período, actividades, ruleset y bloqueos.
- Mostrar resultados específicos e historial por factura.
- Verificar en navegador los casos asalariado, RUC y perfil mixto.

La migración se mantiene aditiva. No se eliminan tablas o campos legados hasta
que contratos, backfill, UI e historial V2 estén comprobados.

## Casos de aceptación

1. Una persona únicamente asalariada crea un perfil sin actividades y analiza
   facturas como `personal_expenses`.
2. Una persona con RUC analiza una colección mensual como `vat_credit` y debe
   seleccionar al menos una actividad.
3. Una persona con RUC analiza las mismas facturas en un run anual separado como
   `business_income_tax` sin duplicar originales.
4. Una persona con sueldo y RUC conserva ambas situaciones en un solo perfil y
   puede ejecutar los tres propósitos sin tratar el empleo como actividad.
5. Una factura puede relacionarse con más de una actividad o quedar sin relación.
6. Un perfil con periodicidad de IVA desconocida recibe un bloqueo accionable y
   no llama al LLM.
7. Un run fija revisiones, ruleset, modelo, prompt y hashes de factura.
8. Cambiar una actividad o regla no altera resultados históricos.
9. Reimportar el mismo XML no crea otra factura; puede añadir una membresía.
10. El prompt recibe solo fragmentos aplicables y devuelve IDs de las reglas
    usadas.
11. IVA, IR de actividad y gastos personales producen contratos distintos.
12. Ningún resultado se presenta como dictamen o aceptación definitiva del SRI.

## Fuentes oficiales de referencia

- SRI, [Impuesto al Valor Agregado](https://www.sri.gob.ec/impuesto-al-valor-agregado-iva): sujetos, periodicidad mensual/semestral y marco general.
- SRI, [Impuesto a la Renta](https://www.sri.gob.ec/impuesto-renta): obligación y regla general de deducciones.
- SRI, [LRTI, artículo 10](https://www.sri.gob.ec/DocumentosAlfrescoPortlet/descargar/b1055d62-8021-4a3c-9679-58f9c8cd38f7/Art.%2B10%2BDeducciones): relación del gasto con ingresos y sustento.
- SRI, [Reglamento para la aplicación de la LRTI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/03995ac1-408a-4694-b24c-447d93774c52/3.1%20REGLAMENTO%20A%20LA%20LRTI.pdf): gastos generales, gastos personales y reglas operativas.
- SRI, [Proyección de gastos personales 2026](https://www.sri.gob.ec/detalle-noticias?idnoticia=1261&marquesina=1): tratamiento de la proyección para relación de dependencia.

Estas URLs son procedencia para el diseño. Antes de activar un ruleset se debe
guardar el documento original, comprobar su vigencia, registrar hash y completar
revisión humana.
