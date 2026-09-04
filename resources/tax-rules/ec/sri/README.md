# Rulesets tributarios del SRI

Este directorio guarda el material tributario que el equipo revisa y aprueba
para orientar análisis fiscales. No sustituye la ley, el SRI ni el criterio de
un contador o abogado.

El sistema separa tres cosas:

- `resources/tax-rules/`: manifiestos, secciones revisadas y bundles que sí se
  versionan en Git.
- `.cache/tax-rules/`: PDFs descargados, Markdown extraído, borradores y
  comparaciones de trabajo. Git ignora este directorio.
- Base de datos: copia operativa que se cargará después de revisar y publicar
  un bundle. Los comandos actuales no la modifican.

Los manifiestos incluidos hoy son puntos de descubrimiento. Están en estado
`draft`, no tienen hash y no habilitan reglas para un análisis.

## Flujo seguro

Sigue este orden para una fuente. No saltes de un PDF descargado a una regla
activa.

```text
check → fetch → extract → split → diff → revisión humana
```

1. Usa `check` para saber si la página oficial sigue disponible.
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

Consulta las páginas de descubrimiento registradas en `sources/` mediante
HTTPS y el host `www.sri.gob.ec`. Sirve para detectar fuentes inaccesibles o
que todavía no tienen un PDF resuelto.

No descarga ni guarda el PDF. Tampoco cambia manifiestos, reglas, bundles o la
base de datos.

El resultado por fuente puede ser:

- `source-unresolved`: la fuente aún no tiene un PDF con hash conocido. Busca
  el enlace exacto desde la página oficial antes de descargarlo.
- `update-candidate`: existe un hash anterior, pero hace falta descargar y
  comparar el nuevo contenido antes de afirmar que no cambió.
- `source-unavailable`: no se pudo consultar la página. Reintenta después; no
  concluyas que la norma dejó de existir por un fallo de red.

### `bun run rules:sri:fetch --source <id> --url <pdf-sri>`

Descarga un PDF de una fuente registrada. Usa el ID del archivo en `sources/`
y un enlace explícito al PDF que encontraste en el portal oficial.

Ejemplo:

```bash
bun run rules:sri:fetch \
  --source ec-sri-rlrti \
  --url 'https://www.sri.gob.ec/ruta-del-pdf-oficial.pdf'
```

El comando acepta solamente `https://www.sri.gob.ec`, sigue hasta tres
redirecciones dentro de ese host, exige `application/pdf`, comprueba la firma
`%PDF-`, limita el archivo a 20 MB y calcula SHA-256. Guarda el PDF de forma
atómica en `.cache/tax-rules/ec/sri/originals/` y registra sus metadatos en
`.cache/tax-rules/ec/sri/downloads/`.

No copies un enlace de Google Drive, correo, WhatsApp u otro dominio. No
edites el PDF descargado. Si el hash no coincide más adelante, vuelve a
ejecutar `fetch` desde el enlace oficial.

### `bun run rules:sri:extract --source <id>`

Lee el original descargado para la fuente indicada, verifica otra vez su hash y
extrae Markdown en `.cache/tax-rules/ec/sri/extracted/`. Añade marcadores de
página para que puedas volver al PDF durante la revisión.

Este paso requiere que hayas ejecutado `fetch`. Falla si el PDF no tiene texto
seleccionable. La primera versión no aplica OCR, por lo que debes conseguir un
PDF textual del SRI.

### `bun run rules:sri:split --source <id>`

Divide el Markdown extraído en borradores. Para leyes y reglamentos busca
encabezados de artículos, como `Art. 10.-`; para guías usa títulos en
mayúsculas. Cada borrador incluye páginas, offsets, hash de la fuente y estado
`draft`.

El resultado se escribe en `.cache/tax-rules/ec/sri/sections/drafts/`. Si el
comando no reconoce una estructura segura, produce una sola sección con estado
`ambiguous`. Revisa ese caso a mano; no cambies el título para forzar una
división automática.

### `bun run rules:sri:diff --source <id>`

Compara los borradores de una fuente contra las secciones revisadas que ya
existan en `sections/reviewed/`. Sirve para preparar una revisión de cambios.

El resultado separa:

- `added`: secciones nuevas.
- `removed`: secciones revisadas que ya no aparecen en el borrador.
- `modified`: cambió el texto.
- `pageOnlyChanged`: el texto coincide, pero cambió la página de referencia.
- `unchanged`: texto y páginas coinciden.

El comando no modifica secciones revisadas ni marca una regla como vigente.

### `bun run rules:sri:review --section <id>`

Muestra un borrador puntual y recuerda la información que debes comprobar:
texto, páginas, vigencia, propósito, régimen, evidencia y referencias
cruzadas. Es una ayuda para quien revisa, no una aprobación.

Ejemplo:

```bash
bun run rules:sri:review --section ec-sri-rlrti-art-28
```

Una revisión aprobada debe crear una sección nueva y trazable en
`sections/reviewed/`. Nunca sobrescribas una sección usada por un bundle ya
publicado.

## Comandos planificados

Estos comandos aparecen en el diseño, pero todavía no están implementados. No
los ejecutes esperando que publiquen material.

| Comando | Para qué servirá |
| --- | --- |
| `rules:sri:validate` | Validar schemas, hashes, referencias, vigencias y ausencia de borradores en un bundle candidato. |
| `rules:sri:build --version <versión>` | Crear un bundle determinista con hash para una versión revisada. |
| `rules:sri:sync:postgres --version <versión> --dry-run` | Mostrar y luego importar el bundle aprobado a PostgreSQL sin alterar versiones existentes. |

## Antes de considerar una regla utilizable

Una fuente descargada no basta. La persona revisora debe confirmar el enlace
oficial, el hash, la fecha de vigencia, las páginas y el alcance tributario.
Después debe convertir el borrador en sección revisada, construir un bundle
validado y activar la versión mediante una operación separada.

Hasta entonces, Bill-LM no debe usar ese material como normativa para decidir
el análisis de una factura.
