# Phase 2-A: referencias fiscales autogestionadas

## Objetivo

Cada usuario puede mantener hasta tres referencias fiscales globales. Se usan en
todas sus colecciones futuras de análisis, junto con las instrucciones propias
de cada colección. Son contenido aportado y autoaprobado por el usuario: no se
presentan como reglas oficiales ni como una verificación jurídica del SRI.

## Flujo de carga

1. El usuario carga un archivo Markdown o un PDF con texto seleccionable.
2. El servidor valida tipo, tamaño y el límite global de tres referencias no
   eliminadas para el usuario.
3. Para Markdown, normaliza espacios, saltos y encabezado; para PDF, extrae su
   texto y produce el mismo Markdown normalizado.
4. Guarda únicamente el Markdown normalizado en MinIO, bajo una ruta por
   usuario y referencia, y registra su hash, tipo de origen y metadatos en
   PostgreSQL.
5. Un PDF sin texto extraíble se rechaza de forma explícita. OCR no pertenece a
   esta fase.

## Uso en análisis

Al solicitar análisis se exige al menos una referencia activa, además de una
conexión BYOK activa. El worker vuelve a comprobar ambas condiciones y obtiene
los Markdown activos de MinIO exclusivamente en el servidor. El constructor de
prompts recibe ese contexto etiquetado como material autogestionado del usuario.
El archivo no viaja al navegador, Firestore, BullMQ ni registros.

## Límites y compatibilidad

- El límite es tres referencias globales por usuario, no por colección.
- Eliminar una referencia libera cupo y deja de afectar análisis futuros.
- No se cambian ni eliminan los campos heredados `BillHeader.percentage` y
  `BillHeader.reason`.
- No se añade soporte para facturas PDF: esta fase solo procesa PDFs de
  referencia. Las facturas siguen requiriendo XML válido.
- Fase 2-A no incluye `AnalysisRun`, `AnalysisResult`, snapshots inmutables ni
  proveniencia histórica por ejecución. El worker vuelve a resolver las
  referencias activas al procesar el job; ese historial versionado queda fuera
  de este corte.
- La migración será aditiva y se prepara para despliegue; no se aplica a
  infraestructura compartida desde esta implementación.
