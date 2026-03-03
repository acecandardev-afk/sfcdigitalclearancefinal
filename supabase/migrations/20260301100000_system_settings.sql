-- Single-row system settings (superadmin-editable)
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Superadmins can do everything
CREATE POLICY "Superadmins can manage system_settings"
  ON public.system_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Authenticated users can read (e.g. students check allow_multiple_clearances)
CREATE POLICY "Authenticated can read system_settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role / anon read for public keys (e.g. system name for emails) - optional: we can restrict to superadmin only and have edge functions use service role
CREATE INDEX idx_system_settings_key ON public.system_settings (key);

-- Seed default row(s) via app or one default document
INSERT INTO public.system_settings (key, value_json)
VALUES (
  'general',
  '{
    "system_name": "SFC-G DCS",
    "institution_name": "Saint Francis College - Guihulngan",
    "admin_email": "admin@sfc-g.edu.ph"
  }'::jsonb
), (
  'notifications',
  '{
    "email_notifications": true,
    "notify_on_submission": true,
    "notify_on_approval": true,
    "notify_on_rejection": true
  }'::jsonb
), (
  'security',
  '{
    "require_all_signatures": true,
    "allow_multiple_clearances": false,
    "auto_approve_after_days": null
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
