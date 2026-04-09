-- Allow superadmins to update any profile (e.g. archive/restore students)
CREATE POLICY "Superadmins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
