# Reporte de ejecución inicial del pipeline SRI

Fecha de inspección: 2026-09-04  
Alcance: artefactos locales producidos por `check`, `fetch`, `extract`, `split`
y `diff`. No constituye revisión jurídica, aprobación de normas ni prueba de
integración con el worker.

## Resultado ejecutivo

El pipeline completó la adquisición, extracción y generación de borradores para
las cinco fuentes registradas. Cada descarga conserva hash, tamaño, URL final y
archivo original. Las cinco extracciones produjeron Markdown y las cinco
fuentes generaron borradores con páginas y offsets válidos.

No conviene promover ninguna sección todavía. El splitter actual sirve como
prototipo para leyes y reglamentos, pero fragmenta las guías por demasiadas
líneas en mayúsculas. También generó IDs duplicados en cuatro de las cinco
fuentes. Una revisión humana sobre esos borradores sería ruidosa y no tendría
una identidad estable para un ruleset futuro.

## Evidencia encontrada

| Fuente | PDF | Markdown | Borradores | IDs duplicados | Observación |
| --- | ---: | ---: | ---: | ---: | --- |
| Guía IR personas naturales | 2.11 MB | 214,462 caracteres | 1,506 | 168 | Sobrefragmentación crítica. |
| Guía IR RIMPE | 2.48 MB | 27,418 caracteres | 221 | 28 | Sobrefragmentación crítica. |
| LRTI | 0.36 MB | 427,802 caracteres | 175 | 0 | Resultado inicial utilizable para revisión técnica. |
| Reglamento LRTI | 1.52 MB | 828,744 caracteres | 342 | 8 | Revisar artículos repetidos o títulos normalizados al mismo ID. |
| Guía formulario IVA | 1.48 MB | 49,774 caracteres | 286 | 5 | Sobrefragmentación y colisiones menores. |

Las cinco descargas quedaron en `.cache/tax-rules/ec/sri/originals/`, tienen un
registro en `downloads/` y el tamaño registrado coincide con el archivo local.
Los borradores no tienen texto vacío, todos incluyen al menos una página y los
offsets de inicio y fin son coherentes.

## Lo que salió bien

- El lote recorrió las cinco fuentes y dejó un registro independiente por ID.
- Los originales permanecen fuera de Git y los hashes se conservan en los
  registros de descarga.
- La extracción no necesitó OCR y conservó marcadores de página.
- El runner por lote continúa cuando una fuente falla y entrega un resultado
  estructurado por fuente.
- La CLI convierte errores de dominio en mensajes seguros y no expone errores
  internos inesperados.
- Ningún manifiesto pasó a `reviewed` ni se creó un ruleset activo. Esa barrera
  se mantiene correcta.

## Hallazgos y ajustes propuestos

### P0: corregir el splitter antes de revisar secciones

El patrón actual para guías trata casi cualquier línea larga en mayúsculas como
encabezado. Las guías de IR e IVA incluyen rótulos, casilleros y fragmentos
visuales en mayúsculas. El resultado son cientos de secciones pequeñas y 201
IDs duplicados entre las tres guías.

Propuesta:

1. Usar estrategias por `sourceKind`, no un patrón genérico para todas las
   guías.
2. Exigir señales adicionales para un encabezado de guía: línea aislada,
   longitud razonable, ausencia de números de casillero y separación vertical.
3. Dar preferencia a títulos numerados, como `1. Período fiscal`, o a una lista
   explícita de encabezados de cada guía.
4. Generar un borrador `ambiguous` cuando el detector encuentre demasiadas
   coincidencias, en vez de producir cientos de secciones aparentemente
   confiables.
5. Validar unicidad de `id` antes de escribir el archivo de borradores. Si hay
   una colisión, el comando debe fallar para esa fuente o marcar las secciones
   involucradas como ambiguas.

La LRTI es la única fuente sin colisiones. Aun así, el resultado debe pasar por
una revisión de límites de artículo antes de crear secciones revisadas.

### P1: persistir el resultado de `diff`

El comando `diff` imprime su resultado, pero no existe ningún archivo en
`.cache/tax-rules/ec/sri/diffs/`. Sin un artefacto persistente no se puede
comparar una ejecución contra otra, adjuntar la revisión al cambio ni auditar
la decisión de promoción.

Propuesta: guardar un JSON atómico por fuente y par de hashes. Debe incluir el
hash del original nuevo, el hash de la última fuente revisada, timestamp,
secciones añadidas, eliminadas, modificadas, cambios solo de página y reglas
afectadas.

### P1: separar el estado observado del estado aprobado

