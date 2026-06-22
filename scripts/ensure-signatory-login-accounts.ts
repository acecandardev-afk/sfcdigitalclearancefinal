/**
 * Create/update local login accounts for every active signatory.
 * Default password for all seeded signatory emails: test1234
 *
 * Run: npx tsx scripts/ensure-signatory-login-accounts.ts
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
  /* optional */
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEFAULT_PASSWORD = 'test1234';
const prisma = new PrismaClient();

async function ensureRole(userId: string, role: 'signatory') {
  const has = await prisma.userRole.findFirst({ where: { userId, role } });
  if (!has) {
    await prisma.userRole.create({ data: { userId, role } });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env');
    process.exit(1);
  }

  const rows = await prisma.signatory.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, department: true, position: true, userId: true },
  });

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let created = 0;
  let updated = 0;
  let linked = 0;
  let linkSkipped = 0;

  for (const s of rows) {
    const email = (s.email ?? '').trim().toLowerCase();
    if (!email) continue;

    let user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true, profile: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: hash,
          profile: {
            create: {
              email,
              fullName: s.name || email,
              course: s.department || 'Institutional',
              yearLevel: s.position || 'Signatory',
            },
          },
          roles: { create: [{ role: 'signatory' }] },
        },
        include: { roles: true, profile: true },
      });
      created++;
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      });
      await ensureRole(user.id, 'signatory');
      if (user.profile) {
        await prisma.profile.update({
          where: { id: user.id },
          data: {
            fullName: user.profile.fullName || s.name || email,
            course: user.profile.course || s.department || 'Institutional',
            yearLevel: user.profile.yearLevel || s.position || 'Signatory',
          },
        });
      } else {
        await prisma.profile.create({
          data: {
            id: user.id,
            email,
            fullName: s.name || email,
            course: s.department || 'Institutional',
            yearLevel: s.position || 'Signatory',
          },
        });
      }
      updated++;
    }

    if (s.userId !== user.id) {
      const alreadyLinked = await prisma.signatory.findFirst({
        where: { userId: user.id, NOT: { id: s.id } },
        select: { id: true },
      });
      if (alreadyLinked) {
        linkSkipped++;
      } else {
        await prisma.signatory.update({
          where: { id: s.id },
          data: { userId: user.id },
        });
        linked++;
      }
    }
  }

  console.log(
    `Signatory login accounts ready. Created: ${created}, Updated: ${updated}, Linked: ${linked}, LinkSkipped: ${linkSkipped}`
  );
  console.log(`Default password for seeded signatory emails: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

