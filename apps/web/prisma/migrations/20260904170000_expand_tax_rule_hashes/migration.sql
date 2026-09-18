ALTER TABLE "fiscal_references"
  ALTER COLUMN "contentHash" TYPE VARCHAR(71);

ALTER TABLE "tax_rule_sources"
  ALTER COLUMN "contentHash" TYPE VARCHAR(71);

ALTER TABLE "tax_rule_fragments"
  ALTER COLUMN "contentHash" TYPE VARCHAR(71);

ALTER TABLE "tax_rule_sets"
  ALTER COLUMN "contentHash" TYPE VARCHAR(71);
