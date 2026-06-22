-- AlterTable
ALTER TABLE "clearance_period_extensions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "signatory_requirements" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "clearance_requirement_fulfillments_clearanceSignatureId_signato" RENAME TO "clearance_requirement_fulfillments_clearanceSignatureId_sig_key";
