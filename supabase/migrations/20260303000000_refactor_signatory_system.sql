-- Refactor: Signatory groups (standard/authority), student assignments, hybrid sequence logic
-- Part 1: Schema changes

-- Add signatory group and authority sequence to signatories
ALTER TABLE public.signatories
  ADD COLUMN IF NOT EXISTS signatory_group TEXT DEFAULT 'standard' CHECK (signatory_group IN ('standard', 'authority')),
  ADD COLUMN IF NOT EXISTS authority_sequence_order INTEGER;

COMMENT ON COLUMN public.signatories.signatory_group IS 'standard = flexible order, authority = strict sequence 1-5';
COMMENT ON COLUMN public.signatories.authority_sequence_order IS 'For authority group only: 1=Program Chair, 2=VPSA, 3=VPAA, 4=College Dean, 5=College President';

-- Student signatory assignments (per-student, replaces default for bulk-assigned students)
CREATE TABLE IF NOT EXISTS public.student_signatory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signatory_id UUID NOT NULL REFERENCES public.signatories(id) ON DELETE CASCADE,
  signatory_group TEXT NOT NULL DEFAULT 'standard' CHECK (signatory_group IN ('standard', 'authority')),
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (student_id, signatory_id)
);

CREATE INDEX idx_student_signatory_assignments_student ON public.student_signatory_assignments(student_id);
CREATE INDEX idx_student_signatory_assignments_signatory ON public.student_signatory_assignments(signatory_id);

ALTER TABLE public.student_signatory_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own assignments"
  ON public.student_signatory_assignments FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Superadmins can manage student signatory assignments"
  ON public.student_signatory_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Add signatory_group and authority_sequence_order to clearance_signatures for hybrid logic
ALTER TABLE public.clearance_signatures
  ADD COLUMN IF NOT EXISTS signatory_group TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS authority_sequence_order INTEGER;
