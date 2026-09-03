# Diseño: BYOK, ejecución local y agentes

> Estado: propuesta de arquitectura.
> Fecha de referencia: 2026-09-02. Las superficies de los proveedores cambian; validar sus guías antes de implementar cada integración.

## Decisión que guía el trabajo

Bill-LM debe permitir tres formas de analizar las mismas facturas:

1. La aplicación cloud con una clave API aportada por cada usuario.
2. Un agente local autenticado por el usuario con Codex, Claude Code u OpenCode.
3. Un endpoint de modelo local, normalmente servido por la GPU del usuario.

Las tres formas comparten contratos de dominio, validación, reglas y formato de resultados. La diferencia está en el adaptador que obtiene la respuesta del modelo y en dónde viven los datos. No se debe duplicar la aplicación ni intentar levantar en local toda la infraestructura cloud actual.

La recomendación es evolucionar este repositorio con un núcleo de aplicación reutilizable y adaptadores cloud/local. Un segundo repositorio solo tendría sentido si en el futuro se distribuye una aplicación desktop con ciclo de publicación, permisos y dependencias totalmente independientes.

## Estado actual comprobado

La siguiente tabla separa lo que existe de lo que se propone. No debe leerse la columna objetivo como funcionalidad ya disponible.

| Área | Comportamiento actual comprobado | Dirección objetivo |
| --- | --- | --- |
| Ingesta | Las mutaciones tRPC persisten metadatos con Prisma y objetos en MinIO. | Mantener ese adaptador cloud; en local copiar los originales a almacenamiento administrado. |
| Autorización de análisis | La pantalla consulta una validación de whitelist antes de analizar. | Sustituirla por la comprobación de una conexión de proveedor utilizable y propiedad del usuario. |
| Trabajo asíncrono | Se crea trabajo en Firestore y se despacha mediante BullMQ. | Conservarlo en cloud; usar `RunStore` y progreso local para SQLite. |
| Proveedor LLM | `LLMProviderFactory` conserva una instancia global, decide proveedor desde Firebase/variables y crea OpenAI, Claude o LM Studio. | Resolver el cliente por ejecución y por usuario. No compartir claves ni cliente mutable entre trabajos. |
| Servicio de análisis | `BillAnalysisService` carga modelo, lee Prisma/MinIO, parsea XML, construye prompt, invoca LLM y actualiza Firestore/Prisma. | Dividirlo en puertos y servicios de aplicación. |
| Ajustes | La ruta `/user` es un placeholder. | Crear una sección de conexiones de proveedor para BYOK cloud. |
| Resultados | Los datos analizados se actualizan sobre `BillHeader`. | Conservar una proyección actual para compatibilidad cloud y añadir historial versionado de ejecuciones/resultados. |
| Filtros actuales | La colección filtra por nombre de archivo y por un umbral de porcentaje. | Añadir búsqueda por número, emisor/RUC y rangos reales de confianza, fecha y monto. |

El patrón global actual requiere atención especial: `LLMProviderFactory` devuelve un singleton y el proveedor OpenAI usa configuración de cliente global. En un proceso concurrente, cambiar un cliente por defecto para una clave BYOK puede cruzar usuarios. La implementación BYOK no debe llamar a `setDefaultOpenAIClient` ni mantener una fábrica global con secretos de un usuario. También se debe confirmar la compatibilidad del manifiesto y lockfile antes de adoptar APIs recientes de clientes de agentes.

### Inventario de deuda técnica que condiciona la migración

- La ingesta acepta MIME `application/pdf` y `text/xml`, pero los procedimientos y el worker pasan el contenido a `parseAndValidateInvoiceXML`. PDF no tiene todavía un pipeline de extracción/parsing equivalente y debe rechazarse de forma coherente o recibir un adaptador específico antes de prometer análisis PDF.
- `bill-prompt-builder` declara reglas de gastos personales para 2026 dentro del texto. Esa fecha y sus fuentes deben salir del prompt fijo y convertirse en rulesets versionados y vigentes.
- `.env.example` propone `LLM_MODEL`, `LLM_API_KEY` y `LLM_API_URL`, mientras `src/env.ts` y la fábrica esperan nombres como `MODEL_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL_ID`, `CLAUDE_API_KEY` y `LLM_BASE_URL`. Se debe alinear la documentación y el contrato de entorno.
- Los Dockerfiles web y worker propagan `OPENAI_API_KEY` y configuración LLM como `ARG`/`ENV`. BYOK requiere auditar y retirar esa ruta de claves globales, incluidos builds, imágenes, despliegues y logs de diagnóstico.
- `BillHeader` recibe la proyección sobrescrita del último análisis. Faltan historial de resultados, origen, hashes de input y versiones de prompt/parser/ruleset/schema.

## Objetivos y límites

### Objetivos

