CREATE TYPE "ProviderConnectionProvider" AS ENUM ('OPENAI', 'CLAUDE');

CREATE TABLE "provider_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ProviderConnectionProvider" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "modelId" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "secretCiphertext" TEXT NOT NULL,
    "secretIv" VARCHAR(64) NOT NULL,
    "secretAuthTag" VARCHAR(64) NOT NULL,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "secretLastFour" VARCHAR(4) NOT NULL,
    "probedAt" TIMESTAMPTZ,
    "lastProbeError" VARCHAR(255),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_connections_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "provider_connection_user_active_idx" ON "provider_connections"("userId", "isActive");
CREATE INDEX "provider_connection_user_deleted_idx" ON "provider_connections"("userId", "deletedAt");
CREATE UNIQUE INDEX "provider_connection_one_default_per_user"
  ON "provider_connections"("userId")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;
