CREATE TABLE "economic_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    CONSTRAINT "economic_activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "economic_activities_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "economic_activity_id_user_key"
  ON "economic_activities"("id", "userId");
CREATE INDEX "economic_activity_user_deleted_idx"
  ON "economic_activities"("userId", "deletedAt");

CREATE TABLE "economic_activity_revisions" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "registeredActivityCode" VARCHAR(100),
    "registeredActivityName" VARCHAR(500) NOT NULL,
    "activityDescription" TEXT NOT NULL,
    "necessaryPurchases" TEXT,
    "revenueVatTreatment" VARCHAR(50) NOT NULL,
    "revenueVatTreatmentOther" TEXT,
    "mixedUseDescription" TEXT,
    "additionalFacts" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "economic_activity_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "economic_activity_revisions_activity_user_fkey"
      FOREIGN KEY ("activityId", "userId")
      REFERENCES "economic_activities"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "economic_activity_revisions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "economic_activity_revision_number_key"
  ON "economic_activity_revisions"("activityId", "revision");
CREATE UNIQUE INDEX "economic_activity_revision_id_user_key"
  ON "economic_activity_revisions"("id", "userId");
CREATE INDEX "economic_activity_revision_user_activity_idx"
  ON "economic_activity_revisions"("userId", "activityId");

CREATE TABLE "taxpayer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    CONSTRAINT "taxpayer_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "taxpayer_profiles_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "taxpayer_profile_id_user_key"
  ON "taxpayer_profiles"("id", "userId");
CREATE INDEX "taxpayer_profile_user_deleted_idx"
  ON "taxpayer_profiles"("userId", "deletedAt");

CREATE TABLE "taxpayer_profile_revisions" (
    "id" TEXT NOT NULL,
    "taxpayerProfileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "personalIdNumber" VARCHAR(10),
    "professionalIdNumber" VARCHAR(13),
    "additionalFacts" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "taxpayer_profile_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "taxpayer_profile_revisions_profile_user_fkey"
      FOREIGN KEY ("taxpayerProfileId", "userId")
      REFERENCES "taxpayer_profiles"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "taxpayer_profile_revisions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "taxpayer_profile_revision_number_key"
  ON "taxpayer_profile_revisions"("taxpayerProfileId", "revision");
CREATE UNIQUE INDEX "taxpayer_profile_revision_id_user_key"
  ON "taxpayer_profile_revisions"("id", "userId");
CREATE INDEX "taxpayer_profile_revision_user_profile_idx"
  ON "taxpayer_profile_revisions"("userId", "taxpayerProfileId");

CREATE TABLE "taxpayer_profile_activity_revisions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxpayerProfileRevisionId" TEXT NOT NULL,
    "economicActivityRevisionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "taxpayer_profile_activity_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "taxpayer_profile_activity_revisions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "taxpayer_profile_activity_profile_user_fkey"
      FOREIGN KEY ("taxpayerProfileRevisionId", "userId")
      REFERENCES "taxpayer_profile_revisions"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "taxpayer_profile_activity_activity_user_fkey"
      FOREIGN KEY ("economicActivityRevisionId", "userId")
      REFERENCES "economic_activity_revisions"("id", "userId")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "taxpayer_profile_activity_revision_unique"
  ON "taxpayer_profile_activity_revisions"("taxpayerProfileRevisionId", "economicActivityRevisionId");
CREATE INDEX "taxpayer_profile_activity_user_profile_idx"
  ON "taxpayer_profile_activity_revisions"("userId", "taxpayerProfileRevisionId");
