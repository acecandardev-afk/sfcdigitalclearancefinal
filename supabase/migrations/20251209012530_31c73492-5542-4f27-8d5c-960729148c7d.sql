-- Fix infinite recursion in clearance_signatures policies
-- The issue is policies on clearance_signatures reference clearance_requests which can cause loops

-- Drop problematic policies
DROP POLICY IF EXISTS "Students can view signatures for own requests" ON public.clearance_signatures;
DROP POLICY IF EXISTS "Signatories can view own signatures" ON public.clearance_signatures;

-- Create a security definer function to check if user owns the clearance request
CREATE OR REPLACE FUNCTION public.user_owns_clearance_request(request_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clearance_requests
    WHERE id = request_id AND student_id = auth.uid()
  );
$$;

-- Create a security definer function to check if user is the signatory
CREATE OR REPLACE FUNCTION public.user_is_signatory(sig_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM signatories
    WHERE id = sig_id AND user_id = auth.uid()
  );
$$;

-- Recreate policies using the security definer functions (avoids recursion)
CREATE POLICY "Students can view signatures for own requests"
ON public.clearance_signatures
FOR SELECT
USING (public.user_owns_clearance_request(clearance_request_id));

CREATE POLICY "Signatories can view own signatures"
ON public.clearance_signatures
FOR SELECT
USING (public.user_is_signatory(signatory_id));