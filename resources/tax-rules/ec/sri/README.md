# Rulesets tributarios del SRI

Este directorio guarda el material tributario que el equipo revisa y aprueba
para orientar análisis fiscales. No sustituye la ley, el SRI ni el criterio de
un contador o abogado.

El sistema separa tres cosas:

- `resources/tax-rules/`: manifiestos, secciones revisadas y bundles que sí se
  versionan en Git.
- `.cache/tax-rules/`: PDFs descargados, Markdown extraído, borradores y
  comparaciones de trabajo. Git ignora este directorio.
- Base de datos: copia operativa que se carga únicamente después de revisar y
  publicar un bundle. Los comandos de sincronización muestran un plan por
  defecto y solo escriben cuando reciben `--apply`.

Los manifiestos incluidos hoy son puntos de descubrimiento. Están en estado
`draft`, no tienen hash y no habilitan reglas para un análisis.

Algunos manifiestos ya incluyen una URL PDF encontrada en el portal oficial.
Esa URL sirve como punto de partida, no como evidencia de vigencia ni de
contenido: `fetch` debe descargarla y registrar el hash antes de cualquier
revisión.

## Flujo seguro

Sigue este orden para una fuente. No saltes de un PDF descargado a una regla
activa.

```text
check → fetch → extract → split → diff → revisión humana
```

Para ejecutar los cinco pasos técnicos sobre todas las fuentes en un solo
comando, usa `bun run rules:sri:run`. La revisión humana sigue siendo un paso
separado y obligatorio.

1. Usa `check` para comparar el PDF oficial disponible con el último hash
   observado localmente.
2. Abre la página oficial del SRI y localiza el PDF exacto que quieres revisar.
3. Usa `fetch` con ese enlace PDF. El comando conserva el original y calcula
   su hash.
4. Usa `extract` para obtener Markdown con los límites de página.
5. Usa `split` para crear borradores por artículo o encabezado.
6. Usa `diff` para comparar los borradores con las secciones ya revisadas.
7. Lee el contenido, confirma vigencia, propósito y régimen. Solo una persona
   responsable puede crear una sección revisada y, más adelante, un bundle.

## Comandos disponibles

Ejecuta los comandos desde la raíz del proyecto.

### `bun run rules:sri:check`

Consulta el PDF resuelto de cada fuente mediante HTTPS y el host
`www.sri.gob.ec`, sin escribirlo en el caché. Calcula su hash en memoria y lo
compara con el último original descargado. Sirve para detectar fuentes
inaccesibles, enlaces aún no resueltos y contenido potencialmente actualizado.

No descarga ni guarda el PDF. Tampoco cambia manifiestos, reglas, bundles o la
base de datos.

El resultado por fuente puede ser:

- `source-unresolved`: la fuente aún no tiene un PDF resuelto. Busca el enlace
  exacto desde la página oficial antes de descargarlo.
- `unchanged`: el hash del PDF oficial coincide con el último original local.
  Aun así, no confirma por sí solo su vigencia jurídica.
- `update-candidate`: el PDF oficial difiere del último original local, o no
  existe un hash local. Ejecuta `fetch`, `extract`, `split` y revisión humana
  antes de concluir que cambió una regla.

Si la consulta falla, el lote la reporta como `failed` con un mensaje seguro.
Reintenta después; no concluyas que la norma dejó de existir por un fallo de
red.

### `bun run rules:sri:run [--source <id>]`

Ejecuta, en este orden, `check`, `fetch`, `extract`, `split` y `diff`. Para
cada fuente completa una etapa antes de empezar la siguiente; si una falla, no
ejecuta los pasos posteriores para esa fuente y continúa con las demás. El
resultado JSON indica la etapa fallida y las que sí terminaron.

Ejecuta todo el lote:

```bash
bun run rules:sri:run
```

Para repetir el flujo de una sola fuente:

```bash
bun run rules:sri:run --source ec-sri-rlrti
```

El comando puede volver a descargar originales aunque `check` informe
`unchanged`; esto deja el caché y los metadatos observados actualizados. No
acepta `--url`, no publica material, no modifica manifiestos ni la base de
datos. Si necesitas cambiar un enlace, usa primero `rules:sri:fetch --source`
con `--url`, revisa el resultado y luego ejecuta `run`.

### `bun run rules:sri:fetch [--source <id>] [--url <pdf-sri>]`

