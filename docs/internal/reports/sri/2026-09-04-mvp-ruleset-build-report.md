# Bundle SRI MMVP: revisión y build

Fecha: 2026-09-04

## Resultado

Se validaron 181 secciones revisadas y se construyó el bundle local
`ec-sri-2026.1`.

```text
Archivo: resources/tax-rules/ec/sri/rulesets/ec-sri-2026.1.bundle.json
Hash: sha256:b67e33a5149fe56a4fb09ac217b53425c1e701f1b18f31f1a393866dbc1aa367
Fuentes: ec-sri-lrti, ec-sri-rlrti
Reglas semánticas: 0
DB: sin cambios
```

El build comprueba schemas, IDs, fuentes y vigencias. No demuestra que el
bundle sea suficiente para producir una conclusión tributaria ni lo deja
seleccionable por la aplicación.

## Secciones resueltas para el MMVP

Las seis decisiones se guardaron con páginas, hash del PDF, responsable y
justificación en `resources/tax-rules/ec/sri/sections/reviewed/`.

| Sección                       | Propósito             | Régimen   | Motivo de la decisión                                                                                 |
| ----------------------------- | --------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `ec-sri-rlrti-art-196-part-2` | `vat_credit`          | `unknown` | Define "pañal popular" para el numeral 21 del artículo 55 de la LRTI.                                 |
| `ec-sri-rlrti-art-196-part-3` | `vat_credit`          | `unknown` | Fija las condiciones de alojamiento del numeral 28 del artículo 56 de la LRTI.                        |
| `ec-sri-rlrti-art-196-part-4` | `vat_credit`          | `unknown` | Define vehículo eléctrico para numerales de IVA; la referencia a ICE quedó fuera del MMVP.            |
| `ec-sri-rlrti-art-4-part-2`   | `business_income_tax` | `unknown` | Regula declaración, exención y liquidación de IR para organizaciones de economía popular y solidaria. |
| `ec-sri-rlrti-art-5-part-2`   | `business_income_tax` | `unknown` | Regula el anticipo voluntario de IR de esas organizaciones.                                           |
| `ec-sri-rlrti-art-6-part-2`   | `vat_credit`          | `unknown` | Regula la periodicidad mensual o semestral de IVA de esas organizaciones.                             |

Usé `unknown` porque el catálogo actual no contiene el régimen de economía
popular y solidaria. Marcar esas secciones como `general` habría afirmado un
alcance que el texto no da. El selector actual no usa fragmentos `unknown` para
un perfil `general`; por eso estas seis secciones sirven para probar el
pipeline, no para decidir una factura de ese perfil.

El [RLRTI publicado por el SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/fe699a5c-a49a-42e1-a71f-61d66e752ed8/Reglamento%20para%20la%20Aplicaci%C3%B3n%20de%20la%20Ley%20de%20R%C3%A9gimen%20Tributario%20Interno.pdf) contiene los tres apartados del artículo 196 revisados.

## Bloqueos conservados

No resolví estas secciones porque el modelo actual perdería información o el
fragmento todavía incluye un documento completo.

| Sección o fuente                             | Razón                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ec-sri-rlrti-art-1-part-2` a `art-3-part-2` | Regulan un régimen de economía popular y solidaria que el catálogo no modela; no son material directo para clasificar una factura del MMVP.                  |
| `ec-sri-rlrti-art-7-part-2`                  | Contiene retenciones de IR y de IVA. El comando actual admite un propósito por resolución.                                                                   |
| Guía de IR para personas naturales           | El borrador contiene las 80 páginas. Requiere un splitter por capítulos antes de asignar gastos personales, dependencia o actividad económica.               |
| Guía RIMPE                                   | El borrador mezcla Negocio Popular, Emprendedor y ejercicios 2022-2024. El SRI mantiene ambas categorías con obligaciones distintas.                         |
| Guía de IVA                                  | El borrador contiene las 27 páginas, varios tipos de contribuyente y periodicidad mensual o semestral. Requiere división antes de clasificar sus fragmentos. |

El SRI distingue Negocio Popular y Emprendedor en su
[información vigente de RIMPE](https://www.sri.gob.ec/rimpe), y publica la guía
de IVA dentro de [Formularios e Instructivos](https://www.sri.gob.ec/formularios-e-instructivos).

## Límite del bundle actual

Las 175 secciones históricas de LRTI ya estaban publicadas como
`business_income_tax` y `general`. Incluyen material más amplio que esa
selección. El bundle las conserva para no reescribir una revisión existente,
pero esa clasificación debe revisarse por sección antes de activar una versión
para análisis real.

El siguiente trabajo debe añadir un splitter para las tres guías, una forma de
asignar varios propósitos a una misma resolución y un régimen específico para
economía popular y solidaria, si el producto lo requiere. Después se puede
crear una versión nueva y sincronizarla mediante un comando con `--apply`.
