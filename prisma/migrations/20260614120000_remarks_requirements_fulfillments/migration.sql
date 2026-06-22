-- AlterTable
ALTER TABLE "clearance_requirement_fulfillments" ADD COLUMN "officeVerificationNotes" TEXT;

-- AlterTable
ALTER TABLE "institutional_clearance_items" ADD COLUMN "submissionRemarks" TEXT;

-- CreateTable
CREATE TABLE "institutional_clearance_item_fulfillments" (
    "id" TEXT NOT NULL,
    "institutionalClearanceItemId" TEXT NOT NULL,
    "signatoryRequirementId" INTEGER NOT NULL,
    "documentUrls" JSONB NOT NULL DEFAULT '[]',
    "physicalAttestedAt" TIMESTAMP(3),
    "officeVerifiedAt" TIMESTAMP(3),
    "officeVerifiedByUserId" TEXT,
    "officeVerificationNotes" TEXT,

    CONSTRAINT "institutional_clearance_item_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institutional_clearance_item_fulfillments_institutionalClear_idx" ON "institutional_clearance_item_fulfillments"("institutionalClearanceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "institutional_clearance_item_fulfillments_institutionalClear_key" ON "institutional_clearance_item_fulfillments"("institutionalClearanceItemId", "signatoryRequirementId");

-- AddForeignKey
ALTER TABLE "institutional_clearance_item_fulfillments" ADD CONSTRAINT "institutional_clearance_item_fulfillments_institutionalClear_fkey" FOREIGN KEY ("institutionalClearanceItemId") REFERENCES "institutional_clearance_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_clearance_item_fulfillments" ADD CONSTRAINT "institutional_clearance_item_fulfillments_signatoryRequirement_fkey" FOREIGN KEY ("signatoryRequirementId") REFERENCES "signatory_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_clearance_item_fulfillments" ADD CONSTRAINT "institutional_clearance_item_fulfillments_officeVerifiedByUser_fkey" FOREIGN KEY ("officeVerifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
