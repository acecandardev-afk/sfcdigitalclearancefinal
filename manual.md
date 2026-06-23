# System Run Manual

Run all commands from the project root:

```powershell
cd "C:\xampp\htdocs\digital clearance"
```

## 1. Install Requirements

Install Node.js 18 or newer, then install project packages:

```powershell
npm install
```

## 2. Create `.env`

Create a `.env` file in the project root. Minimum required values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
CLEARANCE_VERIFY_SECRET="replace-with-a-long-random-secret"
```

Required for seeding the first superadmin:

```env
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="change-this-password"
SEED_ADMIN_FULL_NAME="Administrator"
```

Optional if you use Vercel Blob uploads:

```env
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"
```

If `BLOB_READ_WRITE_TOKEN` is not set, uploads are saved locally under `public/uploads`. **On Vercel, Blob is required** (the filesystem is read-only).

## Deploy to Vercel

1. Push the repo to GitHub (or GitLab / Bitbucket).
2. In [Vercel](https://vercel.com), **Add New Project** → import the repository.
3. Framework preset: **Next.js** (auto-detected). Build command: `npm run build`.
4. Add **Environment variables** (Production + Preview):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** connection string (`?sslmode=require`) |
| `NEXTAUTH_SECRET` | Long random string (`openssl rand -base64 32`) |
| `CLEARANCE_VERIFY_SECRET` | Same as or separate from `NEXTAUTH_SECRET` |
| `BOOTSTRAP_SECRET` | Optional: one-time create first admin via POST `/api/admin/bootstrap` if DB is empty |
| `BLOB_READ_WRITE_TOKEN` | From Vercel → Storage → Blob (link store to project) |
| `NEXTAUTH_URL` | Production only: `https://your-project.vercel.app` |

Preview deployments can omit `NEXTAUTH_URL`; the app falls back to `https://${VERCEL_URL}`.

5. **Before first deploy**, apply migrations to the production database (from your machine or CI):

```powershell
npx prisma migrate deploy
npm run seed
```

6. Deploy. After deploy, open `/api/health/ready` — it should return `{ "status": "ready", "database": "ok" }`.

**Notes**

- Use a Neon **pooler** URL for `DATABASE_URL` on serverless.
- Hobby plan limits function duration to 10s; bulk clearance submit may need **Pro** (this project sets up to 60s for heavy routes in `vercel.json`).
- Do not commit `.env`; use `.env.example` as the template.

## 3. Prepare Database

Generate Prisma client:

```powershell
npx prisma generate
```

Apply migrations:

```powershell
npx prisma migrate deploy
```

Seed default users, signatories, office requirements, and institutional offices:

```powershell
npm run seed
```

## 4. Run in Development

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## 5. Run in Production Mode

Build:

```powershell
npm run build
```

Start:

```powershell
npm run start
```

## 6. Validate Before Deployment

Run these checks:

```powershell
npx prisma validate
npm run lint
npm run test
npm run build
npm audit --omit=dev --audit-level=high
```

## 7. Useful Maintenance Commands

Open Prisma Studio:

```powershell
npm run prisma:studio
```

Check migration status:

```powershell
npx prisma migrate status
```

Reset a development database only:

```powershell
npm run prisma:migrate:fresh
```

Do not run the reset command on production or any database with real data.

________________________________________________________________________________



npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
npm run start


CHECKS 

npx prisma validate
npm run lint
npm run test
npm run build
npm audit --omit=dev --audit-level=high


________________________________________________________________________________________

FRESH MIGRATE

cd "C:\xampp\htdocs\digital clearance"
npm run prisma:migrate:fresh

npx prisma generate
npm run dev

npm run seed