CREATE TYPE "FiscalReferenceSourceType" AS ENUM ('MARKDOWN', 'PDF');

CREATE TABLE "fiscal_references" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sourceType" "FiscalReferenceSourceType" NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "normalizedSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    CONSTRAINT "fiscal_references_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_references_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "fiscal_reference_user_deleted_idx"
  ON "fiscal_references"("userId", "deletedAt");
