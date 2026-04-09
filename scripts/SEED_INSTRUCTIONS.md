# Seed Test Users

Creates these test accounts:

| Role      | Email              | Password  |
|-----------|--------------------|-----------|
| Superadmin| sfcadmin@test.com  | test1234  |
| Signatory | signatory@test.com | test1234  |
| Student   | student@test.com   | test1234  |

## Option 1: Run the script (recommended)

1. Get your **Service Role Key** from Supabase Dashboard → Project Settings → API → `service_role` (secret).

2. Add to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. Run:
   ```bash
   npm run seed
   ```

## Option 2: Create manually in Supabase Dashboard

1. Go to **Authentication** → **Users** → **Add user**
2. Create each user with email and password
3. For **sfcadmin@test.com**: In SQL Editor run:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'superadmin'::app_role FROM auth.users WHERE email = 'sfcadmin@test.com';
   DELETE FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sfcadmin@test.com') AND role = 'student';
   ```
4. For **signatory@test.com**: Create a signatory in Signatories page first, then use "Create account" with that email/password
5. For **student@test.com**: No extra steps; the trigger assigns the student role
