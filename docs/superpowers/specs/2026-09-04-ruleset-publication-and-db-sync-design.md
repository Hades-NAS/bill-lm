# Publicación de rulesets y sincronización a DB

Fecha: 2026-09-04

## Objetivo

Cerrar el salto controlado entre los borradores locales del pipeline SRI y la
copia operativa que la aplicación puede seleccionar. La publicación conserva
la revisión humana como barrera obligatoria: un PDF o un borrador nunca se
sincroniza directamente a la base de datos.

## Alcance

Se agregan cinco comandos del owner:

```text
promote → validate → build → sync:db → activate:db
```

No aplican migraciones ni escriben en una DB por defecto. `sync:db` requiere
`--apply`; `activate:db` requiere una confirmación explícita equivalente.

## Flujo y contratos

### 1. `rules:sri:promote`

Uso previsto:

```bash
bun run rules:sri:promote \
  --section ec-sri-lrti-art-10 \
  --reviewer "Nombre responsable" \
  --purpose vat_credit \
  --tax-regime general \
  --effective-from 2026-01-01
```

Lee un borrador de `.cache/tax-rules/.../sections/drafts/`, rechaza secciones
`ambiguous`, comprueba su hash y crea un archivo nuevo en
`resources/tax-rules/ec/sri/sections/reviewed/`. Nunca sobrescribe una sección
revisada. El responsable aporta propósito, régimen y vigencia porque esos
datos no pueden deducirse de un PDF con seguridad.

### 2. `rules:sri:validate`

Lee solo manifiestos y secciones revisadas versionadas. Comprueba schemas,
IDs únicos, hashes, referencias de fuente, vigencias y que no se intente
construir desde borradores o secciones ambiguas. Su salida es JSON seguro y no
escribe archivos ni datos.

### 3. `rules:sri:build --version <n>`

Exige `validate` verde y genera un bundle determinista en
`dist/tax-rules/`. El bundle contiene las fuentes y secciones revisadas
seleccionadas, su versión y un SHA-256. No modifica la DB. La versión no puede
reutilizarse con contenido diferente.

### 4. `rules:sri:sync:db --version <n>`

Resuelve el archivo de entorno de forma segura:

| Entrada | Archivo |
| --- | --- |
| sin `-e` / `--env` | `.env` |
| `-e local` | `.env.local` |
| `--env staging` | `.env.staging` |

Solo se aceptan nombres alfanuméricos, `_` y `-`; se rechazan rutas, puntos,
espacios y valores vacíos. El archivo debe existir y definir `DATABASE_URL`,
sin imprimirla jamás.

El comando vuelve a validar el bundle. Sin `--apply` solo devuelve el plan de
fuentes, fragmentos y rulesets a insertar. Con `--apply`, usa una transacción,
es idempotente para el mismo contenido y rechaza una versión ya existente con
un hash distinto. No cambia `reviewStatus` a `active`.

### 5. `rules:sri:activate:db --version <n>`

Selecciona un ruleset ya sincronizado y revisado, compatible con su propósito,
régimen, periodicidad y vigencia. Requiere `--apply`; sin él solo muestra el
plan. La activación es separada de la importación para que un bundle nuevo no
altere análisis sin aprobación explícita.

## Corrección de esquema

Los hashes del pipeline usan `sha256:` seguido de 64 caracteres hexadecimales:
71 caracteres en total. La migración amplía de 64 a 71 las columnas
`contentHash` de `TaxRuleSource`, `TaxRuleFragment` y `TaxRuleSet`, y actualiza
los campos Prisma correspondientes. No transforma ni elimina datos.

## Consumo por la aplicación

La API ya selecciona un `TaxRuleSet` activo y conserva su ID en `AnalysisRun`.
La sincronización hará que ese selector encuentre datos reales. La carga de
fragmentos para el prompt debe quedar delimitada: el worker recibe IDs y carga
desde la DB solo las secciones del ruleset fijado; nunca reutiliza Markdown de
`.cache` ni descarga PDFs durante un análisis.

## Errores y seguridad

- Todos los comandos capturan fallos esperados y muestran el siguiente paso
  en español, sin stack traces, secretos, `DATABASE_URL` ni contenido binario.
- Fallos de validación o conexión dejan la DB intacta.
- Las escrituras usan una única transacción; un error revierte toda la
  sincronización.
- No se usa `prisma db push` ni `prisma migrate dev`.

## Pruebas

- promoción válida, sección ambigua y colisión de archivo;
- validación de hashes, vigencias, IDs y referencia de fuente;
- determinismo del bundle y rechazo de versión con contenido diferente;
- resolución válida e inválida de `-e`/`--env`;
- `sync:db` dry-run, idempotencia, conflicto de hash y rollback transaccional;
- activación explícita y selección de ruleset compatible.

## Límite de esta fase

El bundle representa secciones revisadas como fragmentos de referencia. La
curaduría de reglas semánticas de mayor nivel seguirá siendo una fase separada;
esta implementación no inventa conclusiones tributarias a partir de texto
extraído.
