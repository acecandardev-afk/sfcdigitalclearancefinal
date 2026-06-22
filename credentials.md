# Test Credentials

All passwords come from your `.env` file **before** you run `npm run seed` or `npm run prisma:migrate:fresh`.

Login URL (local dev): `http://localhost:3000`

---

## Superadmin

| Field    | Value |
|----------|--------|
| Email    | Value of `SEED_ADMIN_EMAIL` in `.env` |
| Password | Value of `SEED_ADMIN_PASSWORD` in `.env` (min. 6 characters) |
| Role     | Superadmin |

Example `.env`:

```env
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="change-this-password"
SEED_ADMIN_FULL_NAME="Administrator"
```

---

## Employee (institutional clearance)

| Field    | Value |
|----------|--------|
| Email    | `employee@test.com` (or `SEED_EMPLOYEE_EMAIL` in `.env`) |
| Password | `SEED_INSTITUTIONAL_PASSWORD`, or `SEED_STAFF_PASSWORD`, or `SEED_ADMIN_PASSWORD` — whichever is set |
| Role     | Employee |

Skipped if `SEED_EMPLOYEE_EMAIL` is the same as `SEED_ADMIN_EMAIL`.

---

## Student clearance signatories

15 accounts are created. All use the **same password**.

| Email | Password |
|-------|----------|
| `signatory1@gmail.com` | `SEED_SIGNATORY_PASSWORD`, or `SEED_STAFF_PASSWORD`, or `SEED_ADMIN_PASSWORD` |
| `signatory2@gmail.com` | same as above |
| … | … |
| `signatory15@gmail.com` | same as above |

Role: **Signatory** (student clearance queue)

---

## Institutional clearance signatories

21 accounts are created (one per office template row). All use the **same password** as student signatories above.

| Email | Password |
|-------|----------|
| `institutional1@gmail.com` | same signatory password chain as above |
| `institutional2@gmail.com` | same |
| … | … |
| `institutional21@gmail.com` | same |

Role: **Signatory** (institutional clearance queue)

> `institutional1@gmail.com` is linked to the **HRMDO** office row and has the `hrmdo` certification role.

---

## Optional `.env` password overrides

```env
SEED_STAFF_PASSWORD="shared-staff-password"
SEED_SIGNATORY_PASSWORD="signatory-password"
SEED_INSTITUTIONAL_PASSWORD="employee-password"
SEED_EMPLOYEE_EMAIL="employee@test.com"
```

Priority:

- **Signatories** (`signatory1…`, `institutional1…`): `SEED_SIGNATORY_PASSWORD` → `SEED_STAFF_PASSWORD` → `SEED_ADMIN_PASSWORD`
- **Employee**: `SEED_INSTITUTIONAL_PASSWORD` → `SEED_STAFF_PASSWORD` → `SEED_ADMIN_PASSWORD`

---

## Students

There is **no** default student account in the main seed (`prisma/seed.ts`). Students are created by:

- Superadmin / faculty admin on the **Students** page, or
- Bulk import (CSV/Excel)

Optional helper script:

```powershell
npm run seed:student
```

---

## Reseed / reset passwords

1. Update values in `.env`
2. Run:

```powershell
npm run prisma:migrate:fresh
```

Or seed only (without wiping):

```powershell
npm run seed
```

---

## Security note

Do **not** commit real production passwords. Keep `.env` out of git. This file documents **dev/test** accounts only.
