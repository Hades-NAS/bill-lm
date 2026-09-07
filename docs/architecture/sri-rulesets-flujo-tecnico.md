# Flujo técnico de fuentes oficiales y rulesets SRI

Este documento describe cómo Bill-LM prepara fuentes oficiales del SRI y cómo
las usa en un análisis. Complementa la guía para personas no técnicas:
[Fuentes oficiales para los análisis](../sri/fuentes-oficiales-para-analisis.md).

## 1. Preparación y publicación del material

El equipo mantiene manifiestos versionados en
`resources/tax-rules/ec/sri/sources/`. Cada manifiesto identifica la fuente,
el emisor, la URL oficial, la jurisdicción y la vigencia esperada.

El flujo de preparación es:

```text
check → fetch → extract → split → diff → revisión humana
      → promote → validate → build → sync:db → activate:db
```

| Etapa | Responsabilidad | Salida | No hace |
| --- | --- | --- | --- |
| `check` | Consulta la fuente oficial y compara su huella con la conocida. | Estado de cambio potencial. | No descarga ni publica. |
| `fetch` | Descarga un PDF desde `https://www.sri.gob.ec`, verifica tipo, firma, tamaño y hash. | Original y metadatos en `.cache/`. | No cambia reglas activas. |
| `extract` | Extrae Markdown con marcadores de página desde el original verificado. | Texto derivado. | No modifica el PDF. |
| `split` | Crea borradores por artículo cuando la estructura es confiable. | Secciones `draft` o `ambiguous`. | No clasifica alcance tributario. |
| `diff` | Compara borradores con secciones revisadas. | Cambios añadidos, eliminados o modificados. | No promueve contenido. |
| Revisión humana | Confirma texto, páginas, vigencia, propósito y régimen. | Decisión de curación. | No infiere conclusiones legales. |
| `promote` | Guarda una sección revisada con responsable y justificación. | Artefacto versionado. | No escribe DB. |
| `validate` | Revisa IDs, hashes, vigencias, cobertura y estados. | Validación reproducible. | No activa un ruleset. |
| `build` | Construye un bundle inmutable y calcula su hash. | Bundle versionado. | No escribe DB. |
| `sync:db` | Copia el bundle revisado a la DB tras mostrar un plan. | Fuente, fragmentos y ruleset operativos. | No lo hace aplicable. |
| `activate:db` | Marca una combinación publicada como aplicable. | Ruleset activo. | No modifica el bundle. |

Los originales, extracciones, borradores y comparaciones viven en `.cache/`.
Git no versiona ese espacio de trabajo. Git versiona manifiestos, secciones
revisadas y bundles. La DB recibe solo bundles validados y publicados.

## 2. Selección desde la web

La persona crea una colección y guarda una revisión de contexto con:

- propósito: `vat_credit`, `business_income_tax` o `personal_expenses`;
- inicio y fin del período;
- revisión de perfil tributario;
- revisiones de actividades económicas cuando el propósito las requiere.

Al solicitar análisis, el procedimiento de colecciones:

1. autoriza a la persona sobre la colección;
2. lee la última revisión de contexto y sus dependencias;
3. busca un `TaxRuleSet` con estado activo que coincida con propósito, régimen,
   periodicidad y todo el período;
4. selecciona evidencia oficial vigente dentro de ese ruleset;
5. normaliza las facturas XML elegibles;
6. crea un `AnalysisRun` y un envelope inmutable antes de encolar.

El selector rechaza una combinación sin ruleset o sin evidencia aplicable. La UI
recibe un mensaje accionable y el servidor guarda el run como bloqueado. La
aplicación no consulta PDFs del SRI en este camino.

## 3. Envelope y gates

El envelope de ejecución fija versiones y contenido para reproducibilidad:

```text
contexto + perfil + actividades + conexión/modelo
+ ruleset/version/hash + evidencia oficial + facturas normalizadas
```

`AnalysisExecutionEnvelopeSchema` es estricto. Solo admite evidencia oficial;
no acepta material cargado por usuarios. El prompt recibe la proyección mínima
del envelope y exige el contrato JSON del propósito solicitado.

El gate se ejecuta dos veces:

1. **Antes de la cola:** evita crear trabajo pagado si falta configuración,
   ruleset, evidencia o factura utilizable.
2. **En el worker:** vuelve a comprobar el snapshot, la conexión activa y el
   modelo fijado antes de descifrar la clave o llamar al proveedor.

Un fallo deja el run como `blocked`. Un fallo operativo posterior queda como
`failed`. Ninguno habilita una llamada al modelo con reglas faltantes.

## 4. Worker y persistencia

El worker recibe el identificador del run. Carga el snapshot persistido, aplica
el segundo gate y construye el prompt por factura. El proveedor recibe las
secciones oficiales seleccionadas, nunca el PDF completo ni referencias
autogestionadas.

Tras recibir la respuesta, el servidor valida el contrato especializado:

- IVA: crédito potencial, porcentaje, tipo de crédito y evidencia faltante.
- Impuesto a la renta de actividad: uso de negocio, gasto potencial y sustento.
- Gastos personales: categoría, valor potencial, beneficiario y evidencia.

`AnalysisResult` guarda el resultado, el propósito y la procedencia oficial. El
historial proyecta una versión segura para la UI: no expone IDs internos, hashes,
Markdown de reglas, snapshots crudos ni secretos.

## 5. Trazabilidad y cambios posteriores

Cada `AnalysisRun` conserva el `rulesetId`, versión, hash de contenido, versión
del prompt, proveedor/modelo, revisiones de contexto y snapshots de factura.

Una corrección normativa crea una fuente o revisión nueva, pasa de nuevo por
curación y publica otro bundle. La activación cambia qué usa un análisis futuro.
No reescribe resultados anteriores.

## 6. Operación y límites

El operador usa los comandos descritos en el
[README operativo de SRI](../../resources/tax-rules/ec/sri/README.md). Debe
revisar los artifacts antes de promoverlos y seleccionar explícitamente el
entorno de DB al sincronizar o activar.

Los controles técnicos verifican procedencia, integridad, estructura y
consistencia de los artifacts. No verifican por sí solos una interpretación
tributaria ni reemplazan la revisión responsable de vigencia y alcance.
