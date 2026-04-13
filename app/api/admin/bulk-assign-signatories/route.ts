import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const BodySchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
});

/** Build ordered lists matching clearance flow: all standard first, then authority (ordered by sequence, then nulls by name). */
function partitionSignatoriesForBulk(
  signatories: {
    id: string;
    name: string;
    signatoryGroup: string;
    authoritySequenceOrder: number | null;
  }[]
) {
  const standardSignatories = signatories
    .filter((s) => s.signatoryGroup === 'standard')
    .sort((a, b) => a.name.localeCompare(b.name));

  const authorityAll = signatories.filter((s) => s.signatoryGroup === 'authority');
  const withOrder = authorityAll
    .filter((s) => s.authoritySequenceOrder != null)
    .sort((a, b) => (a.authoritySequenceOrder ?? 0) - (b.authoritySequenceOrder ?? 0));
  const withoutOrder = authorityAll
    .filter((s) => s.authoritySequenceOrder == null)
    .sort((a, b) => a.name.localeCompare(b.name));
  const authoritySignatories = [...withOrder, ...withoutOrder];

  return { standardSignatories, authoritySignatories };
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json(
      { error: 'Unauthorized', detail: 'Superadmin session required.' },
      { status: 401 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 400 });
  }

  const requestedIds = [...new Set(parsed.data.studentIds)];

  const validStudents = await prisma.user.findMany({
    where: {
      id: { in: requestedIds },
      roles: { some: { role: 'student' as const } },
    },
    select: { id: true },
  });
  const studentIds = validStudents.map((u) => u.id);
  if (studentIds.length === 0) {
    return NextResponse.json(
      {
        error: 'No valid students in selection',
        detail: 'Choose accounts that have the student role. Refresh the list and try again.',
      },
      { status: 400 }
    );
  }

  const signatories = await prisma.signatory.findMany({
    where: { isActive: true },
    orderBy: [{ signatoryGroup: 'asc' }, { name: 'asc' }],
  });

  const { standardSignatories, authoritySignatories } = partitionSignatoriesForBulk(signatories);

  if (standardSignatories.length === 0 && authoritySignatories.length === 0) {
    return NextResponse.json(
      {
        error: 'No active signatories configured',
        detail: 'Add at least one active signatory (Standard or Authority) in Signatories before bulk assign.',
      },
      { status: 400 }
    );
  }

  const rows: {
    studentId: string;
    signatoryId: string;
    sequenceOrder: number;
    signatoryGroup: 'standard' | 'authority';
  }[] = [];

  for (const studentId of studentIds) {
    let seq = 1;
    for (const s of standardSignatories) {
      rows.push({
        studentId,
        signatoryId: s.id,
        signatoryGroup: 'standard',
        sequenceOrder: seq++,
      });
    }
    for (const s of authoritySignatories) {
      rows.push({
        studentId,
        signatoryId: s.id,
        signatoryGroup: 'authority',
        sequenceOrder: seq++,
      });
    }
  }

  try {
    await prisma.$transaction([
      prisma.studentSignatoryAssignment.deleteMany({
        where: { studentId: { in: studentIds } },
      }),
      prisma.studentSignatoryAssignment.createMany({ data: rows }),
    ]);
  } catch (e: unknown) {
    console.error('[POST /api/admin/bulk-assign-signatories]', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: 'Could not save assignments',
          detail: e.code === 'P2002' ? 'Duplicate assignment row — try again after refresh.' : e.message,
        },
        { status: 409 }
      );
    }
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'Could not save assignments', detail: message }, { status: 500 });
  }

  const slotsPerStudent = standardSignatories.length + authoritySignatories.length;

  return NextResponse.json({
    ok: true,
    studentsAssigned: studentIds.length,
    signatoriesPerStudent: slotsPerStudent,
    skippedNonStudents: requestedIds.length - studentIds.length,
  });
}
