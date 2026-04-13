import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const unauthorized = () =>
  NextResponse.json(
    {
      error: 'Unauthorized',
      detail: 'Superadmin session required. Sign out and sign in again if this persists.',
    },
    { status: 401 }
  );

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.string().min(1).max(100).optional(),
  department: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) return unauthorized();

  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 400 });
  }

  const id = ctx.params.id;
  const s = parsed.data;

  try {
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
  } catch (e: unknown) {
    console.error('[PATCH /api/signatories/[id]]', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return NextResponse.json({ error: 'Not found', detail: 'No signatory with this id.' }, { status: 404 });
      }
      if (e.code === 'P2002') {
        const target = Array.isArray(e.meta?.target) ? (e.meta?.target as string[]).join(', ') : 'unique field';
        return NextResponse.json(
          {
            error: 'Duplicate value',
            detail: `Another record already uses this ${target}.`,
          },
          { status: 409 }
        );
      }
    }
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'Could not update signatory', detail: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) return unauthorized();

  const id = ctx.params.id;
  try {
    const existing = await prisma.signatory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found', detail: 'No signatory with this id.' }, { status: 404 });
    }
    if (existing.userId) {
      await prisma.userRole.deleteMany({
        where: { userId: existing.userId, role: 'signatory' as any },
      });
    }
    await prisma.signatory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[DELETE /api/signatories/[id]]', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Could not remove signatory',
        detail:
          message.includes('Foreign key') || message.includes('violates')
            ? 'This signatory is still referenced by clearances or other records. Remove those links first.'
            : message,
      },
      { status: 500 }
    );
  }
}
