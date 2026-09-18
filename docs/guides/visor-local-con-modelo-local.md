# Visor local con un modelo local

Esta guía sirve para probar Bill-LM en un solo equipo: las facturas XML, los
perfiles, las actividades, las colecciones, las revisiones, los runs y los
resultados permanecen en una biblioteca local. El visor no usa una sesión ni
la aplicación cloud para esas operaciones.

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

1. Abre el visor local y crea las actividades y el perfil tributario que
   correspondan a tu caso. Se guardan como revisiones locales en SQLite.
2. Crea una colección y guarda su contexto tributario, seleccionando el perfil
   y las actividades aplicables. Las revisiones quedan asociadas a esa
   colección local.
3. En **Importar factura**, elige un comprobante XML. No se aceptan PDF ni ZIP;
   el XML se guarda en la biblioteca local.
4. En **Conexión local-GPU**, guarda la conexión OpenAI-like con la URL `/v1` y
   el ID literal del modelo. Pulsa **Analizar** sin una factura para comprobar
   la conexión; el daemon consulta `/v1/models`.
5. Con una factura XML importada, pulsa **Analizar** otra vez. El daemon vuelve
   a comprobar el host, crea un run local con el ruleset local y solicita
   `/v1/chat/completions`. Sólo completa el run si el host devuelve el JSON
   estructurado esperado.

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
