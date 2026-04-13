import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const PatchSchema = z.object({
  sequence_order: z.number().int().min(1).optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.clearanceDefaultSignatory.update({
    where: { id: ctx.params.id },
    data: {
      ...(parsed.data.sequence_order != null
        ? { sequenceOrder: parsed.data.sequence_order }
        : {}),
    },
  });

  return NextResponse.json({ id: updated.id, sequence_order: updated.sequenceOrder });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.clearanceDefaultSignatory.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ success: true });
}
