ALTER TABLE "taxpayer_profile_revisions"
  ADD COLUMN "hasEmploymentIncome" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasRuc" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taxRegime" VARCHAR(50) NOT NULL DEFAULT 'unknown',
  ADD COLUMN "vatFilingFrequency" VARCHAR(20) NOT NULL DEFAULT 'none';
