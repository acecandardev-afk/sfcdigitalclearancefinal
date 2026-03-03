-- Table: admin-assigned default signatories for all clearance requests.
-- Students cannot choose signatories; admin sets this list and order.
CREATE TABLE public.clearance_default_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signatory_id UUID NOT NULL REFERENCES public.signatories(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (signatory_id)
);

CREATE INDEX idx_clearance_default_signatories_order
  ON public.clearance_default_signatories (sequence_order);

ALTER TABLE public.clearance_default_signatories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (students need it when creating clearance)
CREATE POLICY "Authenticated can view default signatories"
  ON public.clearance_default_signatories
  FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmins can manage
CREATE POLICY "Superadmins can manage default signatories"
  ON public.clearance_default_signatories
  FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
