-- Preserve existing collection values while allowing the profile/context model
-- to be the sole source of taxpayer identity for new collections.
ALTER TABLE "collections"
  ALTER COLUMN "personalIdNumber" DROP NOT NULL,
  ALTER COLUMN "professionalIdNumber" DROP NOT NULL;
