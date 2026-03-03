# Run Migrations Manually (Without CLI Link)

If `supabase link` fails, run migrations directly in the Supabase SQL Editor.

## Steps

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project
2. Open **SQL Editor**
3. Run each migration file **in this order** (copy-paste the contents):

| Order | File |
|-------|------|
| 1 | `20251207015820_5e9174b8-06d6-42f9-8a7b-f2e9ba9283c7.sql` |
| 2 | `20251207015828_02ed8659-042f-4e38-b4d7-8d12582be645.sql` |
| 3 | `20251209012530_31c73492-5542-4f27-8d5c-960729148c7d.sql` |
| 4 | `20251210013633_786b9ada-bd17-446f-a425-71f44c648b26.sql` |
| 5 | `20260103062429_b0ce83bf-0218-4f5d-8fb0-73ba2b71f8c6.sql` |
| 6 | `20260126125910_b2de981f-981c-4e20-b532-063468030e90.sql` |
| 7 | `20260129141844_5495be0f-0158-4a5e-8f36-93415f7d739c.sql` |
| 8 | `20260301000000_clearance_default_signatories.sql` |
| 9 | `20260301100000_system_settings.sql` |

4. After migrations, create your first admin:
   - Go to **Authentication** → **Users** → **Add user** (or sign up via your app)
   - Copy the user's UUID
   - In SQL Editor, run:
   ```sql
   INSERT INTO public.user_roles (user_id, role) 
   VALUES ('YOUR_USER_UUID_HERE', 'superadmin');
   ```

## Project Ref (for CLI)

Your project ref must be **exactly 20 characters**. Find it in:
- **Project Settings** → **General** → Reference ID
- Or the URL: `https://supabase.com/dashboard/project/[REF]`

If your ref is 22 chars (e.g. `onubccchgdcagucuqrvvy`), use the 20-char ref from the dashboard instead.
