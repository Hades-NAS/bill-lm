# Documentación de Bill-LM

Usa esta guía para encontrar el documento adecuado antes de leer detalles de
implementación.

## Guías

`guides/` explica el producto con lenguaje directo. Sirve para personas que
usan Bill-LM, dan soporte o necesitan entender el alcance de un análisis.

- [Fuentes oficiales para los análisis](guides/fuentes-oficiales-para-analisis.md): origen, revisión y uso de las secciones del SRI.
- [Resultados de análisis](guides/resultados-de-analisis.md): significado y límites de los resultados que muestra la app.

## Arquitectura

`architecture/` describe contratos y decisiones técnicas vigentes. Sirve para
quien modifica web, servidor, worker, persistencia o seguridad.

- [Flujo técnico de fuentes oficiales y rulesets SRI](architecture/sri-rulesets-flujo-tecnico.md)
- [Flujo de análisis](architecture/analysis-flow.md)
- [BYOK cloud](architecture/byok-cloud.md)
- [Diseño de ejecución local](architecture/byok-local-execution-design.md)
- [Diseño de Firebase Auth](architecture/firebase-auth-ux-design.md)

## Operación

`operations/` reúne procedimientos repetibles de prueba y despliegue.

- [Prueba de proveedor real](operations/analysis-real-provider-smoke-test.md)
- [Pruebas y evidencias](operations/testing-and-evidence.md)
- [Operación de rulesets SRI](../resources/tax-rules/ec/sri/README.md)

## Material interno

`internal/` conserva contexto de trabajo del equipo. No se enlaza como guía de
producto porque reúne decisiones históricas, investigación, auditorías y
reportes fechados.

- `internal/specs/`: diseños y planes de implementación.
- `internal/audits/`: revisiones de UX, seguridad o código.
- `internal/reports/`: resultados de curación, builds y ejecuciones.
- `internal/research/`: notas y hallazgos de investigación.

Una carpeta organiza el material, pero no controla el acceso. Si el repositorio
es público, los documentos que requieran confidencialidad deben vivir en un
espacio privado con permisos adecuados.
