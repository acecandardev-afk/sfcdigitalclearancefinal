# Tech Stack — Digital Clearance

Full list of technologies used in this project.

---

## Core platform

| Technology | Role |
|------------|------|
| **Node.js 18+** | Runtime |
| **TypeScript 5** | Language |
| **Next.js 14** | App server, API routes (`app/api/`), production build (`standalone`) |
| **React 18** | Frontend UI |
| **React Router DOM 6** | Client-side routing (`src/`) |

---

## Database & ORM

| Technology | Role |
|------------|------|
| **PostgreSQL** | Database (via `DATABASE_URL`, e.g. Neon) |
| **Prisma 6** | ORM, migrations, seeding, Prisma Studio |
| **bcryptjs** | Password hashing |

---

## Authentication & security

| Technology | Role |
|------------|------|
| **NextAuth.js v4** | Session/auth (`/api/auth/[...nextauth]`) |
| **Next.js middleware** | Rate limiting on login attempts |
| **Custom RBAC** | Roles/permissions (`permissionsMatrix`, `apiAuth`) |

---

## UI & styling

| Technology | Role |
|------------|------|
| **Tailwind CSS 3** | Styling |
| **shadcn/ui** | Component system |
| **Radix UI** | Accessible primitives (dialogs, selects, tabs, etc.) |
| **Lucide React** | Icons |
| **Sonner** | Toast notifications |
| **next-themes** | Theme support |
| **class-variance-authority**, **clsx**, **tailwind-merge** | Utility class handling |
| **tailwindcss-animate** | Animations |

---

## Forms, validation & data

| Technology | Role |
|------------|------|
| **React Hook Form** | Forms |
| **Zod** | Schema validation (API + forms) |
| **@hookform/resolvers** | Zod + RHF integration |
| **@tanstack/react-query** | Server state / fetching |
| **date-fns** | Dates |
| **xlsx (SheetJS)** | CSV/Excel student bulk import |

---

## UI extras

| Technology | Role |
|------------|------|
| **@dnd-kit** | Drag-and-drop (e.g. signatory order) |
| **Recharts** | Charts/reports |
| **html2canvas** + **jsPDF** | PDF/export from HTML |
| **react-day-picker** | Date picker |
| **embla-carousel-react** | Carousels |
| **vaul** | Drawer component |
| **cmdk** | Command palette |
| **input-otp** | OTP inputs |

---

## File storage & email

| Technology | Role |
|------------|------|
| **Vercel Blob** | Cloud file uploads (optional) |
| **Local `public/uploads`** | Fallback when Blob token not set |
| **Nodemailer** | Email sending |

---

## API & backend utilities

| Technology | Role |
|------------|------|
| **Next.js Route Handlers** | REST API (`app/api/**`) |
| **Custom server modules** | `src/server/` (db, audit log, archive safeguards, email adapter) |
| **Vitest** | Unit tests |
| **tsx** | Running TypeScript seeds/scripts |

---

## Dev tooling

| Technology | Role |
|------------|------|
| **ESLint 9** + **typescript-eslint** | Linting |
| **PostCSS** + **Autoprefixer** | CSS processing |
| **Vite 5** | Legacy/alternate dev build (`dev:vite`, `build:vite`) — main flow uses Next |

---

## Legacy / optional integrations

| Technology | Role |
|------------|------|
| **Supabase JS** | Legacy path (`seed:supabase`, Supabase functions in `supabase/`) |
| **Supabase Edge Functions** | Older auth/notify scripts (not main stack today) |

---

## Infrastructure / deployment

| Item | Notes |
|------|--------|
| **Next.js `standalone` output** | Docker/server deployment |
| **Security headers** | X-Frame-Options, CSP-related headers in `next.config.mjs` |
| **Environment variables** | `.env` — DB, NextAuth, secrets, seed credentials |

---

## Summary

**Next.js 14 + React 18 + TypeScript + PostgreSQL (Prisma) + NextAuth + Tailwind/shadcn/ui**, with optional **Vercel Blob**, **Nodemailer**, and **xlsx** for imports — tested with **Vitest**, seeded via **Prisma + tsx**.
