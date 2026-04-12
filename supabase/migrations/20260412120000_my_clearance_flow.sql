-- Student "My Clearance" flow: per-step files + signatory checklist metadata

ALTER TABLE public.signatories
  ADD COLUMN IF NOT EXISTS display_schedule TEXT,
  ADD COLUMN IF NOT EXISTS request_requirements JSONB;

COMMENT ON COLUMN public.signatories.display_schedule IS 'Optional schedule line shown to students (e.g. office hours)';
COMMENT ON COLUMN public.signatories.request_requirements IS 'Optional JSON array: [{id:number,label:string,type:"checkbox"|"document"}]';

ALTER TABLE public.clearance_files
  ADD COLUMN IF NOT EXISTS clearance_signature_id UUID REFERENCES public.clearance_signatures(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clearance_files_signature ON public.clearance_files(clearance_signature_id);

-- Students may remove attachments when resubmitting a step
DROP POLICY IF EXISTS "Students can delete files on own requests" ON public.clearance_files;
CREATE POLICY "Students can delete files on own requests"
  ON public.clearance_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = clearance_files.clearance_request_id AND cr.student_id = auth.uid()
    )
  );

-- Students may update signature rows until a signatory has signed (resubmit / notes)
DROP POLICY IF EXISTS "Students can update unsigned signatures on own requests" ON public.clearance_signatures;
CREATE POLICY "Students can update unsigned signatures on own requests"
  ON public.clearance_signatures FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = clearance_signatures.clearance_request_id AND cr.student_id = auth.uid()
    )
    AND clearance_signatures.signed_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clearance_requests cr
      WHERE cr.id = clearance_signatures.clearance_request_id AND cr.student_id = auth.uid()
    )
    AND clearance_signatures.signed_at IS NULL
  );
