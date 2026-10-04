# Visor local con un modelo local

Esta guía sirve para probar Bill-LM en un solo equipo: las facturas XML, los
perfiles, las actividades, las colecciones, las revisiones, los runs y los
resultados permanecen en una biblioteca local. El visor no usa una sesión ni
la aplicación cloud para esas operaciones.

Las capturas y pruebas automatizadas de este flujo usan datos sintéticos. Para
validar una conexión Local-GPU debes probar el host configurado en tu propio
equipo; la evidencia headless no certifica ese host ni servicios cloud.

## Qué se ejecuta localmente

El visor React escucha en `http://127.0.0.1:4319` y reenvía sus solicitudes
`/api` al daemon Hono en `http://127.0.0.1:4318`. El daemon conserva el estado
de la biblioteca en SQLite y los XML en el disco. También lee, sin modificarlos,
los rulesets SRI incluidos en este repositorio. No descarga reglas tributarias
desde el servidor cloud durante el uso del visor local.

Un servidor de inferencia es un proceso separado. Para la primera prueba se
recomienda que viva en el mismo equipo y escuche sólo en loopback. Bill-LM se
conecta a ese proceso desde el daemon, nunca desde la aplicación web cloud.

## Levantar el visor y el daemon

Desde la raíz del repositorio, instala las dependencias una vez:

```bash
bun install
```

En la primera terminal inicia el daemon Hono:

```bash
bun run daemon:local
```

Debe imprimir que escucha en `http://127.0.0.1:4318`. En otra terminal inicia
el visor:

```bash
bun run dev:local
```

Abre `http://127.0.0.1:4319` en el navegador. La biblioteca se guarda por
defecto en `$XDG_DATA_HOME/bill-lm` o, si esa variable no existe, en
`~/.local/share/bill-lm`. Para usar otra ubicación, define una ruta absoluta
antes de iniciar el daemon:

```bash
BILL_LM_LOCAL_LIBRARY_DIR=/ruta/absoluta/a/bill-lm bun run daemon:local
```

Comprueba que el daemon y el ruleset local responden antes de configurar un
modelo:

```bash
curl http://127.0.0.1:4318/api/v1/rulesets
```

## Diagnosticar un análisis

La terminal del daemon registra eventos JSON Lines seguros para cada análisis:
recepción, prueba del host, encolado, inicio, finalización y fallo. El campo
`runId` permite relacionarlos con el historial del visor. No se imprimen XML,
prompts, respuestas del modelo, URLs privadas ni secretos. Para incluir las
etapas de depuración, inicia el daemon con:

```bash
BILL_LM_LOCAL_LOG_LEVEL=debug bun run daemon:local
```

La respuesta debe contener una lista `items`. Si no responde, revisa la
terminal del daemon; el visor no puede sustituir ese proceso.

## Preparar el host de inferencia

La opción **OpenAI-like** del visor requiere dos endpoints del host:

- `GET /v1/models` para comprobar que responde y obtener el identificador del
  modelo.
- `POST /v1/chat/completions` para el análisis. La respuesta debe incluir JSON
  válido en `choices[0].message.content`.

En el campo **URL base** usa una dirección que termine en `/v1`, y en
**Modelo** copia literalmente el `id` que devuelve `/v1/models`. Por ejemplo,
si el host es LM Studio en el mismo equipo:

```bash
curl http://127.0.0.1:1234/v1/models
```

Configura en el visor:

```text
Nombre: LM Studio local
Tipo de API: OpenAI-like
URL base: http://127.0.0.1:1234/v1
Modelo: <id exacto devuelto por /v1/models>
```

No escribas una clave directamente en la interfaz: hoy la UI no permite crear
ni editar `secretRef`. El daemon sólo acepta referencias locales `env:NOMBRE`
cuando una conexión ya tiene esa referencia; un valor secreto literal se
rechaza. Para la primera prueba local, elige un host sin autenticación y
limitado a `127.0.0.1`.

### Hosts compatibles: ejemplos de inicio

Estos enlaces son la fuente para instalar y arrancar cada host. Sus comandos,
modelos disponibles y requisitos de GPU cambian por plataforma; verifica la
documentación del host antes de usarlo.

