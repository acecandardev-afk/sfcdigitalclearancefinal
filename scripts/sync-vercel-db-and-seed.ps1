# Pull production DATABASE_URL from Vercel, update .env, migrate + seed (one-time Vercel login required).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "Checking Vercel CLI login..."
$whoami = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Not logged in. Run:  vercel login"
  Write-Host "Then run this script again."
  exit 1
}

if (-not (Test-Path .vercel/project.json)) {
  Write-Host "Linking project (choose sfcdigitalclearancefinal)..."
  vercel link --yes 2>&1
}

$pullFile = ".env.vercel.production"
Write-Host "Pulling production env from Vercel..."
vercel env pull $pullFile --environment=production --yes
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$lines = Get-Content $pullFile
$dbLine = $lines | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $dbLine) {
  Write-Error "DATABASE_URL not found in $pullFile. In Vercel, connect Neon with prefix DATABASE (not STORAGE)."
}

Write-Host "Updating .env DATABASE_URL from Vercel..."
$envText = Get-Content .env -Raw
if ($envText -match '(?m)^DATABASE_URL=.*$') {
  $envText = $envText -replace '(?m)^DATABASE_URL=.*$', $dbLine.Trim()
} else {
  $envText = "DATABASE_URL=$($dbLine -replace '^\s*DATABASE_URL\s*=\s*','')`n" + $envText
}
Set-Content -Path .env -Value $envText.TrimEnd() -NoNewline
Add-Content -Path .env -Value ""

Write-Host "Running migrate deploy + seed against live (Vercel) database..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Production database seeded. Redeploy on Vercel if you changed env vars."
Write-Host "Login: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from .env"
