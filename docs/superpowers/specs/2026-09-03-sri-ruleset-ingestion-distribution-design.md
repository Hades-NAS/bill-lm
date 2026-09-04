# Ingesta y distribución de rulesets SRI

## Estado y relación con el diseño tributario

Este documento detalla cómo el propietario de Bill-LM obtiene fuentes oficiales
del SRI, genera borradores, revisa secciones, construye un bundle inmutable y
distribuye exactamente el mismo contenido al servidor cloud y a los modos
locales.

Complementa [Contexto tributario, actividades y rulesets](./2026-09-03-tax-analysis-context-and-rulesets-design.md).
No cambia sus tres propósitos de análisis ni el modelo de perfil y actividades.

La decisión principal es:

> El repositorio publica el bundle canónico revisado. PostgreSQL es la fuente
> operativa del cloud y SQLite es la fuente operativa de cada biblioteca local.
> Ambos importan el mismo bundle y conservan su ID, versión y hash.

El servidor cloud, los agentes OAuth y los modelos GPU no descargan documentos
del SRI durante el análisis.

## Alcance

Incluye:

- descubrimiento y descarga manual asistida de fuentes oficiales;
- preservación del original y su procedencia;
- extracción determinista de PDF a texto normalizado;
- división inicial por artículos o secciones;
- curado y aprobación humana;
- construcción y validación de bundles portátiles;
- sincronización append-only a PostgreSQL;
- importación verificada a SQLite;
- detección de nuevas versiones sin activación automática;
- trazabilidad desde un resultado hasta reglas y fuentes.

No incluye:

- interpretación jurídica autónoma;
- aprobación automática de texto generado por IA;
- scraping autenticado del portal transaccional del SRI;
- presentación de declaraciones;
- actualización automática de producción al detectar un PDF diferente;
- redistribución indiscriminada de compilaciones editoriales de terceros.

## Opciones consideradas

### Bundle portable versionado — seleccionada

El repositorio contiene contratos, secciones revisadas y bundles. Cloud y local
los importan mediante adaptadores separados. Ofrece equivalencia, auditoría y
reproducción histórica sin acoplar los modos de ejecución.

### Scripts independientes para PostgreSQL y SQLite — descartada

Reduce el trabajo inicial, pero duplica transformación y reglas. Dos scripts
pueden producir contenido diferente a partir de la misma fuente.

### Descargar desde el SRI durante cada análisis — descartada

Introduce dependencia de red, URLs cambiantes, material no revisado y resultados
imposibles de reproducir. También convertiría un cambio externo en un cambio de
comportamiento sin aprobación.

## Fuentes oficiales y descubrimiento

### Fuentes de descubrimiento

El manifiesto no depende únicamente de URLs de descarga con UUID. Conserva una
página oficial de descubrimiento y la URL directa resuelta para la versión
revisada.

| ID                             | Tipo             | URL de descubrimiento                                              |
| ------------------------------ | ---------------- | ------------------------------------------------------------------ |
| `sri-national-tax-legislation` | Índice normativo | `https://www.sri.gob.ec/normativa-tributaria-legislacion-nacional` |
| `sri-forms-and-guides`         | Índice de guías  | `https://www.sri.gob.ec/formularios-e-instructivos`                |
| `sri-vat`                      | Página temática  | `https://www.sri.gob.ec/impuesto-al-valor-agregado-iva`            |
| `sri-income-tax`               | Página temática  | `https://www.sri.gob.ec/impuesto-renta`                            |

La página de legislación enlaza actualmente el índice
`normativa_institucional_vigente.pdf`. Ese archivo enumera cuerpos normativos y
sus enlaces, pero no es por sí mismo una fuente de reglas para el prompt.

URL resuelta del índice al diseñar esta especificación:

```text
https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/
fd3fa4a9-ab76-4426-9f4f-08dee57993d8/normativa_institucional_vigente.pdf
```

### Corpus inicial

