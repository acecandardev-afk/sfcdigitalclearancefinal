# E-CLEAR SFCG — Digital Clearance System

A modern web application for managing academic clearance at Saint Francis College — Guihulngan. Students submit clearance requests; signatories approve in sequence. Administrators create student and signatory accounts and assign the default signatory order.

## Features

- **Roles**: Student, Signatory, Superadmin
- **Students**: Sign in (accounts created by admin), submit clearance requests with documents, view status. Signatories are assigned by the administrator.
- **Signatories**: View pending requests, approve or reject in sequence, add remarks.
- **Superadmin**: Create student and signatory accounts, manage signatories, set default signatory order, bulk assign signatories by course/year, manage user roles, view activity logs, and configure system settings.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI (shadcn/ui), React Router, React Hook Form, Zod
- **Backend**: Supabase (Auth, Postgres, Storage, Edge Functions, Realtime)
- **Icons**: Lucide React

---

## How to run the system

### Prerequisites

- **Node.js** 18 or newer
- **npm** (or pnpm)
- A **Supabase** project (free tier is fine)
- **Supabase CLI** (optional, for pushing migrations from your machine)

### Step 1: Install dependencies

```bash
cd "digital clearance"
npm install
```

### Step 2: Environment variables

Copy the example file and fill in your values:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Where to find it |
|----------|------------------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same page → **anon** / **publishable** public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → **service_role** (secret; only for seed scripts, never expose in frontend) |

Restart the dev server after changing `.env`.

### Step 3: Apply database migrations

Migrations live in `supabase/migrations/`. Apply them to your Supabase project:

**Option A — Supabase CLI (recommended)**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**Option B — Supabase Dashboard**

Open **SQL Editor**, run each migration file in **filename order** (oldest first).

Key tables include: `profiles`, `user_roles`, `signatories`, `clearance_requests`, `clearance_files`, `clearance_signatures`, `clearance_default_signatories`, `student_signatory_assignments`, `notifications`, `activity_logs`, `system_settings`.

### Step 4: Seed signatories (recommended)

After migrations, populate the Standard and Authority signatory groups:

```bash
npm run seed:signatories
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

### Step 5: Start the development server

```bash
npm run dev
```

Open the app in your browser:

**http://localhost:8080**

(Vite is configured to use port `8080`; if it is busy, the terminal will show another port.)

### Step 6: First-time administrator

1. In **Supabase Dashboard → Authentication**, create a user (or use **Sign up** if enabled).
2. Ensure a row exists in `public.profiles` for that user (often created automatically by a trigger).
3. In **Table Editor** or **SQL**, insert into `public.user_roles`: `user_id` = that user’s UUID, `role` = `superadmin`.
4. Sign in at `http://localhost:8080`, then:
   - **Signatories**: Review signatories (after seed) and **Default signatory order** as needed.
   - **Students**: Create student accounts (requires deployed Edge Function `create-student-account` or equivalent).
   - **Bulk Assign** (optional): Assign signatories to students by course/year.
   - **Settings**: General, notifications, security.

### Optional: Edge functions

Deploy these from the project root if you use admin-created accounts and email notifications:

```bash
npx supabase functions deploy create-signatory-account
npx supabase functions deploy create-student-account
npx supabase functions deploy notify-signatories
```

For `notify-signatories`, add `RESEND_API_KEY` in Supabase **Edge Functions** secrets.

### Optional: Full test data seed

Creates sample admin, students, and clearances (development only):

```bash
npm run seed
```

Requires `SUPABASE_SERVICE_ROLE_KEY`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (default **http://localhost:8080**) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run seed:signatories` | Seed Standard + Authority signatories and default order |
| `npm run seed` | Seed test users and sample clearances (dev) |

---

## Production build

```bash
npm run build
```

Serve the `dist/` folder with any static host (or behind a reverse proxy). Set the same `VITE_*` environment variables at build time so the client points to your Supabase project.

---

## License

All rights reserved.
