-- AlterTable
ALTER TABLE "institutional_clearance_items" ADD COLUMN     "signatoryId" TEXT;

-- CreateIndex
CREATE INDEX "institutional_clearance_items_signatoryId_idx" ON "institutional_clearance_items"("signatoryId");

-- AddForeignKey
ALTER TABLE "institutional_clearance_items" ADD CONSTRAINT "institutional_clearance_items_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "signatories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