| Source ID                        | Rol                               | Descubrimiento o URL resuelta inicial                                                                                                                                                                                        |
| -------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ec-sri-lrti`                    | Norma primaria para IR e IVA      | Resolver “Ley de Régimen Tributario Interno” desde el índice normativo vigente.                                                                                                                                              |
| `ec-sri-rlrti`                   | Reglamento primario para IR e IVA | `https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/03995ac1-408a-4694-b24c-447d93774c52/3.1%20REGLAMENTO%20A%20LA%20LRTI.pdf`                                                                      |
| `ec-sri-ir-natural-person-guide` | Guía operativa de IR              | `https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/55428073-d439-4d4b-9d91-388b3306c424/Gu%C3%ADa%20para%20el%20llenado%20del%20Formulario%20Impuesto%20a%20la%20Renta%20personas%20naturales.pdf` |
| `ec-sri-ir-rimpe-guide`          | Guía operativa de RIMPE           | `https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f9880f8b-13de-49e4-900b-2e15acd39ba1/Gu%C3%ADa%20de%20llenado%20de%20Impuesto%20a%20la%20Renta%20Personas%20Naturales%20RIMPE.pdf`              |
| `ec-sri-vat-form-guide`          | Guía operativa de IVA             | `https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/e084fae5-9677-450c-8161-21e7c3a9f65b/Gu%C3%ADa%20para%20el%20llenado%20del%20Formulario%20Impuesto%20al%20Valor%20Agregado%20IVA.PDF`           |

Las guías explican formularios y casilleros. No sustituyen la LRTI, el RLRTI ni
resoluciones aplicables. Cada regla debe indicar si su fuente es `law`,
`regulation`, `resolution`, `official_guide` u `official_webpage`.

### Regla contra fuentes obsoletas

Una URL encontrada por búsqueda no se considera vigente solo porque siga
respondiendo. `check` compara título, metadatos visibles, fecha de reforma cuando
exista, hash y enlace publicado desde la página oficial de descubrimiento.

Si no puede demostrar que la URL continúa publicada desde el índice oficial,
marca `source-unresolved` y no genera una nueva versión aprobable.

### Restricciones de redistribución

Algunos PDFs consolidados alojados por el SRI pueden incluir notas editoriales
de terceros. El sistema preserva esos originales para revisión y auditoría
interna, pero el bundle distribuido contiene reglas curadas, resúmenes propios,
referencias precisas y hashes. La inclusión de texto literal extenso requiere
una revisión separada de derechos de uso.

## Directorios

### Contenido versionado en Git

```text
resources/tax-rules/ec/sri/
├── README.md
├── manifest.json
├── schemas/
│   ├── source.schema.json
│   ├── section.schema.json
│   ├── rule.schema.json
│   └── bundle.schema.json
├── sources/
│   ├── ec-sri-lrti.source.json
│   ├── ec-sri-rlrti.source.json
│   ├── ec-sri-ir-natural-person-guide.source.json
│   ├── ec-sri-ir-rimpe-guide.source.json
│   └── ec-sri-vat-form-guide.source.json
├── sections/
│   └── reviewed/
│       ├── vat-credit/
│       ├── business-income-tax/
│       └── personal-expenses/
├── rulesets/
│   ├── ec-sri-2026.1/
│   │   ├── manifest.json
│   │   ├── vat-credit.json
│   │   ├── business-income-tax.json
│   │   └── personal-expenses.json
│   └── index.json
└── checksums.json
```

### Contenido de trabajo no versionado

```text
.cache/tax-rules/ec/sri/
├── downloads/
├── originals/
├── extracted/
├── sections/drafts/
├── diffs/
└── build/
```

Los originales y borradores no entran en Git por defecto. Los archivos
revisados pasan de `.cache/tax-rules/ec/sri/sections/drafts` a
`resources/tax-rules/ec/sri/sections/reviewed` mediante una acción explícita
que registra quién revisó y qué hash de fuente utilizó.

### Artefacto de distribución

El build produce:

```text
dist/tax-rules/ec-sri-2026.1.bundle.json
dist/tax-rules/ec-sri-2026.1.bundle.sha256
```

`dist/` es regenerable. El contenido lógico fuente del bundle permanece en
`resources/tax-rules`; una release puede adjuntar el artefacto construido.

## Contratos de datos

### Source manifest

Ejemplo conceptual:

```json
{
  "schemaVersion": "1",
  "id": "ec-sri-rlrti",
  "issuer": "Servicio de Rentas Internas",
  "jurisdiction": "EC",
  "sourceKind": "regulation",
  "discoveryUrl": "https://www.sri.gob.ec/normativa-tributaria-legislacion-nacional",
  "resolvedUrl": "https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/03995ac1-408a-4694-b24c-447d93774c52/3.1%20REGLAMENTO%20A%20LA%20LRTI.pdf",
  "mimeType": "application/pdf",
  "retrievedAt": "2026-09-03T00:00:00Z",
  "contentHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "effectiveFrom": "2025-10-28",
  "effectiveTo": null,
  "reviewStatus": "reviewed"
}
```

El hash del ejemplo solo ilustra el formato; `fetch` debe sustituirlo por el
SHA-256 real. `retrievedAt` no determina vigencia. `effectiveFrom` y
`effectiveTo` requieren evidencia de la fuente o revisión humana.

### Reviewed section

Cada sección Markdown usa frontmatter validable:

```yaml
schemaVersion: '1'
id: ec-sri-rlrti-art-28
sourceId: ec-sri-rlrti
articleOrSection: 'Art. 28'
sourcePages: [34, 35, 36]
sourceContentHash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
purposes:
  - business_income_tax
