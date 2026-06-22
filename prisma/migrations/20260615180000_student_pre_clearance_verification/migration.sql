-- CreateEnum
CREATE TYPE "PreClearanceGate" AS ENUM ('faculty', 'cmo', 'guidance');

-- CreateTable
CREATE TABLE "student_pre_clearance_verifications" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gate" "PreClearanceGate" NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedByUserId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "student_pre_clearance_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_pre_clearance_verifications_studentId_idx" ON "student_pre_clearance_verifications"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_pre_clearance_verifications_studentId_gate_key" ON "student_pre_clearance_verifications"("studentId", "gate");

-- AddForeignKey
ALTER TABLE "student_pre_clearance_verifications" ADD CONSTRAINT "student_pre_clearance_verifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_pre_clearance_verifications" ADD CONSTRAINT "student_pre_clearance_verifications_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
