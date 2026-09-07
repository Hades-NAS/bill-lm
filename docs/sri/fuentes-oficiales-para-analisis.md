# Fuentes oficiales para los análisis

Bill-LM usa material publicado por el Servicio de Rentas Internas del Ecuador
(SRI) para dar contexto a un análisis de facturas. El equipo prepara ese
material antes de que llegue a la aplicación. La app no busca normas en
internet mientras analiza una factura.

El resultado orienta una revisión. No sustituye una declaración ante el SRI ni
el criterio de un contador o abogado.

## De un documento del SRI a una regla utilizable

Una persona responsable parte de una página o un PDF del SRI. El proceso
conserva el origen y evita que un texto descargado pase directo a un análisis.

1. **Comprobar el documento.** Se revisa que el enlace pertenece al SRI y se
   compara el archivo disponible con la última copia revisada. Un cambio avisa
   que hace falta una nueva revisión; no confirma por sí mismo un cambio legal.
2. **Guardar el original.** Se descarga el PDF oficial y se guarda una huella
   digital del archivo. Esa huella permite detectar si el contenido cambia.
3. **Preparar el texto para leerlo.** El sistema obtiene texto del PDF y
   conserva las páginas de donde salió cada fragmento. Si el PDF es una imagen
   sin texto seleccionable, el proceso se detiene.
4. **Separar el contenido.** Una ley o reglamento suele dividirse por artículos.
   Si el documento no ofrece límites claros, el sistema lo mantiene como una
   sección pendiente de revisión en vez de adivinar.
5. **Revisar y aprobar.** La persona responsable confirma el texto, la página,
   la vigencia, el tipo de impuesto y el régimen al que aplica. Solo entonces
   una sección pasa a formar parte del material aprobado.

La revisión humana es la parte que decide el alcance tributario. El sistema
ayuda a conservar el origen, comparar versiones y detectar cambios.

## Qué es un ruleset

Un ruleset es una selección publicada de secciones oficiales revisadas. Cada
ruleset indica para qué sirve, a qué régimen tributario aplica, qué periodicidad
cubre y desde cuándo tiene vigencia.

Piensa en él como una carpeta cerrada para un caso concreto. En vez de enviar
un PDF completo al modelo, Bill-LM usa las secciones de esa carpeta que encajan
con el análisis solicitado.

## Cómo se usa al analizar una colección

Antes de analizar, la persona configura la colección con un propósito, un
período, un perfil tributario y, cuando corresponde, actividades económicas.

Por ejemplo, para una declaración mensual de IVA en régimen general, Bill-LM
busca un ruleset oficial activo que cubra IVA, régimen general, periodicidad
mensual y las fechas indicadas. Después toma solo las secciones vigentes que
forman parte de ese ruleset.

El sistema conserva una copia del contexto, la factura y las secciones usadas
para ese análisis. Si el equipo publica una versión nueva después, el resultado
anterior conserva el material con el que se generó.

## Cuando el análisis se bloquea

Bill-LM detiene el análisis antes de usar la conexión de IA si no encuentra un
ruleset activo para el caso. También se detiene si falta una sección oficial
aplicable, el período no coincide o la configuración de la colección está
incompleta.

Ese bloqueo evita que el modelo rellene una ausencia normativa con suposiciones.
La persona responsable debe publicar o corregir el ruleset antes de reintentar.

## Límites que debes conocer

- El SRI puede cambiar una norma, publicar una nueva versión o corregir un
  documento antes de que el equipo la revise.
- Una fuente oficial confirma el origen del texto, pero no resuelve por sí sola
  situaciones particulares, pruebas faltantes ni interpretaciones complejas.
- Bill-LM muestra un resultado orientativo. La persona contribuyente conserva
  la responsabilidad sobre su declaración y sus respaldos.

## Para quien administra las fuentes

La [guía técnica del flujo de rulesets](../architecture/sri-rulesets-flujo-tecnico.md)
explica cómo operan la web, el servidor, la base de datos, el worker y los
comandos de publicación. El [README operativo de SRI](../../resources/tax-rules/ec/sri/README.md)
incluye los comandos de mantenimiento.
