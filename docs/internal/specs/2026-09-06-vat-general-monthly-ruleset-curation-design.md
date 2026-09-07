# Curación de IVA general mensual para 2026

## Objetivo

Publicar un ruleset oficial, trazable y seleccionable para
`vat_credit + general + monthly` que cubra períodos de 2026. Su objetivo es
aportar evidencia normativa para un análisis conservador de facturas; no
reemplaza la declaración ni el criterio profesional tributario.

## Hallazgo y límite

La sección local histórica `ec-sri-lrti` contiene el Art. 65 con una tarifa de
IVA de 12 %. El SRI publica actualmente 13 % como tarifa general. Por ello los
artifacts existentes no se reclasificarán ni se sobrescribirán. Permanecen como
historia, pero no serán fuente del nuevo ruleset.

Fuentes oficiales a congelar:

- LRTI publicada por el SRI, que contiene los Arts. 64 a 69 y el crédito
  tributario del Art. 66.
- Página institucional de IVA del SRI, usada como contraste de periodicidad y
  tarifa vigente.
- Guía de IVA del SRI, reservada para una fase posterior: su PDF es oficial,
  pero el splitter actual lo mantiene como un documento ambiguo completo.

## Diseño de publicación

1. Se crea una fuente nueva `ec-sri-lrti-2026` con el PDF oficial vigente; no
   se cambia `ec-sri-lrti` ni sus hashes históricos.
2. Se adquiere y secciona la fuente nueva con el pipeline estándar. El hash,
   URL, páginas y fecha de recuperación quedan en cache y artifacts.
3. Se revisan manualmente solo estos candidatos, todos como
   `vat_credit/general`, con vigencia de producto desde `2026-01-01`:
   - Art. 64: comprobantes y desglose del IVA.
   - Art. 65: tarifa; no habilita una tasa fija en el modelo.
   - Art. 66: requisitos, crédito íntegro, proporcionalidad y exclusiones.
   - Art. 67: declaración y periodicidad.
   - Art. 69: arrastre/compensación como contexto, no como conclusión por
     factura.
4. El resultado debe conservar incertidumbre: sin información de ventas,
   destino o proporcionalidad, el análisis marca revisión necesaria y no
   determina crédito pleno.
5. Se valida y publica el bundle `ec-sri-2026.3`, se sincroniza únicamente la
   selección `vat_credit/general/monthly` y se activa de forma explícita.

## Criterios de aceptación jurídica-operativa

- Cada fragmento tiene texto, páginas y hash de la nueva fuente oficial.
- La revisión no convierte contenido de declaración o tarifa en una regla de
  deducibilidad automática.
- El ruleset activo contiene fragments del source nuevo, no de la copia LRTI
  antigua.
- La base tiene exactamente un ruleset `active` para la selección indicada.
- Un contexto de 2026 encuentra el ruleset; uno de 2025 continúa bloqueado,
  para no aplicar retrospectivamente esta publicación.

## Fuera de alcance

- Dividir la guía de IVA de 27 páginas por capítulos y usarla como evidencia
  adicional.
- Cubrir RIMPE, periodicidad semestral, exportadores, construcción, tarifas
  reducidas o escenarios sectoriales.
- Cambiar por base de datos la colección personal del usuario: el operador
  deberá crear una revisión de contexto para 2026 desde la UI.

## Fuentes

- https://www.sri.gob.ec/impuesto-al-valor-agregado-iva
- https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/ba4df78b-a7ad-47b0-b667-c99632913bf3/3.%20LEY%20DEL%20REGIMEN%20TIBUTARIO%20INTERNO.pdf
- https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/e084fae5-9677-450c-8161-21e7c3a9f65b/Gu%C3%ADa%20para%20el%20llenado%20del%20Formulario%20Impuesto%20al%20Valor%20Agregado%20IVA.PDF
