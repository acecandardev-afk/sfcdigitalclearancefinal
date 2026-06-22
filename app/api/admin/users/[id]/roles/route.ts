import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { Role } from '@prisma/client';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const BodySchema = z.object({
  roles: z.array(z.nativeEnum(Role)).max(8),
});

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = ctx.params.id;
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const unique = [...new Set(parsed.data.roles)];

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({
      data: unique.map((role) => ({ userId, role })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
