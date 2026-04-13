import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { modelCreatedAtOrNull } from '@/server/prismaDateCompat';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

export async function GET() {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.clearanceDefaultSignatory.findMany({
    orderBy: { sequenceOrder: 'asc' },
    include: { signatory: true },
  });

  const mapped = rows.map((r) => ({
    id: r.id,
    signatory_id: r.signatoryId,
    sequence_order: r.sequenceOrder,
    signatory: {
      id: r.signatory.id,
      name: r.signatory.name,
      position: r.signatory.position,
      department: r.signatory.department,
      email: r.signatory.email,
      is_active: r.signatory.isActive,
      user_id: r.signatory.userId,
      created_at: modelCreatedAtOrNull(r.signatory as object)?.toISOString() ?? null,
    },
  }));

  return NextResponse.json({ defaultSignatories: mapped });
}

const CreateSchema = z.object({
  signatory_id: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const max = await prisma.clearanceDefaultSignatory.aggregate({
    _max: { sequenceOrder: true },
  });
  const nextOrder = (max._max.sequenceOrder ?? 0) + 1;

  const created = await prisma.clearanceDefaultSignatory.create({
    data: {
      signatoryId: parsed.data.signatory_id,
      sequenceOrder: nextOrder,
    },
  });

  return NextResponse.json({ id: created.id, sequence_order: created.sequenceOrder }, { status: 201 });
}