taxRegimes:
  - general
effectiveFrom: '2025-10-28'
effectiveTo: null
reviewStatus: reviewed
reviewedBy: owner
reviewedAt: '2026-09-03T00:00:00Z'
---
```

El hash del ejemplo solo ilustra el formato y debe coincidir con la revisión de
fuente real. El cuerpo contiene un resumen propio, condiciones, excepciones,
evidencia necesaria y referencias cruzadas. Si incluye un extracto literal, lo
delimita y registra su procedencia.

### Rule

Una regla pequeña y ejecutable contiene:

```json
{
  "id": "ec.sri.ir.business.causality",
  "version": 1,
  "purpose": "business_income_tax",
  "kind": "requirement",
  "summary": "Evaluar relación con la actividad generadora de ingresos.",
  "sourceSectionIds": ["ec-sri-lrti-art-10"],
  "conditions": ["related_to_selected_activity"],
  "uncertainties": ["mixed_personal_business_use"]
}
```

No se guarda código arbitrario, plantillas ejecutables ni instrucciones de
sistema dentro de una regla. Los valores se interpretan mediante un compilador
con enums y schemas cerrados.

### Bundle

El bundle contiene:

```text
schemaVersion
rulesetId
version
jurisdiction
effectiveFrom
effectiveTo?
sourceManifests[]
sections[]
rules[]
promptContractVersion
createdAt
createdBy
bundleHash
```

El hash se calcula sobre una serialización canónica que excluye el propio campo
`bundleHash`. Un bundle publicado es inmutable.

## Comandos del owner

Los nombres siguientes son contratos de diseño; se implementarán con Bun y
TypeScript reutilizando Zod, `pdf-parse` y `node:crypto` ya instalados.

```bash
bun run rules:sri:check
bun run rules:sri:fetch --source ec-sri-rlrti
bun run rules:sri:extract --source ec-sri-rlrti
bun run rules:sri:split --source ec-sri-rlrti
bun run rules:sri:diff --source ec-sri-rlrti
bun run rules:sri:review --section ec-sri-rlrti-art-28
bun run rules:sri:validate
bun run rules:sri:build --version 2026.1
bun run rules:sri:sync:postgres --version 2026.1 --dry-run
```

### `check`

- consulta únicamente dominios SRI permitidos;
- resuelve enlaces desde las páginas de descubrimiento;
- compara URL, metadatos y hash conocido;
- no modifica `resources/`, base de datos ni estado activo;
- devuelve por fuente `unchanged`, `update-candidate`, `source-unavailable`,
  `source-unresolved` o `unexpected-content`.

Una indisponibilidad de red no implica que una fuente haya sido eliminada.

### `fetch`

- exige un `sourceId` registrado;
- permite sobrescribir la URL solo con `--url` explícito;
- acepta exclusivamente HTTPS y host `www.sri.gob.ec` en la primera versión;
- limita redirecciones, tamaño y tiempo;
- valida MIME, magic bytes y tamaño antes de conservar el archivo;
- escribe de forma atómica en `.cache/`;
- registra URL final, headers seguros, timestamp y SHA-256;
- nunca activa ni publica reglas.

### `extract`

- lee un original ya verificado por hash;
- conserva marcadores de página;
- normaliza Unicode, saltos, encabezados/pies repetitivos y espacios;
- genera un derivado, sin modificar el original;
- falla de manera accionable si el PDF no tiene texto seleccionable;
- no incorpora OCR en la primera versión.

### `split`

- divide normas por encabezados como `Art. 10.-` y guías por títulos;
- conserva rango de páginas y offsets hacia la extracción;
- genera solo borradores;
- marca fragmentos dudosos en vez de inventar límites;
- es idempotente para el mismo hash y versión del splitter.

### `diff`

Compara una fuente nueva con la última revisada y presenta:

- artículos añadidos, eliminados o modificados;
- cambios de numeración;
- cambios de páginas sin cambio textual;
- secciones revisadas que quedarían obsoletas;
- reglas afectadas mediante `sourceSectionIds`.

### `review`

No decide si el contenido es jurídicamente correcto. Facilita promover un
borrador después de que el owner revise texto, propósito, vigencia, régimen,
referencias cruzadas y restricciones de distribución.

La promoción crea un archivo nuevo o una nueva revisión; no sobrescribe una
sección que ya pertenece a un bundle publicado.

### `validate`

Verifica:

- schemas y enums;
- IDs únicos y referencias existentes;
- hashes de fuente y sección;
- rangos de vigencia válidos y sin ambigüedad para la misma selección;
- cobertura de propósito declarada;
- ausencia de secciones `draft`;
- ausencia de URLs no permitidas;
- ausencia de placeholders;
- determinismo de la serialización.

### `build`

- requiere validación verde;
- construye un bundle determinista;
- calcula su hash;
- no actualiza bases de datos;
- falla si intenta reutilizar una versión publicada con contenido diferente.

## Publicación al cloud

### Fuente canónica y fuente operativa

```text
resources/tax-rules + bundle revisado en Git
                  │
                  ▼
     deployment ejecuta sync:postgres
                  │
                  ▼
       PostgreSQL del servidor cloud
                  │
                  ▼
       resolver → snapshot → prompt
