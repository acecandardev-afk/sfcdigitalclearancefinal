/**
 * Ensure local NextAuth/Prisma login for signatory1@gmail.com with password test1234.
 * Run: npx tsx scripts/ensure-signatory1-local-account.ts
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

const prisma = new PrismaClient();
const EMAIL = 'signatory1@gmail.com';
const PASSWORD = 'test1234';

async function main() {
  const email = EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: true, profile: true },
  });

  let userId: string;
  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            email,
            fullName: 'Signatory One',
            course: 'Institutional',
            yearLevel: 'Signatory',
          },
        },
        roles: { create: [{ role: 'signatory' }] },
      },
      include: { profile: true, roles: true },
    });
    userId = created.id;
    console.log(`Created user ${email}`);
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });
    if (!existing.roles.some((r) => r.role === 'signatory')) {
      await prisma.userRole.create({ data: { userId: existing.id, role: 'signatory' } });
    }
    if (!existing.profile) {
      await prisma.profile.create({
        data: {
          id: existing.id,
          email,
          fullName: 'Signatory One',
          course: 'Institutional',
          yearLevel: 'Signatory',
        },
      });
    }
    userId = existing.id;
    console.log(`Updated user ${email}`);
  }

  const sig = await prisma.signatory.findFirst({
    where: { email },
    select: { id: true, userId: true, name: true },
  });
  if (sig && sig.userId !== userId) {
    const conflicting = await prisma.signatory.findFirst({
      where: { userId, NOT: { id: sig.id } },
      select: { id: true },
    });
    if (!conflicting) {
      await prisma.signatory.update({
        where: { id: sig.id },
        data: { userId },
      });
    }
  }

  console.log(`Ready: ${email} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

