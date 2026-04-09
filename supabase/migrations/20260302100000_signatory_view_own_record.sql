-- Allow signatories to view their own signatory record (needed for RLS on clearance_requests)
CREATE POLICY "Signatories can view own record"
ON public.signatories
FOR SELECT
USING (user_id = auth.uid());

-- Allow signatories to view ALL signatures for requests they're assigned to (not just their own)
-- Needed for SignatoryClearanceDetail to show full timeline; avoids recursion via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.signatory_assigned_to_request(req_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clearance_signatures cs
    JOIN public.signatories s ON cs.signatory_id = s.id
    WHERE cs.clearance_request_id = req_id AND s.user_id = auth.uid()
  );
$$;

CREATE POLICY "Signatories can view signatures for assigned requests"
ON public.clearance_signatures
FOR SELECT
USING (public.signatory_assigned_to_request(clearance_request_id));