```

Git conserva el artefacto revisado que se distribuye. PostgreSQL conserva la
copia operativa que consulta la web y el worker.

### `sync:postgres`

El comando:

1. valida nuevamente schema y hash del bundle;
2. comprueba que la conexión sea la esperada sin imprimir credenciales;
3. muestra un plan en `--dry-run`;
4. inserta de forma transaccional fuente, secciones, ruleset y reglas;
5. no modifica una versión existente;
6. permite activar la versión mediante una operación explícita separada;
7. registra actor, fecha, commit y bundle hash;
8. puede ejecutarse repetidamente sin crear duplicados.

No usa `prisma migrate dev` ni `db push`. Las tablas se crean mediante migración
versionada y el bundle se importa como datos append-only.

### Integración con despliegue

El flujo recomendado es:

```text
checkout de un commit aprobado
→ instalar dependencias
→ prisma migrate deploy
→ rules:sri:sync:postgres --all-bundled
→ health/readiness
→ activar release
```

La sincronización no convierte automáticamente una versión nueva en la aplicable.
La activación necesita un comando administrativo explícito o un manifiesto de
release aprobado. Un fallo detiene el despliegue antes de servir análisis con un
estado parcial.

### Consumo en un análisis cloud

1. La API valida perfil, propósito, período y actividades.
2. El resolver consulta PostgreSQL y selecciona una sola versión aplicable.
3. Crea `AnalysisRun` con `rulesetId`, versión y hash.
4. El job transporta IDs, nunca el texto completo de las reglas.
5. El worker vuelve a verificar el snapshot y carga reglas desde PostgreSQL.
6. El compilador construye el contexto acotado para el prompt.
7. El resultado guarda `ruleReferenceIds` y el mismo ruleset hash.

El PDF original no se descarga ni se procesa en este camino.

## Distribución a modos locales

### Entrega

El bundle aprobado forma parte del repositorio y de las releases instalables.
Quien actualiza el checkout o instala una nueva versión recibe también los
rulesets nuevos.

```text
Git/release con bundles
        │
        ▼
