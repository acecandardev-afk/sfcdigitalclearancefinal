# Apply migrations + seed using DATABASE_URL from .env (run from project root).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path .env)) {
  Write-Error "Missing .env — copy .env.example and set DATABASE_URL, NEXTAUTH_SECRET, and SEED_* values."
}

Write-Host "Checking database connection..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Seeding database..."
npm run seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Verify: npm run dev then open http://localhost:3000/api/health/ready"
Write-Host "Login with SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from your .env file."