Sin `--source`, descarga cada fuente registrada que tenga `resolvedUrl`. Usa
`--source` para procesar solo una fuente. `--url` permite reemplazar el enlace
solo para esa fuente individual.

Ejemplo:

```bash
bun run rules:sri:fetch \
  --source ec-sri-rlrti \
  --url 'https://www.sri.gob.ec/ruta-del-pdf-oficial.pdf'
```

El comando acepta solamente `https://www.sri.gob.ec`, sigue hasta tres
redirecciones dentro de ese host, exige `application/pdf`, comprueba la firma
`%PDF-`, limita el archivo a 20 MB, usa un límite de espera de 30 segundos y
calcula SHA-256. Guarda el PDF de forma atómica en
`.cache/tax-rules/ec/sri/originals/` y registra sus metadatos técnicos
(tipo, tamaño declarado y última modificación cuando el servidor los entrega)
en `.cache/tax-rules/ec/sri/downloads/`.

No copies un enlace de Google Drive, correo, WhatsApp u otro dominio. No
edites el PDF descargado. Si el hash no coincide más adelante, vuelve a
ejecutar `fetch` desde el enlace oficial.

### `bun run rules:sri:extract [--source <id>]`

Lee el original descargado para la fuente indicada, verifica otra vez su hash y
extrae Markdown en `.cache/tax-rules/ec/sri/extracted/`. Añade marcadores de
página para que puedas volver al PDF durante la revisión.

Sin `--source`, procesa todos los originales descargados. Este paso requiere
que hayas ejecutado `fetch`. Falla si el PDF no tiene texto seleccionable. La
primera versión no aplica OCR, por lo que debes conseguir un PDF textual del
SRI.

### `bun run rules:sri:split [--source <id>]`

Divide el Markdown extraído en borradores. Para leyes y reglamentos busca
encabezados de artículos, como `Art. 10.-`. Las guías y formularios se dejan
intencionalmente como una sola sección `ambiguous` hasta tener una estrategia
de división específica por fuente: sus títulos no son una estructura fiable
para producir reglas automáticamente. Cada borrador incluye páginas, offsets,
hash de la fuente y estado `draft` o `ambiguous`.

El resultado se escribe en `.cache/tax-rules/ec/sri/sections/drafts/`. Si el
comando no reconoce una estructura segura, produce una sola sección con estado
`ambiguous`. Revisa ese caso a mano; no cambies el título para forzar una
división automática.

Sin `--source`, crea borradores para todas las extracciones disponibles.

### `bun run rules:sri:diff [--source <id>]`

Compara los borradores de una fuente contra las secciones revisadas que ya
existan en `sections/reviewed/`. Sirve para preparar una revisión de cambios.

El resultado separa:

- `added`: secciones nuevas.
- `removed`: secciones revisadas que ya no aparecen en el borrador.
- `modified`: cambió el texto.
- `pageOnlyChanged`: el texto coincide, pero cambió la página de referencia.
- `unchanged`: texto y páginas coinciden.

El comando no modifica secciones revisadas ni marca una regla como vigente.
Guarda cada comparación de forma atómica en `.cache/tax-rules/ec/sri/diffs/`.
El nombre incluye hashes de borradores y secciones revisadas, por lo que una
revisión puede reproducir exactamente qué se comparó. Sin `--source`, prepara
la comparación para todas las fuentes.

## Errores y ejecución por lote

Los comandos `fetch`, `extract`, `split` y `diff` procesan todas las fuentes
definidas si omites `--source`. Trabajan una fuente a la vez. Si una falla,
continúan con las demás y muestran un resumen JSON con `completed` y `failed`.
El proceso termina con código distinto de cero cuando hubo fallos, para que un
script o CI pueda detectarlos.

Los mensajes indican el siguiente paso útil, por ejemplo ejecutar `fetch`
antes de `extract`. El comando no muestra stack traces, URLs ajenas permitidas
ni detalles internos inesperados.

### `bun run rules:sri:review --section <id>`

Muestra un borrador puntual y recuerda la información que debes comprobar:
texto, páginas, vigencia, propósito, régimen, evidencia y referencias
cruzadas. Es una ayuda para quien revisa, no una aprobación.

Ejemplo:

```bash
bun run rules:sri:review --section ec-sri-rlrti-art-28
```

Si la sección está marcada como `ambiguous` y confirmas que sus límites son
correctos, continúa con `resolve`. No edites JSON manualmente ni sobrescribas
una sección usada por un bundle ya publicado.

