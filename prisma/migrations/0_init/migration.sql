-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."BillFileType" AS ENUM ('XML', 'PDF', 'TEXT', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "public"."BillTargetType" AS ENUM ('PERSONAL', 'PROFESSIONAL', 'OTHER');

-- CreateTable
CREATE TABLE "public"."bills_details" (
    "id" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "billId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bills_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bills_header" (
    "id" TEXT NOT NULL,
    "number" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "buyerName" VARCHAR(255) NOT NULL,
    "idBuyer" VARCHAR(255) NOT NULL,
    "totalWithoutTaxes" DOUBLE PRECISION NOT NULL,
    "taxes" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "comercialName" VARCHAR(255) NOT NULL,
    "socialName" VARCHAR(255) NOT NULL,
    "idSeller" VARCHAR(255) NOT NULL,
    "addressMatriz" VARCHAR(255) NOT NULL,
    "fileType" "public"."BillFileType" NOT NULL DEFAULT 'XML',
    "billType" "public"."BillTargetType" NOT NULL DEFAULT 'PERSONAL',
    "storagePath" VARCHAR(255) NOT NULL,
    "percentage" DOUBLE PRECISION,
    "reason" VARCHAR(10000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "bills_header_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collections" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "instructions" VARCHAR(555),
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "personalIdNumber" VARCHAR(10) NOT NULL,
    "professionalIdNumber" VARCHAR(13) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "primaryEmail" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bill_detail_bill_id_idx" ON "public"."bills_details"("billId" ASC);

-- CreateIndex
CREATE INDEX "bill_detail_deleted_at_idx" ON "public"."bills_details"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "bill_collection_id_idx" ON "public"."bills_header"("collectionId" ASC);

-- CreateIndex
CREATE INDEX "bill_deleted_at_idx" ON "public"."bills_header"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "collection_deleted_at_idx" ON "public"."collections"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "collection_year_idx" ON "public"."collections"("year" ASC);

-- AddForeignKey
ALTER TABLE "public"."bills_details" ADD CONSTRAINT "bills_details_billId_fkey" FOREIGN KEY ("billId") REFERENCES "public"."bills_header"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bills_header" ADD CONSTRAINT "bills_header_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

