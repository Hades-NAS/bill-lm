# Bill-LM

Bill-LM organiza facturas electrónicas XML de Ecuador y las revisa con IA usando
contexto tributario preparado a partir de fuentes oficiales del SRI.

La aplicación ayuda a revisar información. No presenta sus resultados como una
declaración ante el SRI, un dictamen jurídico ni una sustitución de asesoría
contable.

## Qué puedes hacer hoy en la aplicación web

- Crear colecciones de facturas XML.
- Configurar un perfil tributario y actividades económicas.
- Definir el período y el propósito del análisis: IVA, Impuesto a la Renta de
  actividades económicas o gastos personales.
- Conectar tu propia cuenta de OpenAI o Claude. La clave se cifra en el servidor
  y no vuelve al navegador.
- Consultar las fuentes oficiales publicadas que dan contexto al análisis.
- Revisar el historial de ejecuciones y el resultado orientativo de cada factura.

Antes de analizar, Bill-LM busca una selección oficial vigente para el propósito,
régimen, periodicidad y fechas de la colección. Si no encuentra una combinación
aprobada, bloquea el análisis en lugar de completar reglas faltantes con
suposiciones.

## Fuentes oficiales y límites

El equipo descarga, conserva y revisa material publicado por el SRI antes de
usarlo en la aplicación. La revisión humana define el alcance de cada sección.

Lee [Fuentes oficiales para los análisis](docs/guides/fuentes-oficiales-para-analisis.md)
para entender ese proceso en lenguaje simple. La guía también explica qué puede
y qué no puede garantizar la aplicación.

## Modos locales planificados

Bill-LM se diseñó para extender el mismo flujo de facturas, contexto y reglas a
otros entornos. Estas modalidades aún no forman parte de la aplicación web
actual:

1. **Agente local con OAuth o suscripción.** La persona usaría Codex, Claude
   Code u OpenCode desde su equipo. Un servidor MCP local conectaría ese agente
   con su biblioteca y un visor en `localhost`, sin guardar tokens OAuth en
   Bill-LM.
2. **Modelo local con GPU.** Un daemon local enviaría el análisis a un modelo
   ejecutado por la propia persona, normalmente mediante un endpoint compatible.
   La biblioteca, archivos y resultados vivirían en su equipo.

La [arquitectura de ejecución local](docs/architecture/byok-local-execution-design.md)
describe esas propuestas, sus límites y el trabajo que falta antes de ofrecerlas.

## Documentación

El [índice de documentación](docs/README.md) separa guías de producto,
arquitectura, operación y material interno del equipo.

Para contribuir, levantar servicios, configurar variables, ejecutar pruebas o
trabajar con reglas SRI, consulta [DEVELOPMENT.md](DEVELOPMENT.md).
