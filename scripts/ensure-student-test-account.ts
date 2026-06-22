/**
 * Create or update a test student: student@test.com / test1234
 * Run: npx tsx scripts/ensure-student-test-account.ts
 *
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

const EMAIL = 'student@test.com';
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
            fullName: 'Test Student',
            studentId: 'STU-TEST-001',
          },
        },
        roles: { create: [{ role: 'student' }] },
      },
    });
    console.log(`Created ${email} (password: ${PASSWORD}) — student role`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  if (!existing.roles.some((r) => r.role === 'student')) {
    await prisma.userRole.create({ data: { userId: existing.id, role: 'student' } });
  }

  if (!existing.profile) {
    await prisma.profile.create({
      data: {
        id: existing.id,
        email,
        fullName: 'Test Student',
        studentId: 'STU-TEST-001',
      },
    });
  } else {
    await prisma.profile.update({
      where: { id: existing.id },
      data: {
        email: existing.profile.email || email,
        fullName: existing.profile.fullName || 'Test Student',
        studentId: existing.profile.studentId || 'STU-TEST-001',
      },
    });
  }

  console.log(`Updated ${email} (password: ${PASSWORD}) — student role ensured`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
