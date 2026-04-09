-- Add is_archived to profiles for student archiving
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