- El usuario aporta y controla su propio acceso al modelo: API key cloud, sesión OAuth/subscription de una CLI o endpoint GPU local.
- Cada resultado registra su procedencia: perfil, proveedor, modelo, versiones de prompt/parser/reglas/esquema y hashes de entrada.
- El usuario local administra colecciones y facturas desde un único visor en `localhost`.
- Codex, Claude Code y OpenCode tienen una integración determinista mediante MCP, sin extraer sus tokens.
- La aplicación cloud conserva su flujo actual mientras se migra hacia el núcleo compartido.

### No objetivos de la primera entrega

- No ejecutar análisis OAuth desde un botón del visor local. En v1 el usuario inicia el agente desde su CLI/app; el visor observa el progreso.
- No emular los protocolos de Anthropic y OpenAI como si fueran idénticos. El primer runner GPU usa OpenAI-compatible; Anthropic-compatible queda detrás de otro adaptador y matriz de pruebas.
- No almacenar tokens OAuth de Codex, Claude Code u OpenCode.
- No prometer que un modelo local interpreta facturas con la misma calidad que un modelo cloud.
- No conectarse al portal SRI, almacenar credenciales SRI, hacer scraping, sincronizar automáticamente ni distribuir una aplicación compañera para ello. El primer alcance SRI es importación manual revisada.

## Tres topologías soportadas

```text
Cloud BYOK
Browser -> API cloud -> trabajo BullMQ -> núcleo -> proveedor por usuario
                  |                    |
                Prisma/MinIO        Firestore/progreso

OAuth / agente local
Codex | Claude Code | OpenCode -> MCP local -> núcleo -> SQLite + objects -> visor localhost

GPU local
Visor localhost -> daemon local -> núcleo -> endpoint compatible -> SQLite + objects
```

El núcleo aplica la misma secuencia: obtener factura, validar/parsear, construir contexto, solicitar análisis, validar salida, registrar resultado y emitir progreso. Cloud, MCP y GPU solo aportan implementaciones de entrada/salida.

### Topología destino del repositorio

La siguiente estructura expresa límites de módulos. Es un destino incremental: no exige reescribir de inmediato el repositorio como monorepo ni mover archivos por motivos cosméticos. Primero se extraen contratos y casos de uso cubiertos por pruebas; después cada adaptador puede migrar de forma gradual.

```text
packages/
  domain/              entidades, reglas, estados de run y resultados
  application/         casos de uso y puertos
  contracts/           schemas versionados, DTOs y eventos
apps/
  cloud-web/           UI/tRPC y adaptadores Prisma/MinIO
  cloud-worker/        BullMQ/Firestore y proveedor BYOK por ejecución
  local-daemon/        SQLite, objects, API local, SSE/WebSocket y runner GPU
  local-viewer/        UI localhost, consumidora del daemon
  mcp-server/          herramientas MCP sobre application + daemon
hosts/
  codex/               wrapper mínimo, instrucciones y configuración del host
  claude-code/         wrapper mínimo, instrucciones y configuración del host
  opencode/            wrapper mínimo, instrucciones y configuración del host
```

`domain`, `application` y `contracts` no importan Prisma, MinIO, Firebase, BullMQ, filesystem, UI ni SDK de proveedor. Cloud web/worker, daemon local, MCP y los wrappers de host importan el núcleo y suministran adaptadores. Los wrappers de Codex, Claude Code y OpenCode comparten MCP, SQLite y reglas; no son tres implementaciones del producto.

## Cloud BYOK

### Modelo de conexión

Cada usuario puede crear una o más conexiones de proveedor: por ahora OpenAI y Claude. La conexión guarda el proveedor, modelo permitido, etiqueta, estado, fechas y un secreto cifrado. El usuario selecciona una conexión por defecto y puede elegir otra para una ejecución concreta.

La API recibe la clave una vez por HTTPS, valida una llamada mínima al proveedor y la guarda mediante cifrado de sobre:

1. El servidor genera una data-encryption key por secreto o por versión de secreto.
2. Cifra la API key con AES-GCM y un AAD que incluya `userId`, `connectionId`, proveedor y versión.
3. Cifra la data-encryption key con KMS o un servicio de claves equivalente.
4. Guarda ciphertext, IV, tag, key-encryption metadata, versión y timestamps.

La clave descifrada existe solo en memoria durante la ejecución. No entra en el payload de BullMQ, documentos Firestore, logs, trazas, respuestas tRPC ni eventos de navegador. Los DTOs públicos devuelven estado y últimos cuatro caracteres, nunca el secreto.

El worker resuelve la conexión justo antes de invocar el proveedor, tras verificar la propiedad de `collection -> user -> connection`. El trabajo lleva identificadores, no secretos. La rotación crea una nueva versión y deja trazabilidad; desactivar impide nuevas ejecuciones; borrar revoca el secreto y marca ejecuciones futuras como no disponibles. Las políticas de acceso deben impedir que una consulta por ID lea una conexión de otro usuario.