### `bun run rules:sri:resolve --section <id>`

Registra una decisión humana para una única sección `ambiguous`. Conserva el
texto y las páginas del borrador, crea una revisión nueva y guarda la
justificación junto con quien la aprobó. No modifica el borrador, no promueve
todo el resto de la fuente y no escribe en la base de datos.

```bash
bun run rules:sri:resolve \
  --section ec-sri-rlrti-art-196-part-2 \
  --reviewer "Nombre responsable" \
  --purpose vat_credit \
  --tax-regime general \
  --effective-from 2026-01-01 \
  --rationale "Confirmé el texto, la página, la vigencia y el alcance tributario de este fragmento."
```

Los valores del ejemplo muestran la forma del comando: antes de ejecutarlo,
decide el propósito y régimen correctos para el contenido concreto. La
justificación debe explicar por qué el fragmento es autónomo y por qué esa
clasificación aplica. El comando rechaza una sección inexistente, una sección
que no sea ambigua, una fecha inválida o un ID ya revisado; en esos casos no
crea archivos.

Una resolución no convierte automáticamente toda la fuente en apta para
`promote --all`: cada sección ambigua necesita su propia decisión y las demás
secciones pueden tener distinto alcance fiscal.

### `bun run rules:sri:promote`

Después de revisar una sección, crea una copia revisada versionable. Debes
indicar quién la revisó, propósito, régimen y vigencia; el comando no infiere
estos datos desde el PDF.

Cuando la promoción representa una decisión de alcance, agrega
`--rationale`. La justificación se almacena como nota de revisión junto al
artefacto y facilita auditoría posterior.

```bash
bun run rules:sri:promote \
  --section ec-sri-lrti-art-10 \
  --reviewer "Nombre responsable" \
  --purpose business_income_tax \
  --tax-regime general \
  --effective-from 2026-01-01 \
  --rationale "Expliqué el alcance tributario confirmado y los límites de esta sección."
```

Puedes indicar `--effective-to YYYY-MM-DD` cuando corresponda. El comando
rechaza secciones `ambiguous`, no sobrescribe revisiones existentes y crea el
archivo en `sections/reviewed/`. No activa reglas ni escribe en la base de
datos.

### Promover todas las secciones de una fuente

Cuando ya revisaste todas las secciones de una misma fuente y todas comparten
el mismo propósito, régimen y vigencia, usa `--all` con `--source`:

```bash
bun run rules:sri:promote \
  --all \
  --source ec-sri-lrti \
  --reviewer "Nombre responsable" \
  --purpose business_income_tax \
  --tax-regime general \
  --effective-from 2026-01-01
```

`--all` no mezcla fuentes y no acepta `--section`. Antes de crear archivos
valida todo el lote. Si falta un borrador, una sección es `ambiguous` o ya fue
promovida, no crea ninguna revisión del lote.

#### Estado revisado de las fuentes y comandos posibles

La revisión de los originales descargados muestra que las seis fuentes no
tienen un único propósito y régimen aplicable. El comando `promote --all`
sirve solo cuando todas las secciones de una fuente comparten la misma
selección. No ocurre con LRTI ni con su reglamento, que cubren IR e IVA.

