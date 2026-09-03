-- Additive only: keeps users and every existing domain foreign key unchanged.
CREATE TYPE "AuthProvider" AS ENUM ('FIREBASE');

CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "linkedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMPTZ,
    "disabledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_identities_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "auth_identity_provider_subject_key"
  ON "auth_identities"("provider", "subject");
CREATE INDEX "auth_identity_user_id_idx" ON "auth_identities"("userId");
