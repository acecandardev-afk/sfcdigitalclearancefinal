-- CreateEnum
CREATE TYPE "InstitutionalCertificationRole" AS ENUM ('none', 'preparer', 'hrmdo', 'president');

-- AlterTable
ALTER TABLE "signatories" ADD COLUMN "institutionalCertRole" "InstitutionalCertificationRole" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "institutional_office_definitions" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "departmentLabel" TEXT NOT NULL,
    "signatoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutional_office_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institutional_office_definitions_sortOrder_idx" ON "institutional_office_definitions"("sortOrder");

-- AddForeignKey
ALTER TABLE "institutional_office_definitions" ADD CONSTRAINT "institutional_office_definitions_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "signatories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "institutional_clearance_files" (
    "id" TEXT NOT NULL,
    "institutionalClearanceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "blobUrl" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutional_clearance_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institutional_clearance_files_institutionalClearanceId_idx" ON "institutional_clearance_files"("institutionalClearanceId");

-- AddForeignKey
ALTER TABLE "institutional_clearance_files" ADD CONSTRAINT "institutional_clearance_files_institutionalClearanceId_fkey" FOREIGN KEY ("institutionalClearanceId") REFERENCES "institutional_clearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_clearance_files" ADD CONSTRAINT "institutional_clearance_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default office template (unassigned; superadmin can assign per office in settings)
INSERT INTO "institutional_office_definitions" ("id", "sortOrder", "departmentLabel", "signatoryId", "createdAt", "updatedAt") VALUES
('ioffseed0001', 0, 'Immediate Department Head', NULL, NOW(), NOW()),
('ioffseed0002', 1, 'Dean/Principal', NULL, NOW(), NOW()),
('ioffseed0003', 2, 'HR Office', NULL, NOW(), NOW()),
('ioffseed0004', 3, 'VP for Administration', NULL, NOW(), NOW()),
('ioffseed0005', 4, 'VP for Academic Affairs', NULL, NOW(), NOW()),
('ioffseed0006', 5, 'VP for Student Affairs', NULL, NOW(), NOW()),
('ioffseed0007', 6, 'Accounting / Bookkeeper', NULL, NOW(), NOW()),
('ioffseed0008', 7, 'Disbursing Officer', NULL, NOW(), NOW()),
('ioffseed0009', 8, 'Canteen', NULL, NOW(), NOW()),
('ioffseed0010', 9, 'Supply & Property', NULL, NOW(), NOW()),
('ioffseed0011', 10, 'Library', NULL, NOW(), NOW()),
('ioffseed0012', 11, 'Registrar', NULL, NOW(), NOW()),
('ioffseed0013', 12, 'ICT Office', NULL, NOW(), NOW()),
('ioffseed0014', 13, 'Guidance Office', NULL, NOW(), NOW()),
('ioffseed0015', 14, 'Security', NULL, NOW(), NOW());