bill-lm rules sync --from-bundled
        │
        ▼
SQLite de la biblioteca local
        │
        ├── agente OAuth
        └── endpoint GPU local
```

OAuth y GPU son mecanismos de ejecución. No mantienen copias privadas de las
reglas ni leen Markdown directamente desde el checkout.

### Importación a SQLite

El daemon local:

1. enumera los bundles incluidos en la aplicación;
2. valida schema y hash;
3. compara `rulesetId + version + bundleHash` contra SQLite;
4. importa versiones faltantes en una transacción;
5. rechaza una misma versión con hash diferente;
6. conserva versiones anteriores usadas por runs históricos;
7. actualiza el índice local de versiones disponibles;
8. activa una versión solo si corresponde a su período y política local.

SQLite sigue siendo la fuente de verdad de la biblioteca una vez importado el
bundle. La carpeta del repositorio es un canal de distribución, no almacenamiento
de ejecuciones o configuración del usuario.

### Formas de actualización local

- Checkout de desarrollo: `git pull` seguido de `bill-lm rules sync --from-bundled`.
- Aplicación empaquetada: la release incluye bundles y los importa al actualizar.
- Importación manual: `bill-lm rules import <bundle>` para entornos desconectados.

La importación manual exige las mismas verificaciones y no acepta downgrade o
reemplazo silencioso de una versión utilizada.

## Modelo de persistencia mínimo

PostgreSQL y SQLite implementan de forma equivalente:

```text
TaxRuleSource
TaxRuleSourceRevision
TaxRuleSection
TaxRuleSet
TaxRuleSetSection
TaxRule
TaxRuleSetActivation
```

Relaciones esenciales:

```text
TaxRuleSource 1 ── N TaxRuleSourceRevision
TaxRuleSourceRevision 1 ── N TaxRuleSection
TaxRuleSet N ── N TaxRuleSection
TaxRuleSet 1 ── N TaxRule
AnalysisRun N ── 1 TaxRuleSet
```

Los adaptadores pueden diferir físicamente, pero el contrato del bundle y las
reglas de validación son compartidos.

## Activación, vigencia y rollback

- Publicar, importar y activar son operaciones distintas.
- Solo una activación compatible puede resolver una combinación de jurisdicción,
  propósito, régimen y fecha.
- Una corrección genera una versión nueva; no edita bundles publicados.
- Desactivar impide runs nuevos, pero no invalida runs históricos.
- Rollback selecciona una versión anterior todavía compatible; no borra la nueva.
- Si no existe una versión inequívoca, el análisis queda bloqueado.

El sistema nunca selecciona “la versión más reciente” sin comprobar la fecha
fiscal del run.

## Seguridad y robustez

- Allowlist inicial de hosts y HTTPS obligatorio.
- Límites de bytes, tiempo, redirecciones y memoria.
- Validación de magic bytes; no confiar solo en extensión o `Content-Type`.
- Escrituras temporales y renombre atómico.
- SHA-256 de original, derivado, secciones y bundle.
- El texto externo se trata como datos no confiables.
- No ejecutar código, macros, enlaces ni instrucciones encontradas en PDFs.
- No registrar credenciales, headers sensibles ni contenido tributario del usuario.
- Fallos de red o parsing no alteran el ruleset activo.
- Cada publicación registra evidencia y actor.

## Observabilidad y resultados de comandos

Los comandos emiten salida humana y JSON opcional:

```text
sourceId
operation
status
previousHash?
candidateHash?
filesWritten[]
sectionsAdded
sectionsChanged
sectionsRemoved
warnings[]
nextAction?
```

Estados estables:

```text
unchanged
update-candidate
downloaded
extracted
drafts-generated
review-required
validated
built
synced
activated
source-unavailable
source-unresolved
unexpected-content
blocked
```

## Implementación por fases

### Fase 1: contratos y fixtures

- Definir schemas Zod de fuente, sección, regla y bundle.
- Crear manifiestos del corpus inicial.
- Preparar fixtures pequeños, sin depender de red en pruebas unitarias.
- Definir serialización canónica y hash.

### Fase 2: adquisición y extracción

- Implementar `check`, `fetch` y `extract`.
- Reutilizar primitives actuales de PDF, normalización y SHA-256 sin acoplar
  `FiscalReference` con `TaxRuleSource`.
- Añadir pruebas de límites, redirects, MIME, magic bytes y fallos.

### Fase 3: split, diff y revisión

- Implementar división por artículo/sección.
- Generar borradores con páginas y offsets.
- Comparar revisiones de una fuente.
- Promover secciones mediante acción explícita.

### Fase 4: validación y bundle

- Implementar referencias, vigencia, cobertura y determinismo.
- Construir bundles reproducibles.
- Verificar que dos builds desde el mismo contenido produzcan el mismo hash.

### Fase 5: PostgreSQL cloud

- Añadir migración versionada y repositorio.
- Implementar dry-run, sync append-only y activación.
- Integrar migración/sync en despliegue sin acceso al SRI en runtime.

### Fase 6: SQLite local

- Implementar el mismo repositorio semántico sobre SQLite.
- Incluir bundles en releases.
- Añadir sync bundled e importación manual.
- Verificar paridad de selección y prompt context entre cloud y local.

### Fase 7: primer corpus revisado

- Resolver y descargar LRTI/RLRTI vigentes.
- Generar split por artículos.
- Revisar primero el subconjunto mínimo para los tres propósitos.
- Construir `ec-sri-2026.1`.
- Importarlo en bases de prueba y comparar hashes/contextos.

## Pruebas y evidencia

### Unitarias sin red

- validación de manifiestos;
- hash y serialización deterministas;
- extracción normalizada desde fixture PDF;
- split de artículos y encabezados dudosos;
- resolución por propósito/régimen/fecha;
- rechazo de draft, referencia rota o versión/hash conflictivo.

### Integración

- servidor HTTP fixture para redirect, MIME, tamaño y timeout;
- importación idempotente a PostgreSQL de prueba;
- importación idempotente a SQLite temporal;
- rollback transaccional ante un bundle inválido;
- equivalencia de filas y contexto compilado entre adaptadores.

### Prueba manual controlada

- ejecutar `check` contra las páginas oficiales;
- descargar una fuente real en `.cache/`;
- inspeccionar PDF y texto extraído;
- revisar diff y secciones antes de promoción;
- construir el bundle dos veces y comparar hashes;
- sincronizar en una base no productiva;
- importar en una biblioteca local de prueba;
- demostrar que cloud y local seleccionan las mismas reglas.

Health y pruebas estáticas no demuestran vigencia jurídica. La evidencia de cada
versión incluye URLs, originales, hashes, fechas y aprobación humana.

## Criterios de aceptación

1. Cada fuente tiene página de descubrimiento, URL resuelta y hash.
2. El índice `normativa_institucional_vigente.pdf` nunca se usa como ruleset.
3. Detectar un hash nuevo no publica ni activa reglas.
4. Los originales se conservan fuera de Git por defecto.
5. Las secciones revisadas enlazan a fuente, páginas y hash exactos.
6. Ninguna sección draft entra en un bundle.
7. Dos builds idénticos producen el mismo bundle hash.
8. El bundle canónico revisado se distribuye mediante repositorio/release.
9. Cloud importa ese bundle a PostgreSQL sin mutar versiones existentes.
10. El worker cloud carga reglas desde PostgreSQL, no desde Internet o Git.
11. Local importa el mismo bundle a SQLite y conserva el mismo hash.
12. OAuth y GPU usan el repositorio local común, no reglas propias.
13. Runs antiguos conservan la versión que utilizaron.
14. Un ruleset ambiguo, faltante o incompatible bloquea el análisis.
15. PostgreSQL y SQLite compilan el mismo contexto para el mismo fixture.
16. El corpus inicial permite rastrear cada regla hasta una fuente oficial.

## Secuencia operativa del owner

```text
check
→ fetch
→ extract
→ split
→ diff
→ revisión conjunta
→ promoción de secciones
→ validate
→ build
→ revisión final del bundle
→ incorporación al repositorio
→ sync PostgreSQL en deploy
→ import SQLite en actualización local
```

Esta secuencia es la única vía de publicación. Un cambio detectado fuera de ella
no afecta análisis cloud ni local.
