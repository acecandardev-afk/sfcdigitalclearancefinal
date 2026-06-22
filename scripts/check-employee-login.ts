import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.CHECK_EMPLOYEE_EMAIL || 'employee@test.com').trim().toLowerCase();
  const password = process.env.CHECK_EMPLOYEE_PASSWORD || '';
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: true, profile: true },
  });

  console.log(
    JSON.stringify(
      {
        exists: Boolean(user),
        email: user?.email ?? null,
        roles: user?.roles.map((r) => r.role) ?? [],
        hasProfile: Boolean(user?.profile),
      },
      null,
      2
    )
  );

  if (user && password) {
    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log(`passwordMatch: ${ok}`);
  } else if (user) {
    console.log('passwordMatch: skipped (set CHECK_EMPLOYEE_PASSWORD to verify)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

