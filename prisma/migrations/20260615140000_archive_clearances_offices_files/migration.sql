-- Archive instead of delete for clearance requests, office template rows, and institutional files.
ALTER TABLE "clearance_requests" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clearance_requests" ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "institutional_office_definitions" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "institutional_office_definitions" ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "institutional_clearance_files" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "institutional_clearance_files" ADD COLUMN "archivedAt" TIMESTAMP(3);
