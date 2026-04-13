import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { modelCreatedAtOrNull } from '@/server/prismaDateCompat';

function requireSuperadmin(session: unknown) {
  const s = session as { user?: { roles?: string[] } } | null;
  const roles = (s?.user?.roles ?? []) as string[];
  return Boolean(s?.user && roles.includes('superadmin'));
}

function mapDefaultRows(
  rows: Awaited<
    ReturnType<
      typeof prisma.clearanceDefaultSignatory.findMany<{ include: { signatory: true } }>
    >
  >
) {
  return rows.map((r) => ({
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
}

export async function GET() {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.clearanceDefaultSignatory.findMany({
    orderBy: { sequenceOrder: 'asc' },
    include: { signatory: true },
  });

  return NextResponse.json({ defaultSignatories: mapDefaultRows(rows) });
}

const CreateSchema = z.object({
  signatory_id: z.string().min(1),
  /** 1-based position in the sequence. Omitted = append after the last step. */
  insert_at: z.number().int().min(1).optional(),
});

const ReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);

  /** Reorder sends `{ ids }` only; add sends `{ signatory_id }`. */
  const reorderTry = ReorderSchema.safeParse(json);
  const hasSignatoryId =
    json &&
    typeof json === 'object' &&
    'signatory_id' in json &&
    typeof (json as { signatory_id?: unknown }).signatory_id === 'string' &&
    String((json as { signatory_id: string }).signatory_id).length > 0;

  if (reorderTry.success && !hasSignatoryId) {
    const { ids } = reorderTry.data;

    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: 'Duplicate ids in list' }, { status: 400 });
    }

    try {
      const existing = await prisma.clearanceDefaultSignatory.findMany({
        select: { id: true },
      });

      if (existing.length !== ids.length) {
        return NextResponse.json(
          { error: 'ids must list each default signatory row exactly once' },
          { status: 400 }
        );
      }

      const idSet = new Set(existing.map((r) => r.id));
      for (const id of ids) {
        if (!idSet.has(id)) {
          return NextResponse.json(
            { error: 'ids must list each default signatory row exactly once' },
            { status: 400 }
          );
        }
      }

      // Use batched $transaction([...]), not interactive async (tx) => … with many awaits.
      // Interactive transactions hit Prisma P2028 ("Transaction not found") in Next.js dev.
      const TEMP_BASE = 100_000;
      await prisma.$transaction([
        ...ids.map((id, i) =>
          prisma.clearanceDefaultSignatory.update({
            where: { id },
            data: { sequenceOrder: TEMP_BASE + i },
          })
        ),
        ...ids.map((id, i) =>
          prisma.clearanceDefaultSignatory.update({
            where: { id },
            data: { sequenceOrder: i + 1 },
          })
        ),
      ]);

      const rows = await prisma.clearanceDefaultSignatory.findMany({
        orderBy: { sequenceOrder: 'asc' },
        include: { signatory: true },
      });

      return NextResponse.json({ defaultSignatories: mapDefaultRows(rows) });
    } catch (e) {
      console.error('[default-signatories POST reorder]', e);
      return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
    }
  }

  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { signatory_id, insert_at } = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const dup = await tx.clearanceDefaultSignatory.findUnique({
        where: { signatoryId: signatory_id },
      });
      if (dup) {
        throw new Error('DUPLICATE_SIGNATORY');
      }

      const max = await tx.clearanceDefaultSignatory.aggregate({
        _max: { sequenceOrder: true },
      });
      const maxOrder = max._max.sequenceOrder ?? 0;

      let targetOrder: number;
      if (insert_at != null) {
        targetOrder = Math.min(insert_at, maxOrder + 1);
      } else {
        targetOrder = maxOrder + 1;
      }

      const toShift = await tx.clearanceDefaultSignatory.findMany({
        where: { sequenceOrder: { gte: targetOrder } },
        orderBy: { sequenceOrder: 'desc' },
      });
      for (const row of toShift) {
        await tx.clearanceDefaultSignatory.update({
          where: { id: row.id },
          data: { sequenceOrder: row.sequenceOrder + 1 },
        });
      }

      return tx.clearanceDefaultSignatory.create({
        data: {
          signatoryId: signatory_id,
          sequenceOrder: targetOrder,
        },
      });
    });

    return NextResponse.json(
      { id: created.id, sequence_order: created.sequenceOrder },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'DUPLICATE_SIGNATORY') {
      return NextResponse.json(
        { error: 'This signatory is already in the default order.' },
        { status: 409 }
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'This signatory is already in the default order.' },
        { status: 409 }
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return NextResponse.json(
        { error: 'That signatory no longer exists. Refresh the page and try again.' },
        { status: 400 }
      );
    }
    console.error('[default-signatories POST add]', e);
    return NextResponse.json({ error: 'Could not update default order.' }, { status: 500 });
  }
}
