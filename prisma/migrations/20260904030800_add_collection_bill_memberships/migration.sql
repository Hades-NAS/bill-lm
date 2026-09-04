CREATE TABLE "collection_bill_memberships" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_bill_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collection_bill_memberships_collection_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "collection_bill_memberships_bill_fkey" FOREIGN KEY ("billId") REFERENCES "bills_header"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "collection_bill_membership_unique" ON "collection_bill_memberships"("collectionId", "billId");
CREATE INDEX "collection_bill_membership_bill_idx" ON "collection_bill_memberships"("billId");
INSERT INTO "collection_bill_memberships" ("id", "collectionId", "billId", "createdAt")
SELECT md5('collection-membership:' || "id"), "collectionId", "id", "createdAt" FROM "bills_header";
