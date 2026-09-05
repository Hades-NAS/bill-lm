# Detalle especializado de factura en drawer lateral

## Objetivo

Permitir revisar una factura analizada sin abandonar el historial de su colección. El detalle se muestra dentro del drawer lateral derecho ya usado por el historial.

## Patrón de navegación

El drawer es el patrón estándar para ver detalles de entidades en la aplicación.

1. Historial de ejecuciones.
2. Resumen de una ejecución y sus facturas.
3. Detalle de una factura.

Cada nivel reemplaza el contenido del mismo drawer y ofrece un botón `Volver` al nivel anterior. No hay drawers anidados, modal adicional ni cambio de URL.

## Contenido de la factura

La vista consume únicamente la proyección segura del historial y presenta:

- Estado de análisis y propósito.
- Un único resultado especializado: IVA, IR de actividad o gastos personales.
- Clasificación, razonamiento e incertidumbres cuando existan.
- Referencias usadas y procedencia verificable en forma resumida.
- Aviso permanente: resultado orientativo, no dictamen del SRI.

No muestra snapshots crudos, XML, Markdown completo, claves, hashes sensibles, identificadores internos ni datos que no pertenezcan a la proyección segura.

## Estados

- `completed`: presenta el brazo especializado aplicable.
- `needs_review`: explica qué requiere validación humana y no muestra una conclusión fiscal como definitiva.
- `blocked` o `failed`: muestra estado y mensaje seguro, sin inventar un resultado.
- Cargando, vacío y error de consulta: mantienen el contexto del drawer y una acción de volver o reintentar.

## Accesibilidad y responsive

El drawer conserva el foco y un cierre accesible. En móvil usa el ancho disponible; en escritorio mantiene el anclaje derecho. Las referencias se agrupan en secciones legibles y los botones no se parten en dos líneas.

## Verificación

- Pruebas montadas para IVA, IR de actividad, gastos personales y `needs_review`.
- Pruebas para estados bloqueado/fallido y navegación de retorno.
- Prueba de ausencia de campos sensibles o snapshots crudos.
- Typecheck, build y health del repositorio.
