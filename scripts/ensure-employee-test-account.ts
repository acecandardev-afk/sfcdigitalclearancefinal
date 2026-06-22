/**
 * Create or update a test employee (institutional): employee@test.com / test1234
 * Run: npx tsx scripts/ensure-employee-test-account.ts
 *
 * Uses employee role so /auth/employee lands on requester institutional dashboard.
 * Needs DATABASE_URL in .env
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
  /* */
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const EMAIL = 'employee@test.com';
const PASSWORD = 'test1234';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env');
    process.exit(1);
  }

  const email = EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: true, profile: true },
  });

  if (existing?.roles.some((r) => r.role === 'superadmin')) {
    console.error('Refusing: this email is a superadmin. Use a different test email.');
    process.exit(1);
  }

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            email,
            fullName: 'Test Employee',
            course: 'Office of the Registrar',
            yearLevel: 'Administrative Assistant II',
          },
        },
        roles: { create: [{ role: 'employee' }] },
      },
    });
    console.log(`Created ${email} (password: ${PASSWORD}) — employee role (institutional requester path)`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  if (!existing.roles.some((r) => r.role === 'employee')) {
    await prisma.userRole.create({ data: { userId: existing.id, role: 'employee' } });
  }
  if (existing.roles.some((r) => r.role === 'signatory')) {
    await prisma.userRole.deleteMany({ where: { userId: existing.id, role: 'signatory' } });
  }

  if (existing.roles.some((r) => r.role === 'student')) {
    console.warn(
      'Note: user also has student role. After sign-in, behavior depends on role logic; signatory still allows institutional.',
    );
  }

  if (!existing.profile) {
    await prisma.profile.create({
      data: {
        id: existing.id,
        email,
        fullName: 'Test Employee',
        course: 'Office of the Registrar',
        yearLevel: 'Administrative Assistant II',
      },
    });
  } else {
    await prisma.profile.update({
      where: { id: existing.id },
      data: {
        email: existing.profile.email || email,
        fullName: existing.profile.fullName || 'Test Employee',
        course: existing.profile.course || 'Office of the Registrar',
        yearLevel: existing.profile.yearLevel || 'Administrative Assistant II',
      },
    });
  }

  console.log(`Updated ${email} (password: ${PASSWORD}) — employee role ensured for institutional login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
