-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "signatories" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "signatories" ADD COLUMN "archivedAt" TIMESTAMP(3);
