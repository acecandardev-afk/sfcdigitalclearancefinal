import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const BodySchema = z.object({
  roles: z.array(z.enum(['student', 'signatory', 'superadmin'])).max(3),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const unique = [...new Set(parsed.data.roles)];

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({
      data: unique.map((role) => ({ userId, role: role as any })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
