-- Official clearance window (superadmin-editable; students read via RLS SELECT)
INSERT INTO public.system_settings (key, value_json)
VALUES (
  'clearance',
  '{"period_start": null, "period_end": null}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