La whitelist desaparece solo cuando la autorización compruebe que el usuario tiene una conexión activa y compatible con el tipo de análisis. El modal Mantine es guía de producto: explica que falta una conexión y enlaza a Ajustes. No autoriza por sí mismo.

### Pantalla de ajustes cloud

La futura ruta de usuario debe permitir crear, probar, renombrar, activar/desactivar, rotar y eliminar conexiones. Una colección o análisis muestra una acción clara cuando el usuario carece de conexión: “Configurar proveedor”. La validación de backend sigue siendo obligatoria aunque la UI oculte el botón.

## Biblioteca local: decisión de almacenamiento

Una **biblioteca local** es una carpeta elegida por el usuario, distinta de este repositorio. Contiene colecciones, originales administrados, estado y exportaciones. SQLite es la fuente de verdad local.

```text
Mis-facturas/
├── open-with-codex/             entrada generada para el host Codex
├── open-with-claude-code/       entrada generada para Claude Code
├── open-with-opencode/          entrada generada para OpenCode
└── .bill-lm/
    ├── library.sqlite
    ├── objects/
    │   └── ab/ab12...<extensión>
    ├── backups/
    └── exports/
```

No se requiere `collection.yaml` ni una carpeta `source/`. El visor es el camino principal: crear colección, completar su contexto e importar XML/PDF. Al importar, el daemon valida el formato, calcula SHA-256, deduplica y copia el original de forma atómica a `.bill-lm/objects/<prefijo>/<hash>.<ext>`. La transacción SQLite solo se confirma cuando existe el objeto administrado; una recuperación al inicio limpia temporales o repara registros incompletos.

Las carpetas `open-with-*` son entrypoints generados y reemplazables para que el usuario abra la biblioteca en su host elegido. No son fuentes de verdad ni contienen colección, facturas, resultados o tokens. SQLite conserva esos hechos y la configuración de perfiles; el daemon puede regenerar las entradas cuando cambia de versión.

El usuario puede borrar el archivo que estaba en Descargas después de importarlo. La aplicación no depende de esa ruta. No existe `bill-lm.yaml` ni YAML operativo, ni fallback YAML: SQLite gobierna la biblioteca, perfiles, actividades, colecciones, rulesets, runs y resultados. Una exportación YAML puede ser portable y versionada, pero exige una importación explícita y nunca gobierna una ejecución. La CLI puede ofrecer importación masiva, pero usa el mismo flujo de copia:

```bash
bill-lm import --collection gastos-2026 ~/Downloads/*.xml
```

SQLite almacena colecciones, contexto, perfiles no secretos, facturas, hashes, rutas internas, ejecuciones, eventos, resultados y metadatos de versión. Los secretos de endpoint local se resuelven desde variable de entorno o keychain del sistema, nunca como texto plano en SQLite.

Las eliminaciones del visor deben ser soft delete con papelera lógica y periodo de retención. Los backups incluyen SQLite y manifiesto de objetos; “Exportar biblioteca” produce un paquete recuperable. Una restauración verifica hashes antes de aceptar los objetos.

### Identidad global y colecciones

Una factura tiene identidad propia dentro del tenant cloud o de la biblioteca local. Esa identidad se calcula con una clave de idempotencia basada en el emisor, tipo, establecimiento/punto/secuencial, fecha, total y hash del original o del XML normalizado, según el formato. La clave evita crear duplicados por una carga repetida sin confundir facturas distintas que comparten un nombre de archivo.

Las colecciones no son dueñas exclusivas de la factura. El modelo destino usa una relación muchos-a-muchos `Invoice <-> CollectionMembership`, con pertenencia, fechas, propósito y trazabilidad de quién la añadió. Una misma factura puede participar, por ejemplo, en una colección personal y otra de actividad profesional sin duplicar el original ni el resultado. Cada colección define propósito, rango de fechas y contexto de análisis; el run registra esos parámetros efectivos para permitir auditoría.

### Perfil tributario, actividades y colecciones

`EconomicActivity` es una entidad creada por el usuario y reutilizable entre colecciones; cada cambio crea una `EconomicActivityRevision` inmutable. Es independiente de cualquier catálogo oficial: si en el futuro existe un catálogo, este podrá sugerir datos o referencias, pero no reemplaza la actividad definida ni reescribe sus revisiones históricas. Cada revisión almacena estos campos y su función:

