/**
 * Create or update a superadmin user in Postgres (Prisma).
 *
 * Set in .env (or export before running):
 *   DATABASE_URL=postgresql://...
 *   SEED_ADMIN_EMAIL=you@school.edu
 *   SEED_ADMIN_PASSWORD=min6chars
 *   SEED_ADMIN_FULL_NAME=Administrator   (optional)
 *
 * Run: npx prisma db seed   OR   npm run seed:admin
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env');
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  /* optional .env */
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  const fullName = (process.env.SEED_ADMIN_FULL_NAME || 'Administrator').trim() || 'Administrator';

  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Add your Postgres URL to .env');
    process.exit(1);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Set SEED_ADMIN_EMAIL to a valid email in .env');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Set SEED_ADMIN_PASSWORD to at least 6 characters in .env');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            email,
            fullName,
          },
        },
        roles: {
          create: [{ role: 'superadmin' }],
        },
      },
    });
    console.log(`Created superadmin: ${email}`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  const hasSuperadmin = existing.roles.some((r) => r.role === 'superadmin');
  if (!hasSuperadmin) {
    await prisma.userRole.create({
      data: { userId: existing.id, role: 'superadmin' },
    });
  }

  await prisma.profile.upsert({
    where: { id: existing.id },
    create: {
      id: existing.id,
      email,
      fullName,
    },
    update: {
      email,
      fullName,
    },
  });

  console.log(`Updated superadmin (password + profile; superadmin role ensured): ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
