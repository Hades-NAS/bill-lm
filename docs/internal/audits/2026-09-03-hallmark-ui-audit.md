# Auditoría UI · Hallmark · 2026-09-03

## Alcance y evidencia

Auditoría de solo lectura de las rutas públicas, autenticación, navegación,
colecciones, detalle de colección, facturas, trabajos, configuración, tablas,
modales y componentes compartidos. No se modificó la UI como parte de esta
auditoría.

La revisión estática confirma estructura, copy y affordances. Los puntos
marcados **requiere prueba visual** deben comprobarse autenticado, en 320, 375,
414 y 768 px, antes de aprobar su cambio.

## Resumen para decidir

| Prioridad | Hallazgos | Recomendación                                                                                                     |
| --------- | --------: | ----------------------------------------------------------------------------------------------------------------- |
| P0        |         2 | Corregir antes de seguir creciendo: copy tributario inexacto y eliminación de colección aparentemente inoperante. |
| P1        |         5 | Siguiente bloque de UX: móvil de tablas, densidad del detalle, referencias y acciones destructivas.               |
| P2        |        10 | Consolidar estados, formularios, modales y navegación.                                                            |
| P3        |         4 | Pulido editorial y consistencia.                                                                                  |

## Estado de implementación · 2026-09-03

Las remediaciones de código para A-01 a A-22 se implementaron en las tareas
UI-01 a UI-07: la promesa pública refleja referencias autogestionadas, las
acciones destructivas son funcionales y explícitas, configuración usa listas y
modales, los estados compartidos son reutilizables, y colecciones/trabajos
tienen una presentación móvil sin tabla horizontal como superficie principal.

La validación estática pasó con `bash health.sh` (tipado, build, 34 pruebas
Vitest y 2 E2E). Quedan **pendientes de comprobación visual autenticada** los
breakpoints 320/375/414/768, foco/teclado de modales y menús, y los flujos con
Firebase/MinIO. Esta auditoría no marca esas verificaciones como completadas
sin una sesión real y navegador disponible.

---

## P0 · Corregir primero

### A-01 · La landing promete normativa oficial que ya no existe

- **Estado actual:** la página pública dice “normativa actual del SRI”,
  “Análisis SRI Actualizado” y “asesoría basada en SRI actualizada”.
  [index.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(public)/index.tsx:94>)
- **Propuesta:** cambiar el relato a “referencias fiscales que configuras” y
  añadir una nota visible: “No sustituye asesoría tributaria profesional”.
- **Por qué:** el flujo actual usa hasta tres documentos autoaprobados por el
  usuario; presentarlo como normativa oficial sería engañoso y riesgoso.
- **Evidencia:** confirmado por código.

### A-02 · Eliminar colección parece disponible, pero no ejecuta eliminación

- **Estado actual:** la tarjeta abre una confirmación destructiva, pero su
  `onConfirm` solo cierra el modal.
  [collection-card.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/collection/collection-card.tsx:64)
- **Propuesta:** conectar la mutación real, invalidar la lista y mostrar carga
  y error dentro de la confirmación.
- **Por qué:** un control destructivo que no cambia el estado rompe la
  confianza y vuelve ambigua la interfaz.
- **Evidencia:** confirmado por código.

---

## P1 · Aprobar como próximo bloque de UX

### A-03 · Las tablas no ofrecen una presentación móvil útil

- **Estado actual:** el detalle de colección usa 11 columnas y `minWidth=700`;
  trabajos y detalles de factura también dependen de tablas anchas.
  [$id.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/collections/$id.tsx:609>)
  · [jobs/index.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/jobs/index.tsx:97>)
  · [bill-detail.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/bill/bill-detail.tsx:212)
- **Propuesta:** conservar tabla en escritorio; en móvil usar filas resumidas o
  tarjetas y abrir el detalle/razonamiento en modal.
- **Por qué:** el scroll horizontal no falla técnicamente, pero impide escanear,
  seleccionar y revisar información clave desde teléfono.
- **Evidencia:** estructura confirmada; **requiere prueba visual**.

### A-04 · El detalle de colección tiene demasiadas superficies equivalentes

- **Estado actual:** resumen, datos fiscales, instrucciones, análisis, filtro y
  tabla se encadenan en Cards/Papers con bordes y sombras repetidas.
  [$id.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/collections/$id.tsx:410>)
- **Propuesta:** ordenar en tres zonas: resumen de colección, acción primaria
  “Analizar” y workspace de facturas; mantener una sola superficie principal
  para la tabla.
- **Por qué:** las cards anidadas son un tell de Hallmark y hacen que todas las
  áreas parezcan tener la misma prioridad.
- **Evidencia:** confirmado por código; **requiere prueba visual** para fijar
  la jerarquía final.

### A-05 · Referencias fiscales debería ser lista + modal, no formulario fijo

- **Estado actual:** el selector de archivo y “Agregar referencia” permanecen
  abiertos arriba de la lista de referencias.
  [user.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/user.tsx:223>)
- **Propuesta:** dejar contador `0/3` y botón “Agregar referencia”; abrir un
  modal con formatos, límite, procesamiento y errores.
