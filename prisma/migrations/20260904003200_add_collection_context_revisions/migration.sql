CREATE UNIQUE INDEX "collection_id_user_key" ON "collections"("id", "userId");

CREATE TABLE "collection_context_revisions" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taxpayerProfileRevisionId" TEXT NOT NULL,
  "purpose" VARCHAR(50) NOT NULL,
  "periodStartDate" DATE NOT NULL,
  "periodEndDate" DATE NOT NULL,
  "notes" TEXT,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_context_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collection_context_collection_user_fkey" FOREIGN KEY ("collectionId", "userId") REFERENCES "collections"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "collection_context_profile_user_fkey" FOREIGN KEY ("taxpayerProfileRevisionId", "userId") REFERENCES "taxpayer_profile_revisions"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "collection_context_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "collection_context_revision_number_key" ON "collection_context_revisions"("collectionId", "revision");
CREATE UNIQUE INDEX "collection_context_revision_id_user_key" ON "collection_context_revisions"("id", "userId");
CREATE INDEX "collection_context_revision_user_collection_idx" ON "collection_context_revisions"("userId", "collectionId");

CREATE TABLE "collection_context_activity_revisions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "collectionContextRevisionId" TEXT NOT NULL,
  "economicActivityRevisionId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_context_activity_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collection_context_activity_context_user_fkey" FOREIGN KEY ("collectionContextRevisionId", "userId") REFERENCES "collection_context_revisions"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "collection_context_activity_activity_user_fkey" FOREIGN KEY ("economicActivityRevisionId", "userId") REFERENCES "economic_activity_revisions"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "collection_context_activity_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "collection_context_activity_revision_unique" ON "collection_context_activity_revisions"("collectionContextRevisionId", "economicActivityRevisionId");
CREATE INDEX "collection_context_activity_user_context_idx" ON "collection_context_activity_revisions"("userId", "collectionContextRevisionId");
