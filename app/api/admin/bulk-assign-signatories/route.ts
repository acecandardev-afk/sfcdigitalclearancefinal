import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const BodySchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
    return NextResponse.json({ error: 'No valid students in selection' }, { status: 400 });
  }

  const signatories = await prisma.signatory.findMany({
    where: { isActive: true },
    orderBy: [{ signatoryGroup: 'asc' }, { authoritySequenceOrder: { sort: 'asc', nulls: 'first' } }],
  });

  const standardSignatories = signatories.filter((s) => s.signatoryGroup === 'standard');
  const authoritySignatories = signatories
    .filter((s) => s.signatoryGroup === 'authority' && s.authoritySequenceOrder != null)
    .sort((a, b) => (a.authoritySequenceOrder ?? 0) - (b.authoritySequenceOrder ?? 0));

  if (standardSignatories.length === 0 && authoritySignatories.length === 0) {
    return NextResponse.json({ error: 'No active signatories configured' }, { status: 400 });
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

  await prisma.$transaction([
    prisma.studentSignatoryAssignment.deleteMany({
      where: { studentId: { in: studentIds } },
    }),
    prisma.studentSignatoryAssignment.createMany({ data: rows }),
  ]);

  const slotsPerStudent = standardSignatories.length + authoritySignatories.length;

  return NextResponse.json({
    ok: true,
    studentsAssigned: studentIds.length,
    signatoriesPerStudent: slotsPerStudent,
  });
}