- **Por qué:** iguala el patrón ya aprobado para conexiones, reduce densidad y
  centra la pantalla en administrar recursos existentes.
- **Evidencia:** confirmado por código.

### A-06 · Eliminar una referencia global no tiene confirmación

- **Estado actual:** el icono rojo elimina inmediatamente una referencia.
  [user.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/user.tsx:283>)
- **Propuesta:** confirmación destructiva con consecuencia explícita: deja de
  influir en análisis futuros; no cambia resultados previos.
- **Por qué:** se borra contexto global del usuario, no un elemento temporal.
- **Evidencia:** confirmado por código.

### A-07 · Cards públicas con apariencia clicable no hacen nada

- **Estado actual:** tarjetas de pasos y perfiles tienen `cursor-pointer` y
  hover, pero no enlace, `onClick` ni semántica de botón.
  [index.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(public)/index.tsx:206>)
  · [index.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(public)/index.tsx:475>)
- **Propuesta:** si son informativas, retirar affordance interactiva; si llevan
  a una acción, convertirlas en enlaces reales con foco visible.
- **Por qué:** el cursor promete una interacción inexistente y desorienta a
  usuarios de teclado y a quien explora la landing.
- **Evidencia:** confirmado por código.

---

## P2 · Consolidación de patrones

### A-08 · Configuración aún tiene card dentro de card

- **Estado actual:** cada sección es Card y cada conexión también es Card.
  [user.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/user.tsx:120>)
- **Propuesta:** usar una sección con divisor y filas de conexión; reservar Card
  para agrupaciones realmente independientes.
- **Por qué:** reduce ruido visual y mejora el escaneo de una lista de recursos.
- **Evidencia:** confirmado por código; **requiere prueba visual**.

### A-09 · Configuración no distingue carga, vacío y error al consultar

- **Estado actual:** conexiones y referencias se dibujan con `data?.map`; la
  ausencia temporal de datos parece un estado vacío.
  [user.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/user.tsx:35>)
- **Propuesta:** skeleton de filas, empty state con CTA y alerta con reintento.
- **Por qué:** evita que una carga lenta o fallo parezca “no tienes nada
  configurado”.
- **Evidencia:** confirmado por código.

### A-10 · Las mutaciones de configuración no muestran error contextual

- **Estado actual:** crear, rotar, probar, activar y eliminar invalidan al
  funcionar, pero sus errores no se renderizan de manera consistente.
  [user.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/user.tsx:39>)
- **Propuesta:** error inline en modales y feedback junto a la fila para probar,
  activar, rotar o eliminar.
- **Por qué:** el usuario necesita saber si corregir una key, reintentar o
  esperar.
- **Evidencia:** confirmado por código.

### A-11 · Acciones icon-only de colecciones no tienen nombre accesible

- **Estado actual:** abrir y eliminar colección usan iconos sin `aria-label` ni
  tooltip.
  [collection-card.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/collection/collection-card.tsx:41)
- **Propuesta:** añadir tooltip y nombre accesible; agrupar secundarias bajo
  menú `…` si la tarjeta gana más acciones.
- **Por qué:** los iconos no se explican por sí mismos y el lector de pantalla
  no tiene contexto.
- **Evidencia:** confirmado por código.

### A-12 · Trabajos prioriza metadata sobre estado y avance

- **Estado actual:** tabla de siete columnas dedica ancho a Job ID y dos fechas;
  el progreso es solo texto.
  [jobs/index.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/jobs/index.tsx:97>)
- **Propuesta:** priorizar colección, estado, progreso visual y fecha relativa;
  dejar ID completo para detalle/copia y las fechas secundarias para el modal.
- **Por qué:** permite leer rápidamente qué está ocurriendo sin descifrar una
  tabla operativa.
- **Evidencia:** confirmado por código; **requiere prueba visual**.

### A-13 · Empty state no expresa siguiente acción

- **Estado actual:** componente único con Paper centrado y contenido libre.
  [empty-state.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/shared/empty-state.tsx:8)
- **Propuesta:** API con icono, título, descripción, CTA y variante
  `empty`/`no-results`/`error`.
- **Por qué:** “sin colecciones”, “sin referencias” y “falló la carga” requieren
  acciones distintas.
- **Evidencia:** confirmado por código.

### A-14 · QuickFilter tiene controles rígidos

- **Estado actual:** varios filtros usan ancho fijo de 300 px dentro de una
  fila Flex.
  [quick-filter.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/shared/quick-filter.tsx:140)
- **Propuesta:** columna en móvil y `w=100%` con máximo de ancho en escritorio.
- **Por qué:** reduce riesgo de overflow y botones comprimidos en 320–414 px.
- **Evidencia:** confirmado por código; **requiere prueba visual**.

### A-15 · Formularios largos no mantienen su acción principal visible

- **Estado actual:** formulario de colección agrupa dos fieldsets y el de
  facturas separa errores, dropzone y submit verticalmente.
  [collection/form/index.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/collection/form/index.tsx:105)
  · [bill/form/index.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/bill/form/index.tsx:147)
