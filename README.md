# SFC-G Digital Clearance System

A modern web application for managing academic clearance at Saint Francis College — Guihulngan. Students submit clearance requests; signatories approve in sequence. Administrators create student and signatory accounts and assign the default signatory order.

## Features

- **Roles**: Student, Signatory, Superadmin
- **Students**: Sign in (accounts created by admin), submit clearance requests with documents, view status. Signatories are assigned by the administrator; students cannot choose them.
- **Signatories**: View pending requests, approve or reject in sequence, add remarks.
- **Superadmin**: Create student and signatory accounts, manage signatories, set default signatory order for clearances, manage user roles, view activity logs, and configure system settings (general, notifications, security).

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI (shadcn/ui), React Router, React Hook Form, Zod
- **Backend**: Supabase (Auth, Postgres, Storage, Edge Functions, Realtime)
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase project

## Setup

### 1. Clone and install

```bash
cd "digital clearance"
npm install
```

### 2. Environment variables

Create `.env` in the project root (see `.env.example` if present). Required:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database migrations

Apply Supabase migrations in order (via Supabase CLI or Dashboard SQL editor):

- Run all SQL files in `supabase/migrations/` in chronological order (by filename prefix).

Key tables: `profiles`, `user_roles`, `signatories`, `clearance_requests`, `clearance_files`, `clearance_signatures`, `clearance_default_signatories`, `notifications`, `activity_logs`, `system_settings`.

### 4. Edge functions (optional but recommended)

- **create-signatory-account**: Superadmin creates signatory login (invoked from Signatories page).
- **create-student-account**: Superadmin creates student account (invoked from Students page).
- **notify-signatories**: Sends email to signatories when a student submits a clearance. Requires `RESEND_API_KEY` in Supabase Edge Function secrets.

Deploy with Supabase CLI:

```bash
supabase functions deploy create-signatory-account
supabase functions deploy create-student-account
supabase functions deploy notify-signatories
```

### 5. Run locally

```bash
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173`).

## First-time admin setup

1. Create a Supabase user (e.g. via Dashboard Auth or `signUp`) and ensure a row in `profiles` exists (trigger may create it).
2. In Supabase SQL editor or Table Editor, add a `user_roles` row: `user_id` = your user id, `role` = `superadmin`.
3. Sign in; go to **Signatories** and add signatories, then set **Default signatory order** for clearances.
4. Create student accounts from **Students**.
5. Configure **Settings** (General, Notifications, Security) as needed.

## Scripts

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build
- `npm run lint` — Run ESLint

## License

All rights reserved.
