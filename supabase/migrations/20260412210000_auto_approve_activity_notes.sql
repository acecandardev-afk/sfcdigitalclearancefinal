-- Students may read activity log rows tied to their own clearance (signatory approve/reject + own submits)
CREATE POLICY "Students can view clearance activity for own requests"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clearance_requests cr
      WHERE cr.student_id = auth.uid()
        AND cr.id::text = (activity_logs.details ->> 'clearance_request_id')
    )
    AND activity_logs.action IN ('sign_clearance', 'reject_clearance', 'update_clearance', 'create_clearance')
  );

-- Optional note per office step (visit preference / reschedule message to signatory)
CREATE TABLE IF NOT EXISTS public.student_clearance_step_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_request_id UUID NOT NULL REFERENCES public.clearance_requests (id) ON DELETE CASCADE,
  signatory_id UUID NOT NULL REFERENCES public.signatories (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clearance_request_id, signatory_id)
);

CREATE INDEX IF NOT EXISTS idx_step_notes_request ON public.student_clearance_step_notes (clearance_request_id);

ALTER TABLE public.student_clearance_step_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own step notes"
  ON public.student_clearance_step_notes
  FOR ALL
  TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = student_clearance_step_notes.clearance_request_id
        AND cr.student_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = student_clearance_step_notes.clearance_request_id
        AND cr.student_id = auth.uid()
    )
  );

CREATE POLICY "Signatories read notes for their office on assigned requests"
  ON public.student_clearance_step_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.signatories s
      JOIN public.clearance_signatures cs ON cs.signatory_id = s.id
      WHERE s.user_id = auth.uid()
        AND cs.clearance_request_id = student_clearance_step_notes.clearance_request_id
        AND cs.signatory_id = student_clearance_step_notes.signatory_id
    )
  );

CREATE POLICY "Superadmins full access step notes"
  ON public.student_clearance_step_notes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Auto-approve pending signatures older than N days (from system_settings.security)
CREATE OR REPLACE FUNCTION public.auto_approve_stale_clearance_signatures()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days_val int;
  updated_count int;
BEGIN
  SELECT COALESCE((value_json ->> 'auto_approve_after_days')::int, 0)
  INTO days_val
  FROM public.system_settings
  WHERE key = 'security';

  IF days_val IS NULL OR days_val <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.clearance_signatures cs
  SET
    status = 'approved',
    signed_at = COALESCE(cs.signed_at, now()),
    remarks =
      CASE
        WHEN cs.remarks IS NULL OR btrim(cs.remarks) = '' THEN
          'Auto-approved after ' || days_val || ' day(s) (system policy).'
        ELSE
          cs.remarks || E'\n' || 'Auto-approved after ' || days_val || ' day(s) (system policy).'
      END
  WHERE cs.status = 'pending'
    AND cs.created_at < (now() - (days_val::text || ' days')::interval);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_approve_stale_clearance_signatures () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_approve_stale_clearance_signatures () TO service_role;
