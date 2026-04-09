-- Data cleanup: Remove dummy data (run before seeding)
-- Order matters: clear dependent tables first

-- Clear clearance-related data
DELETE FROM public.clearance_signatures;
DELETE FROM public.clearance_files;
DELETE FROM public.clearance_requests;

-- Clear signatory assignments and default order
DELETE FROM public.student_signatory_assignments;
DELETE FROM public.clearance_default_signatories;

-- Clear signatories (dummy data - will be replaced by seeder)
DELETE FROM public.signatories;

-- Clear notifications for test users (optional - keeps system clean)
DELETE FROM public.notifications;

-- Note: profiles and user_roles are NOT deleted here.
-- Auth users (students, etc.) are managed via seed script or Supabase Dashboard.
-- To fully reset: run scripts/seed-signatories.ts after this migration.
