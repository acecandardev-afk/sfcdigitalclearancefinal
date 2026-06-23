# Prints Vercel environment variable names to set (values come from your .env + Vercel dashboard).
Write-Host @"

Vercel → Project → Settings → Environment Variables (Production + Preview)

Required:
  DATABASE_URL          Same Neon pooled URL as local .env (prefix: DATABASE, not STORAGE)
  NEXTAUTH_SECRET       Copy from local .env NEXTAUTH_SECRET
  CLEARANCE_VERIFY_SECRET  Copy from local .env CLEARANCE_VERIFY_SECRET
  NEXTAUTH_URL          https://YOUR-PROJECT.vercel.app  (no trailing slash)
  BLOB_READ_WRITE_TOKEN Vercel → Storage → Blob → link store to project

After saving env vars:
  1. Deployments → Redeploy (latest)
  2. Open https://YOUR-PROJECT.vercel.app/api/health/ready  → database: ok
  3. Log in with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (after npm run seed locally)

If you connected Neon in Vercel, ensure the variable is DATABASE_URL, not STORAGE_URL.

"@
