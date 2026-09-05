# Historial de análisis en drawer lateral

## Objetivo

Permitir revisar las ejecuciones de una colección sin abandonar sus facturas. El historial usa la API segura de la tarea F3-05A; no consulta ni muestra snapshots crudos.

## Alcance

Un botón **Historial** en la vista de colección abre un drawer lateral derecho. El drawer muestra una lista paginada de runs y un resumen del run seleccionado. El detalle especializado por factura queda fuera de este cambio y corresponde a F3-05C.

## Interacción

- El drawer conserva visible la colección de fondo y se cierra con botón, Escape o clic fuera.
- Encabezado: `Historial de análisis` y el nombre de la colección.
- Cada fila muestra propósito, período fijo, estado, fecha, proveedor/modelo y conteo de facturas.
- Un clic selecciona el run y sustituye la lista por su resumen seguro, con regreso a la lista.
- La lista empieza con la primera página y permite cargar la siguiente mediante `Ver más` cuando exista cursor.
- El estado seleccionado se refleja sin navegar ni modificar URL.

## Estados y lenguaje

- Vacío: explica que todavía no hay ejecuciones y dirige al usuario a configurar contexto y analizar.
- Cargando: usa skeletons, no una pantalla en blanco.
- En cola o ejecutándose: indica que el análisis está en curso.
- Bloqueado: muestra el mensaje seguro del gate y la acción siguiente, sin detalles internos.
- Fallido: informa que no se completó y permite revisar la configuración, sin exponer error técnico.
- Completado: muestra resumen, contexto y reglas fijadas disponibles en la proyección segura.

## Seguridad

El componente solo consume las proyecciones de `listAnalysisRunHistory` y `getAnalysisRunDetail`. No renderiza JSON, XML, Markdown, claves, identificadores innecesarios ni mensajes internos.

## Accesibilidad y responsive

El drawer mantiene foco, tiene etiqueta accesible, controles de cierre visibles y textos de botón de una línea. En móvil ocupa el ancho disponible; en escritorio se ancla a la derecha sin ocultar la colección.

## Verificación

- Pruebas de componente para vacío, carga, bloqueado, fallido y completado.
- Prueba de cursor `Ver más`.
- Prueba de que no se renderizan propiedades sensibles de la respuesta.
- Typecheck, build y health del repositorio.