| Campo | Propósito |
| --- | --- |
| `displayName` | Nombre breve para que el usuario identifique la actividad en el visor. |
| `registeredActivityCode` opcional | Código declarado por el usuario si dispone de uno; no se inventa ni se exige. |
| `registeredActivityName` | Nombre registrado o declarado de la actividad, separado de la etiqueta breve. |
| `activityDescription` | Explica qué bienes o servicios ofrece y el contexto económico relevante. |
| `necessaryPurchases` | Describe compras/insumos que el usuario considera necesarios; aporta contexto, no elegibilidad automática. |
| `revenueVatTreatment` | Tratamiento de IVA que el usuario declara para sus ingresos. |
| `revenueVatTreatmentOther` condicional | Justificación breve obligatoria cuando el tratamiento es `other`. |
| `mixedUseDescription` | Explica uso mixto personal/profesional cuando corresponda. |
| `additionalFacts` | Hechos adicionales acotados que pueden faltar para interpretar la actividad. |

`revenueVatTreatment` usa exactamente: `taxed_nonzero`, `zero_with_credit`, `zero_without_credit`, `mixed`, `export`, `unknown` u `other`. Solo `other` habilita y exige `revenueVatTreatmentOther`; `unknown` conserva incertidumbre y no debe convertirse en una suposición fiscal. La actividad da contexto para evaluar evidencia, pero no prueba por sí misma la relación fiscal de una factura.

`TaxpayerProfileRevision` conserva identificadores pertinentes y referencias a actividades. La creación de colección es un flujo separado: `CollectionRevision` elige un único `purpose` reconocido (`vat_credit`, `business_income_tax` o `personal_expenses`), periodo civil inicio/fin, un taxpayer profile y una o más revisiones de actividades. Una colección sin purpose reconocido queda bloqueada y no llega al modelo. Los nombres anteriores `vat`, `business-income-expense` y `personal-expense-rebate` son legado de documentación/datos y se mapean de forma explícita durante migración; `other` no es un propósito fiscal ejecutable.

### Wizard de actividad económica

Cloud y visor local comparten el mismo wizard de **actividad**, separado del flujo de creación de colección. Usa una sola instancia de `@tanstack/react-form`; `Mantine Stepper` solo presenta y navega sus cuatro pasos:

1. **Identificación**: `displayName`, código opcional y nombre registrado.
2. **Descripción**: `activityDescription`, `necessaryPurchases` y `additionalFacts`.
3. **IVA y usos mixtos**: `revenueVatTreatment`, texto condicional de `other` y `mixedUseDescription`.
4. **Revisión/confirmación**: resumen, confirmación y creación de la revisión.