- [LM Studio: servidor local](https://lmstudio.ai/docs/developer/core/server).
  Carga un modelo, inicia el servidor desde la pestaña **Developer** y consulta
  `http://127.0.0.1:1234/v1/models`. Es la opción más sencilla para una primera
  prueba de API OpenAI-compatible.
- [oMLX](https://github.com/jundot/omlx). Está orientado a modelos MLX en Apple
  Silicon. Inicia el servidor siguiendo su README y confirma su endpoint
  `/v1/models` antes de registrarlo en Bill-LM.
- [vLLM: servidor OpenAI-compatible](https://docs.vllm.ai/en/latest/serving/openai_compatible_server/).
  Es una opción habitual para una máquina Linux con GPU; configura su bind en
  loopback para una prueba en el mismo host y usa la URL `/v1` que publique.
- [LocalAI: inicio](https://localai.io/docs/basics/getting_started/). Ofrece
  imágenes y backends para distintas plataformas. Sigue la variante de tu GPU,
  confirma `/v1/models` y registra la URL base que corresponda.

Ejemplo de comprobación genérica para un host que escucha en el puerto 8000:

```bash
curl http://127.0.0.1:8000/v1/models
```

No se ha certificado en este repositorio una combinación concreta de
host, modelo y GPU. Este `curl` sólo comprueba el endpoint; no prueba que el
modelo produzca el JSON tributario requerido.

## Flujo en el visor

El visor usa un drawer lateral con las mismas áreas principales de la web:
**Colecciones**, **Perfiles y actividades**, **Configuración**, **Fuentes
oficiales** y **Biblioteca local**. Sus rutas son hashes locales, por ejemplo
`#/collections` o `#/profiles`; no crean sesión ni sincronizan datos con la
cloud app. Cada ruta muestra sólo su sección correspondiente. Las conexiones
Local-GPU se registran y prueban desde el detalle de la **colección**; sólo
aceptan hosts OpenAI-like o Claude-like mediante el daemon local y no
expone credenciales, claves cloud ni proveedores remotos. **Fuentes oficiales**
muestra el snapshot de solo lectura que viene en el ruleset local y **Biblioteca
local** resume los conteos conservados en el equipo, sin rutas de disco ni
acciones de borrado. Un enlace
`#/collections/<id-local>` abre esa colección si existe en la biblioteca; si
no existe, el visor vuelve de forma segura a **Colecciones**.

1. Abre el visor local y crea las actividades y el perfil tributario que
   correspondan a tu caso. Se guardan como revisiones locales en SQLite.
2. Crea una colección y guarda su contexto tributario, seleccionando el perfil
   y las actividades aplicables. Las revisiones quedan asociadas a esa
   colección local.
3. Dentro del detalle de la colección, usa **Subir facturas** para seleccionar
   o arrastrar hasta 10 comprobantes XML de máximo 5 MB cada uno. No se aceptan
   PDF ni ZIP. Cada XML se intenta importar por separado y muestra si se
   importó, ya existía, es inválido o no se pudo contactar el daemon; el XML se
   guarda una sola vez en la biblioteca local y queda asociado a esa colección.
   Quitar la factura de la colección no borra
   su XML, resultados ni una posible asociación con otra colección.
4. En **Conexión local-GPU** de esa colección, guarda la conexión OpenAI-like
   con la URL `/v1` y el ID literal del modelo. Pulsa **Probar conexión**;
   el daemon consulta `/v1/models`.
5. Con una factura asociada a la colección, pulsa **Analizar**. El daemon vuelve
   a comprobar el host, crea un run local con el ruleset local y solicita
   `/v1/chat/completions`. El run conserva la colección que lo originó y sólo
   completa si el host devuelve el JSON estructurado esperado.
6. En **Historial local de análisis**, selecciona **Ver detalle** para abrir los
   eventos y el resultado validado de ese run. El detalle sólo se consulta por
   colección: una ejecución de otra colección se trata como no encontrada. Si
   no existe resultado válido, el visor lo indica sin inventar una conclusión;
   los datos de conexión y referencias de secretos no se muestran.

Si el host no responde, devuelve HTTP no exitoso o su salida no es el JSON
esperado, el run queda fallido y no se conserva un resultado de análisis
válido. Revisa primero la URL base, el ID de modelo y la salida de
`/v1/models`.

## Red y límites actuales

Mantén daemon y host de inferencia en `127.0.0.1` mientras validas el flujo.
El daemon de Bill-LM está ligado a loopback. Si más adelante apuntas a un host
en una LAN privada, protege ese host con autenticación y firewall antes de
exponerlo; no publiques un servidor de inferencia sin control de acceso en una
red abierta.

Esta guía describe el código y las comprobaciones disponibles, no una prueba
certificada de hardware. Todavía no hay evidencia manual en este repositorio
de una sesión de navegador contra un host GPU real, de conectividad LAN, de
rendimiento de un modelo, ni del flujo OAuth local. OAuth sigue pendiente y no
es necesario para registrar una conexión local-GPU OpenAI-like.

## Evidencia automatizada del visor

La siguiente suite abre un navegador contra una instancia efímera del daemon y
del visor. Crea una biblioteca aislada bajo el directorio temporal del sistema,
recorre las áreas principales y crea una colección de prueba; no toca la
biblioteca configurada para uso diario.

```bash
bun run test:e2e:local
```

No ejecutes esa prueba mientras otra instancia del daemon o del visor ocupa los
puertos `4318` o `4319`: la configuración falla deliberadamente en ese caso
para no reutilizar estado o servidores reales. Las capturas y trazas quedan en
`test-evidences/local-viewer-artifacts/`, que no se versiona. Esta es evidencia
automatizada de la interfaz local; no compara una sesión cloud autenticada ni
prueba GPU real, LAN u OAuth.