| Fuente                           | Alcance constatado                                                        | Estado actual                                                                                         | Acción correcta                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ec-sri-lrti`                    | Ley primaria de IR e IVA                                                  | Sus 175 secciones ya se promovieron como `business_income_tax` / `general` desde `2026-01-01`.        | No ejecutes `promote` otra vez. Esa publicación no cubre IVA ni gastos personales; requiere una revisión por secciones antes de crear otro ruleset. |
| `ec-sri-lrti-2026`               | Copia vigente de LRTI para IVA general mensual                            | Arts. 64, 65, 66, 67 y 69 curados como `vat_credit` / `general`; bundle v3 activo desde `2026-01-01`. | No vuelvas a promover esos IDs. Revisa una fuente nueva si el SRI modifica la LRTI o si amplías cobertura.                                          |
| `ec-sri-rlrti`                   | Reglamento de IR e IVA; el PDF descargado indica reforma al `2026-05-22`. | 332 borradores y 10 secciones `ambiguous`.                                                            | Revisa y divide primero las secciones ambiguas; después clasifica por sección para IR o IVA.                                                        |
| `ec-sri-ir-natural-person-guide` | Declaración de IR de personas naturales.                                  | Una sección `ambiguous`.                                                                              | Divide y revisa la guía antes de asignarla a `personal_expenses` u otro propósito.                                                                  |
| `ec-sri-ir-rimpe-guide`          | Declaración de IR RIMPE para Negocios Populares y Emprendedores.          | Una sección `ambiguous`.                                                                              | Divide y revisa; necesita cobertura para `rimpe_popular_business` y `rimpe_entrepreneur`, no una sola selección.                                    |
| `ec-sri-vat-form-guide`          | Declaración de IVA mensual y semestral.                                   | Una sección `ambiguous`.                                                                              | Divide y revisa antes de usarla para `vat_credit`; la periodicidad se fija al crear el ruleset.                                                     |

Usa estas recetas para volver a descargar y preparar cada fuente. Puedes usar
`bun run rules:sri:run --source <id>` como atajo para ejecutar los cinco pasos
de una receta.

```bash
# LRTI vigente usada por IVA general mensual 2026
bun run rules:sri:check --source ec-sri-lrti-2026
bun run rules:sri:fetch --source ec-sri-lrti-2026
bun run rules:sri:extract --source ec-sri-lrti-2026
bun run rules:sri:split --source ec-sri-lrti-2026
bun run rules:sri:diff --source ec-sri-lrti-2026

# LRTI
bun run rules:sri:check --source ec-sri-lrti
bun run rules:sri:fetch --source ec-sri-lrti
bun run rules:sri:extract --source ec-sri-lrti
bun run rules:sri:split --source ec-sri-lrti
bun run rules:sri:diff --source ec-sri-lrti

# Reglamento para la Aplicación de la LRTI
bun run rules:sri:check --source ec-sri-rlrti
bun run rules:sri:fetch --source ec-sri-rlrti
bun run rules:sri:extract --source ec-sri-rlrti
bun run rules:sri:split --source ec-sri-rlrti
bun run rules:sri:diff --source ec-sri-rlrti

# Guía de IR para personas naturales
bun run rules:sri:check --source ec-sri-ir-natural-person-guide
bun run rules:sri:fetch --source ec-sri-ir-natural-person-guide
bun run rules:sri:extract --source ec-sri-ir-natural-person-guide
bun run rules:sri:split --source ec-sri-ir-natural-person-guide
bun run rules:sri:diff --source ec-sri-ir-natural-person-guide

# Guía de IR RIMPE
bun run rules:sri:check --source ec-sri-ir-rimpe-guide
bun run rules:sri:fetch --source ec-sri-ir-rimpe-guide
bun run rules:sri:extract --source ec-sri-ir-rimpe-guide
bun run rules:sri:split --source ec-sri-ir-rimpe-guide
bun run rules:sri:diff --source ec-sri-ir-rimpe-guide

# Guía de IVA
bun run rules:sri:check --source ec-sri-vat-form-guide
bun run rules:sri:fetch --source ec-sri-vat-form-guide
bun run rules:sri:extract --source ec-sri-vat-form-guide
bun run rules:sri:split --source ec-sri-vat-form-guide
bun run rules:sri:diff --source ec-sri-vat-form-guide
```

Estos comandos sirven para inspeccionar los puntos bloqueados antes de
resolverlos de forma individual con `rules:sri:resolve`:

```bash
# Reglamento: las diez secciones repetidas requieren límites manuales.
bun run rules:sri:review --section ec-sri-rlrti-art-196-part-2
bun run rules:sri:review --section ec-sri-rlrti-art-196-part-3
bun run rules:sri:review --section ec-sri-rlrti-art-196-part-4
bun run rules:sri:review --section ec-sri-rlrti-art-1-part-2
bun run rules:sri:review --section ec-sri-rlrti-art-2-part-2
bun run rules:sri:review --section ec-sri-rlrti-art-3-part-2
bun run rules:sri:review --section ec-sri-rlrti-art-4-part-2
bun run rules:sri:review --section ec-sri-rlrti-art-5-part-2
bun run rules:sri:review --section ec-sri-rlrti-art-6-part-2
bun run rules:sri:review --section ec-sri-rlrti-art-7-part-2