Cada paso tiene schema Zod propio; el envío usa el schema completo y validaciones cruzadas, incluida la obligatoriedad condicional de `revenueVatTreatmentOther`. El usuario puede volver a pasos visitados, no saltar a futuros; cada paso incluye etiqueta y descripción accesibles. Cloud persiste con tRPC/Postgres y local con daemon/SQLite, pero ambos usan el mismo schema, errores y contrato. El patrón no exige dependencia nueva: Mantine 8.3 documenta el `Stepper` controlado y la restricción de seleccionar pasos futuros mediante `allowNextStepsSelect`, mientras TanStack Form acepta Zod como Standard Schema: [Mantine Stepper](https://v8.mantine.dev/core/stepper), [TanStack Form validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation).

## Fuentes normativas SRI e importación manual

Cloud y biblioteca local aplican el mismo contrato de ruleset. Un administrador autorizado en cloud, o el propietario de la biblioteca local, importa manualmente una fuente normativa original en PDF o Markdown. La aplicación conserva el original de forma inmutable y content-addressed, genera un derivado normalizado separado y registra hash, formato, fuente declarada, jurisdicción, fecha efectiva, fecha de fin opcional, versión y responsable de revisión.

```text
original PDF/Markdown
  -> validación y almacenamiento inmutable
  -> normalización/versionado como derivado
  -> revisión humana
  -> activación explícita para un propósito y rango de fechas
  -> run fija ese ruleset antes de solicitar análisis al LLM
```

Un ruleset es inmutable después de activarse. Corregirlo crea otra versión. El análisis no puede comenzar si no existe una versión revisada, activa y aplicable al propósito y fecha de la colección/factura. El resultado guarda `rulesetId`, versión y hash. Markdown es una fuente normativa estructurada para normalizar y revisar, no una instrucción de prompt con capacidad para cambiar el comportamiento del agente.

La importación manual acepta XML de factura, ZIP de facturas y los formatos que tengan un parser registrado. ZIP se extrae en un directorio temporal controlado con límites de número de entradas, tamaño comprimido/descomprimido, ratio de expansión, profundidad, tiempo y memoria; rechaza rutas absolutas, traversal, enlaces, archivos duplicados y tipos no permitidos. Los XML se validan antes de normalizar. Un PDF sin parser compatible se conserva como original y queda `analysis-blocked` con una causa accionable: no se ejecuta como XML ni se inventa OCR.

Las mismas reglas de preservación, normalización, revisión, activación, gate e identidad se aplican en cloud y local. Cloud usa sus adaptadores de objetos/DB; local usa `.bill-lm/objects` y SQLite. Ninguna modalidad depende de credenciales del portal SRI. Portal, scraping, credenciales, sincronización y companion quedan fuera del alcance hasta definir autorización, términos de uso, seguridad y operación.

Las fuentes técnicas de comprobantes deben conservar su procedencia SRI, incluida la ficha técnica/XSD o norma aplicable y su vigencia. La página oficial de [Facturación Electrónica del SRI](https://www.sri.gob.ec/facturacion-electronica) publica ficha técnica y esquemas; las páginas oficiales de [Impuesto a la Renta](https://www.sri.gob.ec/impuesto-renta) y [declaración 2025](https://www.sri.gob.ec/declaracion-impuesto-a-la-renta-2025) ilustran por qué un ruleset debe registrar periodo y fuente. Estas referencias no sustituyen revisión tributaria ni fijan por sí mismas las tablas aplicables.

## Visor localhost compartido

Un único daemon local expone API, estado y visor. OAuth/agente y GPU escriben en la misma biblioteca y usan las mismas pantallas. El visor no necesita saber quién razonó sobre la factura; muestra el origen que quedó registrado en cada ejecución.

Casos de uso objetivo:

- Crear, editar, archivar y consultar colecciones; importar y eliminar facturas de manera recuperable.
- Buscar por número/secuencial, archivo, proveedor/emisor y RUC.
- Combinar filtros por rango de confianza, estado, tipo, fecha y monto.
- Abrir detalle de factura, líneas, resultado, razón y evidencia disponible.
- Ver ejecuciones previas, comparar resultados y conservar versiones en lugar de sobrescribirlas.
- Analizar pendientes, seleccionadas o todas; reanalizar y reintentar fallidas cuando el perfil lo permita.
- Recibir progreso en vivo y exportar datos.
- Consultar diagnóstico: perfil, proveedor, modelo, endpoint, última comprobación y error accionable.

El comportamiento actual solo cubre tabla de colección, detalle, carga, selección/eliminación, análisis/reanálisis y filtro por nombre o umbral de porcentaje. Buscar por número y rango real de confianza son objetivos del visor, no capacidades actuales.

## Perfiles de ejecución y diagnóstico

La biblioteca guarda varios perfiles no secretos y uno predeterminado. Una ejecución puede elegir otro sin cambiar el predeterminado. Ejemplos: `gpu-casa`, `codex-personal`, `claude-pro`.

| Tipo de perfil | Datos guardados | Acción del visor en v1 |
| --- | --- | --- |
| `local-endpoint` | Protocolo, URL base completa, modelo, etiqueta, referencia a secreto opcional. | Habilita “Analizar” después de comprobar endpoint y modelo. |
| `agent-host` | Host (`codex`, `claude-code`, `opencode`), etiqueta y capacidades. | Muestra “Ver cómo iniciar” y “Copiar comando”; observa el agente mediante MCP. |

El sistema no intenta descubrir ni leer tokens OAuth. Un probe declara si una CLI está disponible/autenticada y si el servidor MCP responde; otro confirma endpoint, modelo y compatibilidad local. `bill-lm doctor` lista fallos concretos y siguientes pasos. Deben existir README separados para OAuth/agentes y GPU local, incluidos prerrequisitos, instalación, autenticación, modelos compatibles y recuperación de errores.

## OAuth con agentes y MCP

Codex, Claude Code y OpenCode se autentican en sus propias sesiones locales o suscripciones. Bill-LM proporciona un servidor MCP común, estado común y envoltorios delgados por proveedor. Cada envoltorio solo contiene la configuración, archivo de agentes y skill que espera el host. No duplica reglas ni SQLite.

Referencias oficiales consultables antes de integrar:

- [Autenticación de OpenAI Codex](https://learn.chatgpt.com/docs/auth)
- [Inicio de Claude Code](https://code.claude.com/docs/en/getting-started)
- [Proveedores de OpenCode](https://opencode.ai/docs/providers) y [skills](https://opencode.ai/docs/skills)
- [Autorización MCP](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)

El MCP convierte la coordinación en determinista y deja el juicio de clasificación al modelo:

```text
create/start run
  -> list invoices elegibles
  -> claim invoice(runId, invoiceId, lease)
  -> get analysis context + contenido autorizado
  -> agente analiza una factura
  -> submit validated analysis | fail invoice
  -> siguiente factura hasta cerrar la ejecución
```

Herramientas mínimas:

- `start_run`: crea una ejecución con colección, perfil y criterios explícitos.
- `list_invoices` y `claim_invoice`: devuelven solo trabajos elegibles y otorgan un lease renovable.
- `get_invoice_context`: entrega factura, contexto de colección, esquema y reglas versionadas.
- `submit_analysis`: valida el esquema, idempotency key, hash de entrada y lease antes de persistir.
- `fail_invoice` y `retry_invoice`: registran causa estructurada y aplican política de reintento.
- `get_run_status` y `export_run`: permiten observar o extraer resultados.

El lease evita que dos agentes procesen la misma factura. Si un agente termina o se desconecta, el lease caduca y el daemon vuelve la factura a pendiente o fallida según política. Las rutas se mantienen dentro de la biblioteca; el agente recibe contenido o un identificador autorizado, no una ruta arbitraria. XML, PDF, nombres de archivo y texto extraído son entrada no confiable y no pueden modificar instrucciones, invocar herramientas no previstas ni acceder a archivos externos.

## GPU y endpoint local

El primer adaptador local usa OpenAI-compatible, con una URL base completa elegida por el usuario. No debe codificar `http://127.0.0.1:1234/v1`: LM Studio, Ollama con compatibilidad, vLLM u otro servidor pueden usar URL, puerto, ruta y requisitos distintos. Un probe consulta capacidad, modelo, tamaño máximo y respuesta estructurada antes de habilitar un perfil.

Si el endpoint pide clave, el perfil guarda una referencia a variable de entorno o keychain, no el valor. El botón del visor inicia el run y el daemon controla cola, progreso, reintentos y persistencia. Un adaptador Anthropic-compatible se evaluará después con contrato y matriz propios; no se asume interoperabilidad por similitud de nombres.

## Núcleo reutilizable y plan de aislamiento

La separación propuesta preserva el flujo cloud mientras permite que el daemon, MCP y runner GPU usen el mismo caso de uso.

| Puerto de aplicación | Responsabilidad | Adaptador cloud actual/futuro | Adaptador local futuro |
| --- | --- | --- | --- |
| `InvoiceSource` | Localizar y leer un original autorizado. | Prisma + MinIO. | SQLite + filesystem `objects/`. |
| `InvoiceParser` | Parsear y normalizar XML/PDF. | `parseAndValidateInvoiceXML` y transformaciones. | Mismo parser. |
| `PromptBuilder` | Construir mensajes y versión de prompt. | `bill-prompt-builder`. | Mismo builder versionado. |
| `LLMCompletionPort` | Resolver cliente y obtener salida. | OpenAI/Claude por conexión BYOK. | Endpoint OpenAI-compatible o agente MCP. |
| `AnalysisValidator` | Validar schema, tipos y semántica básica. | Esquemas `bill-analysis`. | Mismo validador. |
| `AnalysisSink` | Guardar resultado/proyección. | Prisma; transición a historial. | SQLite. |
| `RunStore` / `ProgressSink` | Crear run, leases, estados y eventos. | BullMQ + Firestore. | SQLite + SSE o WebSocket. |

### Datos normalizados, envelope y resultado V2

`NormalizedInvoiceV2` conserva la procedencia SRI necesaria para auditoría: identidad de comprobante, autorización o clave de acceso, fecha de emisión, emisor, comprador, líneas, impuestos por línea, total, hashes y versión del parser. No se pierde el original, pero el modelo recibe el subconjunto mínimo normalizado. PDF sin parser sigue preservado y `analysis-blocked`.

`AnalysisContext` construye un `PromptEnvelope` por roles, en lugar de concatenar texto:

1. `system`: invariantes de seguridad y límites inmutables.
2. `developer`: purpose, contrato de salida, perfil/revisiones de actividades/ruleset fijados y política de evidencia.
3. `user/data`: `NormalizedInvoiceV2` y observaciones limitadas, delimitadas como datos no confiables.

XML/PDF raw, nombres, descripciones de líneas, Markdown normativo y observaciones no cambian instrucciones, herramientas ni schema. Datos tributarios o prompts no llegan a logs/telemetría sin redacción.

`TaxAnalysisResultV2` sustituye el contrato autoritativo `percentage/reason` con una unión discriminada por `purpose`. Un run de `vat_credit` llena solo el área `vat`; uno de `business_income_tax`, solo `businessIncomeTax`; y uno de `personal_expenses`, solo `personalExpenses`. Las otras áreas se omiten o quedan `not_applicable` por contrato: no se infieren ni rellenan. El área aplicable incluye `applicability` (`applicable`, `not_applicable`, `insufficient_facts`, `blocked`), `assessment` (`eligible`, `ineligible`, `partial`, `needs_review`), `applicablePercentage` o monto solo cuando corresponda, razón, evidencia, referencias de ruleset y `confidence`. `applicablePercentage` expresa la proporción aplicable; `confidence` mide calidad del análisis. Ninguno sustituye al otro ni constituye dictamen legal.

Un gate común se ejecuta antes de claim o llamada LLM en cloud, GPU y MCP: valida revisión de colección/perfil/actividades, purpose reconocido y periodo, snapshots de payload, ruleset revisado-activo-vigente, factura normalizada/elegible y capability probe del perfil. Cada ausencia produce un estado bloqueado accionable; la UI no puede omitir el gate y el LLM no completa reglas ausentes.

`BillAnalysisService` contiene hoy varias de estas responsabilidades juntas: carga de modelo, Prisma, MinIO, Firestore, parser, prompt y proveedor. La migración debe extraer primero interfaces y pruebas de contrato sin cambiar comportamiento. `analyze-bills.use-case`, `analyze-job`, la cola, procedimientos tRPC y los proveedores son puntos de integración a revisar. `LLMProviderFactory` deja de ser singleton para BYOK: un resolver crea un cliente inmutable por ejecución y lo elimina al terminar.

La proyección que hoy vive en `BillHeader` puede continuar para no romper la web cloud. Se agregan `AnalysisRun` y `AnalysisResult` con versiones e idempotencia. La pantalla puede mostrar el último resultado aprobado como proyección y mantener los anteriores para auditoría/comparación.

## Contrato de resultado, auditoría y exportación

SQLite es el estado canónico local. Cada cambio relevante también puede emitirse a JSONL append-only para auditoría, y el usuario puede exportar JSON y CSV.

Cada run/result debe incluir como mínimo:

- `runId`, `invoiceId`, `collectionId`, estado, timestamps, intentos y error estructurado.
- Origen (`cloud-byok`, `agent-host`, `local-endpoint`), perfil, proveedor y modelo.
- Hash del original y hash del contenido normalizado.
- Versiones de prompt, parser, ruleset SRI y schema de resultado.
- Idempotency key, versión de aplicación y metadatos de capacidad del endpoint cuando apliquen.
- Resultado validado, razón, líneas y referencias a evidencia disponibles.

El JSONL no contiene secretos ni contenido sensible innecesario. Las exportaciones ofrecen filtros de colección, run, fecha y estado. Backups y restauraciones deben preservar IDs, hashes y versiones para que una auditoría siga siendo legible.

## Entregas por fase

### Fase 0: contratos y seguridad base

- Inventariar datos que entran a logs, Firestore y BullMQ.
- Definir puertos, estados de run, idempotencia global de factura, memberships muchos-a-muchos y esquema versionado.
- Añadir pruebas de aislamiento por usuario y prohibición de secretos en payloads/logs.
- Definir `NormalizedInvoiceV2`, `PromptEnvelope`, `TaxAnalysisResultV2` y códigos de bloqueo compartidos.

**Punto de aceptación:** una prueba concurrente demuestra que dos ejecuciones BYOK usan clientes distintos y ninguna clave aparece en cola, eventos o respuesta de API.

### Fase 1: BYOK cloud

- Crear modelo y UI de conexiones OpenAI/Claude, cifrado de sobre y autorización por propiedad.
- Resolver cliente por ejecución; retirar la dependencia funcional de whitelist.
- Usar modal Mantine solo como redirección a Ajustes.

**Punto de aceptación:** un usuario con conexión válida puede analizar; uno sin conexión recibe guía; un usuario no puede usar, leer ni inferir la conexión de otro.

### Fase 2: núcleo y resultados históricos

- Extraer puertos de `BillAnalysisService` con contract tests para cloud.
- Introducir `AnalysisRun`/`AnalysisResult`, memberships y rulesets versionados; preservar la proyección actual.
- Implementar importación manual de fuentes PDF/Markdown, normalización, revisión, activación y gate de análisis.
- Migrar `Collection.year` e `instructions` como revisión legacy, sin inferir propósito/actividad; mantener `BillHeader.percentage/reason` solo como proyección de compatibilidad.

**Punto de aceptación:** resultados históricos, idempotencia y ruleset aplicable funcionan sin alterar los resultados cloud existentes; un run sin ruleset activo queda bloqueado de forma explicable.

### Fase 3: biblioteca, daemon y visor local

- Implementar SQLite, objetos administrados, importación atómica, backup, export y visor.
- Implementar importación manual XML/ZIP segura y estados `analysis-blocked` para formatos sin parser.
- Implementar perfiles, probes, `doctor`, filtros y eventos de progreso.

**Punto de aceptación:** un usuario crea colección con propósito/rango, importa factura/XML o ZIP dentro de límites, activa un ruleset revisado, la analiza con endpoint local y recupera resultados tras reiniciar el daemon.

### Fase 4: MCP y agentes OAuth

- Publicar servidor MCP, leases, skills/envoltorios por host y guías de setup.
- Conectar el visor a runs iniciados por agentes.

**Punto de aceptación:** dos hosts de agente procesan una biblioteca sin duplicar facturas; una interrupción expira lease y deja un estado recuperable.

### Fase 5: endurecimiento y distribución

- Matriz de servidores/modelos, migraciones, empaquetado, telemetría opt-in y recuperación de fallos.
- Evaluar CTA OAuth desde visor solo si el host ofrece integración segura y portable.

## Riesgos y pruebas necesarias

| Riesgo | Control y prueba |
| --- | --- |
| Fuga o cruce de API keys BYOK | Pruebas de concurrencia, inspección de logs/payloads y AAD por usuario/conexión. |
| Doble procesamiento por agentes | Leases, idempotency key, unique constraints y pruebas de carrera. |
| Corrupción tras corte de energía | Importación atómica, journal SQLite, recuperación y backup/restore con hashes. |
| ZIP/XML hostil o expansivo | Extracción en temporal controlado, allowlist, límites de tamaño/ratio/entradas y rechazo de traversal/enlaces. |
| Prompt injection desde facturas | Separar instrucciones de datos, schema estricto, herramientas mínimas y fixtures maliciosos. |
| Perfil o actividad reescribe historia | Revisiones inmutables y snapshots de perfil/actividades/colección/ruleset en cada run. |
| IVA confundido con gasto/rebaja | Propósito singular, resultado V2 por área y tests que exigen ruleset/evidencia. |
| Diferencias entre endpoints locales | Probe por capacidad, adaptadores separados y matriz de compatibilidad. |
| Cambios de proveedor | Pin de versiones, pruebas de contrato y consulta de documentación actual antes de integrar. |
| Reglas tributarias desactualizadas | Ruleset con fuente, versión y vigencia; revisión humana/legal antes de presentar una conclusión fiscal. |

## Próxima iteración: arquitectura de prompt y operación de rulesets SRI

La importación manual, conservación de originales, normalización, revisión, activación y gate ya definen el alcance de esta propuesta. Esta sección conserva decisiones pendientes antes de modificar `bill-prompt` o `bill-prompt-builder`:

1. **Mensajes.** Fijar el texto concreto y los presupuestos del `PromptEnvelope` ya separado por roles; comprobar que cada proveedor conserva sus límites sin duplicar datos.
2. **Actividad profesional.** Definir gobernanza de revisiones creadas por usuario y, si se incorpora un catálogo oficial opcional, su procedencia y mapeo sin sustituir la actividad del usuario ni afirmar relación fiscal de una factura.
3. **SRI.** Definir el esquema normalizado de cada regla, las fuentes oficiales admisibles, responsabilidades de revisión, resolución de conflictos y qué ocurre cuando no existe una versión activa para la fecha/proposito. Un ruleset debe reproducirse; no debe depender de texto libre escondido en un prompt.
4. **Salida.** Definir JSON Schema/structured output, campos requeridos, rangos, enums, citas/evidencia, razón humana y tratamiento de incertidumbre. El validador rechaza o marca resultados inválidos antes de proyectarlos.
5. **Seguridad.** Delimitar XML/PDF/texto extraído como datos no confiables; establecer delimitadores, longitud máxima, normalización y una política explícita ante instrucciones inyectadas.
6. **Coste y contexto.** Fijar presupuesto de tokens, truncado reproducible, selección de líneas y límites para lotes. Registrar versión y hash de cada input efectivo sin guardar secretos.
7. **Evaluación.** Construir fixtures anonimizados con respuestas esperadas, casos ambiguos, facturas corruptas y ataques de prompt injection; medir exactitud, validación, costo y regresiones por modelo/ruleset.

Las pruebas mínimas cubren: mismo invoice y snapshots producen el mismo envelope/gate en cloud y local; cambiar actividades o ruleset no cambia el histórico; una factura puede pertenecer a dos colecciones sin duplicar objeto; cada fallo de gate ocurre antes de la llamada LLM; entradas hostiles no cambian envelope/schema; IVA no se marca aplicable por existir porcentaje; el backfill legacy no crea conclusiones fiscales; y un run llena únicamente el área V2 de su purpose.

El análisis de una factura no sustituye asesoría contable ni tributaria. Cualquier guía SRI que afecte una decisión fiscal debe citar su fuente y vigencia, y pasar una revisión humana competente.

## Referencia complementaria

Para revisar clientes de OpenAI Agents y evitar el patrón de cliente global, consultar [configuración de cliente de OpenAI Agents JS](https://openai.github.io/openai-agents-js/guides/config). El manifiesto declara `@openai/agents ^0.7.2` y `openai ^6.32.0`; `bun.lock` resuelve `@openai/agents@0.7.2` y `openai@6.32.0`. La documentación actual de custom client indica `openai >=7.2`. Antes de implementar, verificar las versiones resueltas y la matriz real de compatibilidad desde `bun.lock`; no prescribir una actualización ciega como parte de este diseño.