Los registros de descarga tienen hash y URL final, mientras los manifiestos
versionados siguen con `contentHash: null` y `reviewStatus: draft`. Eso evita
activar material sin revisión, que es correcto. Sin embargo, `check` no puede
usar el hash local para comparar cambios y sigue reportando la fuente como no
resuelta.

Propuesta: mantener el manifiesto como contrato aprobado y leer el registro de
`.cache/downloads/` como estado observado. `check` puede comparar contra ese
registro sin modificar `resources/`. La promoción humana copiaría los datos
confirmados al manifiesto revisado o al bundle, nunca al revés.

### P2: completar el registro de adquisición y resiliencia de red

El registro actual conserva URL final, hash, tamaño y timestamp. Falta guardar
el tipo MIME recibido y un subconjunto seguro de headers. También falta un
timeout explícito con `AbortSignal`; una descarga que no responde puede retener
el lote.

Propuesta:

- registrar `contentType`, `contentLength` y `lastModified` cuando el SRI los
  entregue;
- usar timeout por solicitud y clasificar el mensaje como timeout, red,
  redirección, MIME, tamaño o PDF inválido;
- incluir el resultado de cada intento en el resumen de lote, sin exponer
  contenido de headers ni stack traces.

### P2: limitar el tamaño operativo del texto extraído

El Reglamento produjo 828,744 caracteres de Markdown y la LRTI 427,802. Eso
no impide conservar los originales, pero un paso posterior no debe cargar esos
textos completos en un prompt ni en memoria sin límite.

Propuesta: conservar el Markdown completo en caché, pero procesar y validar
por sección. El build solo debe incluir secciones revisadas y delimitadas.

## Seguimiento de mejoras aplicadas

Las recomendaciones P0, P1 y P2 de este reporte ya se aplicaron y se
verificaron el mismo día. El contenido de esta sección reemplaza el diagnóstico
inicial cuando difiera de él.

| Hallazgo inicial | Cambio aplicado | Resultado verificado |
| --- | --- | --- |
| Guías sobrefragmentadas e IDs repetidos | Las guías y formularios quedan como una sola sección `ambiguous` hasta disponer de un divisor específico por fuente. Las repeticiones de artículos en leyes o reglamentos se identifican de forma única y se marcan `ambiguous`. | IR personas naturales: 1 sección ambigua; RIMPE: 1; guía IVA: 1. LRTI: 175 secciones sin ambigüedad. Reglamento LRTI: 342, de las cuales 10 requieren revisión. Cero IDs duplicados. |
| `diff` solo imprimía consola | Cada comparación se guarda atómicamente en `.cache/tax-rules/ec/sri/diffs/`, con hashes de borradores y revisadas, hash de fuente y fecha de generación. | Ocho artefactos de comparación locales después de regenerar el lote. |
| `check` no comparaba estado observado | `check` descarga el PDF oficial solo en memoria, lo valida y compara su hash contra `downloads/`, sin modificar manifiestos versionados. | Las cinco fuentes respondieron `unchanged`; no hubo fallos. |
| Descarga sin timeout ni metadatos HTTP | Se agregó límite de 30 segundos y se registran tipo MIME, longitud declarada y última modificación si el servidor la informa. Las escrituras de caché son atómicas. | Cobertura unitaria para comparación de hash observada y adquisición segura. |

El Markdown completo permanece solo en caché. No existe todavía un paso que lo
envíe a un modelo ni un bundle aprobable: el futuro build debe seleccionar
únicamente secciones revisadas y delimitadas. Por eso los documentos grandes no
entran en una ruta de análisis en este estado.

## Estado de preparación

| Capacidad | Estado | Evidencia |
| --- | --- | --- |
| Descarga con hash y caché | Listo para continuar | Cinco originales y registros presentes. |
| Extracción de PDF textual | Listo para continuar | Cinco Markdown generados. |
| Split técnico | Listo con límites | Leyes/reglamentos tienen IDs únicos; las guías están retenidas como ambiguas hasta un splitter específico. |
| Diff auditable | Listo para revisión técnica | Se persiste un artefacto hashable por comparación. |
| Revisión humana | Permitida con criterio | Puede empezar por LRTI y reglamento; no promover las guías ambiguas. |
| Bundle validado y publicación | Aún no iniciado | No hay secciones revisadas ni rulesets. |
| Uso por análisis/worker | No permitido | No existe corpus aprobado ni activo. |

## Recomendación de siguiente paso

Diseñar un divisor específico para cada guía solo si se necesita convertir sus
contenidos en reglas. Mientras tanto, empezar una revisión humana delimitada
de la LRTI y el reglamento, incluyendo las 10 secciones ambiguas del reglamento
antes de promover cualquiera.

No recomiendo avanzar a `validate`, `build`, sincronización de base de datos o
análisis con LLM hasta resolver los hallazgos P0 y P1.
