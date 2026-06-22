-- Employee institutional clearance: Section I + Section IV; fixed office table items use signatoryId NULL
ALTER TABLE "institutional_clearance" ADD COLUMN IF NOT EXISTS "employeeType" TEXT;
ALTER TABLE "institutional_clearance" ADD COLUMN IF NOT EXISTS "dateOfSeparation" TIMESTAMP(3);
ALTER TABLE "institutional_clearance" ADD COLUMN IF NOT EXISTS "reasonCategory" TEXT;
ALTER TABLE "institutional_clearance" ADD COLUMN IF NOT EXISTS "reasonOtherDetails" TEXT;
ALTER TABLE "institutional_clearance" ADD COLUMN IF NOT EXISTS "finalClearanceStatus" TEXT;
ALTER TABLE "institutional_clearance" ADD COLUMN IF NOT EXISTS "finalClearanceRemarks" TEXT;

UPDATE "institutional_clearance" SET "employeeType" = 'teaching' WHERE "employeeType" IS NULL;
UPDATE "institutional_clearance" SET "dateOfSeparation" = "createdAt" WHERE "dateOfSeparation" IS NULL;
UPDATE "institutional_clearance" SET "reasonCategory" = 'resignation' WHERE "reasonCategory" IS NULL;
