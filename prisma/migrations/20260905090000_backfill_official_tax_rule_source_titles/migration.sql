-- Repair the technical labels written by the initial ruleset sync.
-- The URL and prior title guards make this safe to run in every environment.
UPDATE "tax_rule_sources"
SET "title" = 'Ley de Régimen Tributario Interno (LRTI)'
WHERE "officialUrl" = 'https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/14376e67-9c72-4cf1-96b8-ebed61568ff7/LEY_DE_R%C3%89GIMEN_TRIBUTARIO_INTERNO_LRTI.pdf'
  AND "title" = 'ec-sri-lrti';

UPDATE "tax_rule_sources"
SET "title" = 'Reglamento para la Aplicación de la Ley de Régimen Tributario Interno (RLRTI)'
WHERE "officialUrl" = 'https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/7169103f-f014-4bf2-bf24-fb29b34e8d07/REGLAMENTO_PARA_APLICACION_LEY_DE_REGIMEN_TRIBUTARIO_INTERNO.pdf'
  AND "title" = 'ec-sri-rlrti';
