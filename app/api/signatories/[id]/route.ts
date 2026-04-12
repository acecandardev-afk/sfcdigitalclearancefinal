import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.string().min(1).max(100).optional(),
  department: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const id = ctx.params.id;
  const s = parsed.data;

  const updated = await prisma.signatory.update({
    where: { id },
    data: {
      ...(s.name != null ? { name: s.name } : {}),
      ...(s.position != null ? { position: s.position } : {}),
      ...(s.department != null ? { department: s.department } : {}),
      ...(s.email != null ? { email: s.email.toLowerCase() } : {}),
      ...(s.is_active != null ? { isActive: s.is_active } : {}),
    },
  });

  return NextResponse.json({ signatory: updated });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = ctx.params.id;
  await prisma.signatory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
