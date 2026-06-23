import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'sfcadmin@school.edu').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'test123';
  const p = new PrismaClient();
  const host = process.env.DATABASE_URL?.match(/@([^/]+)/)?.[1] ?? 'unknown';

  const u = await p.user.findUnique({
    where: { email },
    include: { roles: true, profile: true },
  });

  if (!u) {
    console.log(JSON.stringify({ host, user: email, status: 'USER_NOT_FOUND' }));
    await p.$disconnect();
    process.exit(1);
  }

  const passwordOk = await bcrypt.compare(password, u.passwordHash);
  console.log(
    JSON.stringify({
      host,
      user: email,
      status: passwordOk ? 'OK' : 'WRONG_PASSWORD',
      roles: u.roles.map((r) => r.role),
      archived: u.profile?.isArchived ?? false,
    })
  );
  await p.$disconnect();
  process.exit(passwordOk ? 0 : 1);
}

main().catch((e) => {
  console.error('DB_ERROR', e instanceof Error ? e.message : e);
  process.exit(2);
});
