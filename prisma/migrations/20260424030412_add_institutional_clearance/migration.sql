-- CreateEnum
CREATE TYPE "InstitutionalClearanceStatus" AS ENUM ('draft', 'pending', 'in_progress', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "InstitutionalItemStatus" AS ENUM ('pending', 'approved', 'rejected', 'waived');

-- CreateTable
CREATE TABLE "institutional_clearance" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "personnelType" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "dateOfSeparation" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "InstitutionalClearanceStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutional_clearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutional_clearance_items" (
    "id" TEXT NOT NULL,
    "institutionalClearanceId" TEXT NOT NULL,
    "departmentLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "status" "InstitutionalItemStatus" NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "approverName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,

    CONSTRAINT "institutional_clearance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutional_clearance_approvals" (
    "id" TEXT NOT NULL,
    "institutionalClearanceId" TEXT NOT NULL,
    "preparedByName" TEXT,
    "preparedAt" TIMESTAMP(3),
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "institutional_clearance_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institutional_clearance_requesterId_idx" ON "institutional_clearance"("requesterId");

-- CreateIndex
CREATE INDEX "institutional_clearance_status_idx" ON "institutional_clearance"("status");

-- CreateIndex
CREATE INDEX "institutional_clearance_items_institutionalClearanceId_idx" ON "institutional_clearance_items"("institutionalClearanceId");

-- CreateIndex
CREATE UNIQUE INDEX "institutional_clearance_approvals_institutionalClearanceId_key" ON "institutional_clearance_approvals"("institutionalClearanceId");

-- AddForeignKey
ALTER TABLE "institutional_clearance" ADD CONSTRAINT "institutional_clearance_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_clearance_items" ADD CONSTRAINT "institutional_clearance_items_institutionalClearanceId_fkey" FOREIGN KEY ("institutionalClearanceId") REFERENCES "institutional_clearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_clearance_items" ADD CONSTRAINT "institutional_clearance_items_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_clearance_approvals" ADD CONSTRAINT "institutional_clearance_approvals_institutionalClearanceId_fkey" FOREIGN KEY ("institutionalClearanceId") REFERENCES "institutional_clearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
