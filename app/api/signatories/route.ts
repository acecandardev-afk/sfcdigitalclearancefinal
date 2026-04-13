import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json(
      { error: 'Unauthorized', detail: 'Superadmin session required. Sign out and sign in again if this persists.' },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('active_only') === '1' || url.searchParams.get('active_only') === 'true';
  const orderBulk = url.searchParams.get('order') === 'bulk_assign';

  const signatories = await prisma.signatory.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: orderBulk
      ? [{ signatoryGroup: 'asc' }, { authoritySequenceOrder: { sort: 'asc', nulls: 'first' } }]
      : [{ department: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({ signatories });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  email: z.string().email().max(255),
  is_active: z.boolean().optional(),
  signatory_group: z.enum(['standard', 'authority']).optional(),
  authority_sequence_order: z.number().int().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json(
      { error: 'Unauthorized', detail: 'Superadmin session required. Sign out and sign in again if this persists.' },
      { status: 401 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const s = parsed.data;
  try {
    const signatory = await prisma.signatory.create({
      data: {
        name: s.name,
        position: s.position,
        department: s.department,
        email: s.email.toLowerCase(),
        isActive: s.is_active ?? true,
        signatoryGroup: (s.signatory_group ?? 'standard') as any,
        authoritySequenceOrder: s.authority_sequence_order ?? null,
      },
    });
    return NextResponse.json({ signatory }, { status: 201 });
  } catch (e: unknown) {
    console.error('[POST /api/signatories]', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        const target = Array.isArray(e.meta?.target) ? (e.meta?.target as string[]).join(', ') : 'unique field';
        return NextResponse.json(
          {
            error: 'Duplicate value',
            detail: `A signatory or linked account already uses this ${target}. Change the email or remove the other record.`,
          },
          { status: 409 }
        );
      }
    }
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Could not create signatory', detail: message },
      { status: 500 }
    );
  }
}
