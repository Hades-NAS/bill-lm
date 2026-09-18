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

## Visor y daemon locales

El visor local y el daemon ya se pueden ejecutar en tu equipo. Requieren
[Bun](https://bun.sh/) y las dependencias del proyecto instaladas:

```bash
bun install
```

Abre dos terminales desde la raíz del repositorio. En la primera inicia el
daemon, que guarda la biblioteca local y atiende únicamente en
`http://127.0.0.1:4318`:

```bash
bun run daemon:local
```

En la segunda inicia el visor de React, que reenvía las llamadas `/api` al
daemon:

```bash
bun run dev:local
```

Luego abre [http://127.0.0.1:4319](http://127.0.0.1:4319). Por defecto la
biblioteca local se guarda en `$XDG_DATA_HOME/bill-lm` o, si esa variable no
está definida, en `~/.local/share/bill-lm`. Puedes elegir otro directorio con
una ruta absoluta:

El comando de raíz delega al workspace ejecutable
`apps/local-viewer`; también puedes ejecutar sus comprobaciones aisladas con
`bun run --cwd apps/local-viewer typecheck`, `test` o `build`.

```bash
BILL_LM_LOCAL_LIBRARY_DIR=/ruta/absoluta/a/mis-facturas bun run daemon:local
```

Detén el daemon con `Ctrl+C`; cerrará el servidor y la biblioteca local de
forma ordenada. Este flujo no inicia OAuth ni guarda tokens OAuth: la conexión
de agentes locales mediante OAuth sigue pendiente.

El visor opera perfiles, actividades y colecciones contra ese daemon local. Los
contextos de una colección se guardan como revisiones en SQLite; no usan la
sesión, Firebase, tRPC ni el servidor cloud.
Si el daemon no responde al cargar colecciones, el visor muestra un estado local
de error y permite reintentar la consulta sin salir de la aplicación.

## Estructura de aplicaciones

La aplicación web cloud se ejecuta desde `apps/web`; la raíz conserva comandos
delegados para comodidad (`bun run dev`, `build`, `start`, `test` y
`typecheck`). Sus rutas, interfaz, integraciones cloud, configuración Vite,
servidor de producción y artefactos de build pertenecen a ese workspace.

## Modos de uso actuales

- **Web app:** usa la aplicación cloud en
  [bill-lm.cardor.dev](https://bill-lm.cardor.dev).
- **Visor local — OAuth (provisional):** el visor puede orientar al modo OAuth
  cuando no hay conexión local-GPU, pero la ejecución OAuth local todavía está
  pendiente; hoy sólo existe la guía y el diseño del flujo.
- **Visor local — Local-GPU:** el visor y el daemon Hono conservan XML,
  colecciones, perfiles, actividades y resultados en SQLite/disco local, y
  pueden conectarse a un host OpenAI-compatible.

Consulta la [guía del visor local con un modelo local](docs/guides/visor-local-con-modelo-local.md)
para levantar ambos procesos, configurar `/v1` y conocer los límites de
seguridad y evidencia.

## Documentación

El [índice de documentación](docs/README.md) separa guías de producto,
arquitectura, operación y material interno del equipo.

Para contribuir, levantar servicios, configurar variables, ejecutar pruebas o
trabajar con reglas SRI, consulta [DEVELOPMENT.md](DEVELOPMENT.md).