# Las tres guías todavía tienen una única sección ambigua.
bun run rules:sri:review --section ec-sri-ir-natural-person-guide-unresolved-structure
bun run rules:sri:review --section ec-sri-ir-rimpe-guide-unresolved-structure
bun run rules:sri:review --section ec-sri-vat-form-guide-unresolved-structure
```

No hay un comando `promote --all` correcto para estas cuatro fuentes hoy. Un
comando único las etiquetaría con un propósito o régimen falso y dejaría fuera
otros perfiles que sí cubre el material. Antes de habilitar esa promoción hace
falta separar sus secciones por alcance y permitir más de un propósito o
régimen cuando una sección realmente aplique a ambos.

### `bun run rules:sri:validate`

Valida las secciones revisadas versionadas: IDs únicos, fuentes registradas y
vigencias coherentes. No usa borradores ni escribe archivos. Si aún no hay una
sección resuelta o promovida, falla de forma intencional y te indica el
siguiente paso.

Después de resolver o promover las secciones necesarias, ejecuta:

```bash
bun run rules:sri:validate
```

### `bun run rules:sri:build`

Construye un bundle inmutable desde secciones ya validadas. Requiere una versión
entera, quién lo crea y su vigencia:

```bash
bun run rules:sri:build \
  --version 1 \
  --created-by "Nombre responsable" \
  --effective-from 2026-01-01
```

El bundle se guarda en `rulesets/`, incluye su hash y no se sobrescribe. Puede
distribuir fragmentos revisados sin inventar reglas semánticas; esas reglas se
curan en una fase separada.

La secuencia local completa termina aquí; no toca la DB:

```bash
bun run rules:sri:validate
bun run rules:sri:build \
  --version 1 \
  --created-by "Nombre responsable" \
  --effective-from 2026-01-01
```

### `bun run rules:sri:sync:db`

Importa un bundle revisado a la copia operativa de la base de datos. Requiere
la versión y la selección a la que aplica el ruleset:

```bash
bun run rules:sri:sync:db \
  --version 1 \
  --purpose vat_credit \
  --tax-regime general \
  --vat-filing-frequency monthly
```

Sin `--apply` solo valida el bundle y muestra el plan; no abre conexión a la
base de datos ni modifica datos. Con `--apply` usa una transacción para crear
las fuentes, fragmentos y ruleset revisado. Repetir el mismo contenido es
seguro; una versión ya existente con hash distinto se rechaza para conservar la
trazabilidad.

Usa `-e local` o `--env local` para leer `.env.local`; sin flag se lee `.env`.
El nombre del entorno no admite rutas y el comando jamás imprime
`DATABASE_URL`.

### `bun run rules:sri:activate:db`

Activa de forma explícita un ruleset que ya fue sincronizado y revisado. La
selección debe coincidir con la usada al importarlo:

```bash
bun run rules:sri:activate:db \
  --version 1 \
  --purpose vat_credit \
  --tax-regime general \
  --vat-filing-frequency monthly \
  --apply
```

### Publicación actual: IVA general mensual 2026

El bundle `ec-sri-2026.3` ya fue sincronizado y activado para
`vat_credit + general + monthly` en la base indicada por `.env`. Tiene cinco
fragmentos de `ec-sri-lrti-2026` y vigencia desde `2026-01-01`.

No ejecutes los siguientes comandos contra esa misma base salvo que hayas
creado una versión nueva del bundle. Son la receta exacta de publicación para
un entorno vacío o autorizado:

```bash
bun run rules:sri:sync:db \
  --version 3 \
  --purpose vat_credit \
  --tax-regime general \
  --vat-filing-frequency monthly \
  --apply

bun run rules:sri:activate:db \
  --version 3 \
  --purpose vat_credit \
  --tax-regime general \
  --vat-filing-frequency monthly \
  --apply
```

El contexto de la colección debe abarcar 2026 para seleccionar este ruleset.
Un contexto de 2025 se mantiene bloqueado deliberadamente: la versión no se
aplica de forma retroactiva.

Sin `--apply` solo informa cuál ruleset se activaría. Con `--apply` activa esa
versión y retira el ruleset activo anterior de la misma selección. No modifica
otros propósitos, regímenes ni periodicidades.

## Antes de considerar una regla utilizable

Una fuente descargada no basta. La persona revisora debe confirmar el enlace
oficial, el hash, la fecha de vigencia, las páginas y el alcance tributario.
Después debe convertir el borrador en sección revisada con `resolve` o
`promote`, construir un bundle validado y activar la versión mediante una
operación separada.

Hasta entonces, Bill-LM no debe usar ese material como normativa para decidir
el análisis de una factura.