- **Propuesta:** footer sticky en modales largos; contador `0/10` y errores por
  archivo junto a su fila en la carga de facturas.
- **Por qué:** disminuye desplazamiento, hace visibles límites y facilita
  corregir el archivo exacto.
- **Evidencia:** confirmado por código; **requiere prueba visual**.

### A-16 · Confirmación destructiva es demasiado genérica

- **Estado actual:** `ConfModal` depende por completo de texto externo y ofrece
  “Confirmar” como fallback.
  [conf-modal.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/shared/conf-modal.tsx:30)
- **Propuesta:** variante destructiva con consecuencia, foco inicial en
  cancelar y verbo específico: “Eliminar colección”, “Descartar cambios”.
- **Por qué:** reduce errores en operaciones irreversibles y elimina ambigüedad.
- **Evidencia:** confirmado por código.

### A-17 · Modal de análisis necesita estado explícito de configuración

- **Estado actual:** conexiones/referencias pueden seguir cargando cuando se
  abre el flujo de análisis.
  [$id.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/collections/$id.tsx:303>)
- **Propuesta:** “Cargando configuración…” con skeleton y acción deshabilitada
  hasta resolver conexión activa y referencias.
- **Por qué:** evita un modal que parece listo pero falla o cambia al confirmar.
- **Evidencia:** confirmado por código; **requiere prueba visual**.

---

## P3 · Pulido y coherencia editorial

### A-18 · Copy de acciones usa capitalización inconsistente

- **Estado actual:** coexisten “Nueva Colección”, “Subir Facturas” y “Analizar
  Colección”.
  [collections/index.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(private)/collections/index.tsx:101>)
- **Propuesta:** adoptar sentence case: “Nueva colección”, “Subir facturas”,
  “Analizar colección”.
- **Por qué:** el español se siente más natural y reduce rigidez visual.
- **Evidencia:** confirmado por código.

### A-19 · Landing mezcla transiciones y colores sin token

- **Estado actual:** usa `transition-all`, easing genérico y color literal
  `#7c3aed` en la barra pública.
  [index.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(public)/index.tsx:64>)
  · [route.tsx](</Users/sadie/Code/NodeJs/bill-lm/src/routes/(public)/route.tsx:38>)
- **Propuesta:** limitar transiciones a propiedades concretas, evitar cambios de
  peso en hover y definir color/duración como tokens del sistema.
- **Por qué:** previene saltos de layout y evita que la landing sea una isla
  visual distinta de la aplicación.
- **Evidencia:** confirmado por código; **requiere prueba visual** para motion.

### A-20 · Documento raíz declara inglés para una app en español

- **Estado actual:** `<html lang="en">` con interfaz española.
  [\_\_root.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/routes/__root.tsx:194)
- **Propuesta:** usar `lang="es-EC"`.
- **Por qué:** mejora lectores de pantalla, SEO y pronunciación.
- **Evidencia:** confirmado por código.

### A-21 · Navegación y autenticación necesitan una pasada de orientación

- **Estado actual:** menú de usuario deja Telemetría, Colecciones y
  Configuración al mismo nivel; las pantallas auth son el mismo Paper centrado
  con títulos distintos.
  [navbar-icon.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/user/navbar-icon.tsx:32)
  · [auth-card.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/auth/auth-card.tsx:17)
- **Propuesta:** separar “Trabajo” y “Cuenta” en el menú, resaltar ruta actual,
  y añadir a auth marca, regreso al inicio y nota de privacidad breve.
- **Por qué:** mejora orientación sin añadir navegación pesada ni contenido
  inventado.
- **Evidencia:** estructura confirmada; **requiere prueba visual**.

### A-22 · Componentes compartidos guardan copy o layouts demasiado fijos

- **Estado actual:** Dropzone siempre habla de XML y de “tantos archivos como
  quieras”; su lista usa cuatro columnas fijas.
  [dropzone.tsx](/Users/sadie/Code/NodeJs/bill-lm/src/components/shared/dropzone.tsx:72)
- **Propuesta:** parametrizar formato, límite y copy; usar grid responsive.
- **Por qué:** evita contradicciones para nuevos flujos y protege la vista móvil.
- **Evidencia:** confirmado por código; **requiere prueba visual**.

## Secuencia recomendada de aprobación

1. **A-01 y A-02:** exactitud de promesa pública y acción de eliminar.
2. **A-03 a A-07:** experiencia de mayor impacto para el uso real.
3. **A-08 a A-17:** consolidar patrones antes de abrir nuevas pantallas.
4. **A-18 a A-22:** pulido transversal y accesibilidad.

## Límites de esta auditoría

- No hubo sesión autenticada ni prueba manual contra MinIO, Firebase o base de
  datos.
- No se verificaron foco, teclado, lectores de pantalla ni breakpoints reales.
- La auditoría no prueba que una mutación ausente en el componente no esté
  resuelta por otro mecanismo; A-02 señala la ausencia en el flujo visible.
- No es asesoría tributaria ni revisión de lógica fiscal.

<!-- Hallmark audit · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
