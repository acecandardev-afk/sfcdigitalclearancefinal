-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'signatory', 'superadmin');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('pending', 'in_progress', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('pending', 'in_progress', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "SignatoryGroup" AS ENUM ('standard', 'authority');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "fullName" TEXT,
    "studentId" TEXT,
    "yearLevel" TEXT,
    "course" TEXT,
    "address" TEXT,
    "age" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "signatoryGroup" "SignatoryGroup" NOT NULL DEFAULT 'standard',
    "authoritySequenceOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clearance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_signatures" (
    "id" TEXT NOT NULL,
    "clearanceRequestId" TEXT NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "remarks" TEXT,
    "sequenceOrder" INTEGER NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signatoryGroup" "SignatoryGroup" NOT NULL DEFAULT 'standard',
    "authoritySequenceOrder" INTEGER,

    CONSTRAINT "clearance_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_files" (
    "id" TEXT NOT NULL,
    "clearanceRequestId" TEXT NOT NULL,
    "signatureId" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "blobUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clearance_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_default_signatories" (
    "id" TEXT NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,

    CONSTRAINT "clearance_default_signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_signatory_assignments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "signatoryGroup" "SignatoryGroup" NOT NULL DEFAULT 'standard',

    CONSTRAINT "student_signatory_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_clearance_step_notes" (
    "id" TEXT NOT NULL,
    "clearanceRequestId" TEXT NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_clearance_step_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "signatories_userId_key" ON "signatories"("userId");

-- CreateIndex
CREATE INDEX "clearance_signatures_clearanceRequestId_idx" ON "clearance_signatures"("clearanceRequestId");

-- CreateIndex
CREATE INDEX "clearance_signatures_signatoryId_idx" ON "clearance_signatures"("signatoryId");

-- CreateIndex
CREATE INDEX "clearance_files_clearanceRequestId_idx" ON "clearance_files"("clearanceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_default_signatories_signatoryId_key" ON "clearance_default_signatories"("signatoryId");

-- CreateIndex
CREATE UNIQUE INDEX "student_signatory_assignments_studentId_signatoryId_key" ON "student_signatory_assignments"("studentId", "signatoryId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_clearance_step_notes_clearanceRequestId_signatoryId_key" ON "student_clearance_step_notes"("clearanceRequestId", "signatoryId");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatories" ADD CONSTRAINT "signatories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_requests" ADD CONSTRAINT "clearance_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_signatures" ADD CONSTRAINT "clearance_signatures_clearanceRequestId_fkey" FOREIGN KEY ("clearanceRequestId") REFERENCES "clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_signatures" ADD CONSTRAINT "clearance_signatures_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "signatories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_files" ADD CONSTRAINT "clearance_files_clearanceRequestId_fkey" FOREIGN KEY ("clearanceRequestId") REFERENCES "clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_default_signatories" ADD CONSTRAINT "clearance_default_signatories_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "signatories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_signatory_assignments" ADD CONSTRAINT "student_signatory_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_signatory_assignments" ADD CONSTRAINT "student_signatory_assignments_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "signatories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_clearance_step_notes" ADD CONSTRAINT "student_clearance_step_notes_clearanceRequestId_fkey" FOREIGN KEY ("clearanceRequestId") REFERENCES "clearance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_clearance_step_notes" ADD CONSTRAINT "student_clearance_step_notes_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "signatories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
