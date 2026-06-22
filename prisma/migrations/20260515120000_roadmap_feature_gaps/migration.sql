-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('document', 'physical', 'office');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum (append new roles)
ALTER TYPE "Role" ADD VALUE 'faculty_admin';
ALTER TYPE "Role" ADD VALUE 'hr_admin';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "employeeDepartment" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "signatories" ADD COLUMN     "weeklyHoursJson" JSONB;

-- CreateTable
CREATE TABLE "signatory_requirements" (
    "id" SERIAL NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "label" TEXT NOT NULL,
    "instructions" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatory_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_requirement_fulfillments" (
    "id" TEXT NOT NULL,
    "clearanceSignatureId" TEXT NOT NULL,
    "signatoryRequirementId" INTEGER NOT NULL,
    "documentUrls" JSONB NOT NULL DEFAULT '[]',
    "physicalAttestedAt" TIMESTAMP(3),
    "officeVerifiedAt" TIMESTAMP(3),
    "officeVerifiedByUserId" TEXT,

    CONSTRAINT "clearance_requirement_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_period_extensions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "extendsTo" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clearance_period_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signatory_requirements_signatoryId_idx" ON "signatory_requirements"("signatoryId");

-- CreateIndex
CREATE INDEX "clearance_requirement_fulfillments_clearanceSignatureId_idx" ON "clearance_requirement_fulfillments"("clearanceSignatureId");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_requirement_fulfillments_clearanceSignatureId_signatoryRequirementId_key" ON "clearance_requirement_fulfillments"("clearanceSignatureId", "signatoryRequirementId");

-- CreateIndex
CREATE INDEX "clearance_period_extensions_studentId_status_idx" ON "clearance_period_extensions"("studentId", "status");

-- AddForeignKey
ALTER TABLE "signatory_requirements" ADD CONSTRAINT "signatory_requirements_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "signatories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_requirement_fulfillments" ADD CONSTRAINT "clearance_requirement_fulfillments_clearanceSignatureId_fkey" FOREIGN KEY ("clearanceSignatureId") REFERENCES "clearance_signatures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_requirement_fulfillments" ADD CONSTRAINT "clearance_requirement_fulfillments_signatoryRequirementId_fkey" FOREIGN KEY ("signatoryRequirementId") REFERENCES "signatory_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_requirement_fulfillments" ADD CONSTRAINT "clearance_requirement_fulfillments_officeVerifiedByUserId_fkey" FOREIGN KEY ("officeVerifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_period_extensions" ADD CONSTRAINT "clearance_period_extensions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_period_extensions" ADD CONSTRAINT "clearance_period_extensions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
