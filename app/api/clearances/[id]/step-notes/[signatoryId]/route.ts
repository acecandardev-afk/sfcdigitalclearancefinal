import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

async function assertStudentOwnsClearance(clearanceId: string, studentId: string) {
  const cr = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceId },
    select: { studentId: true },
  });
  return cr?.studentId === studentId;
}

export async function GET(_req: Request, ctx: { params: { id: string; signatoryId: string } }) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as any).id as string;
  const clearanceId = ctx.params.id;
  const signatoryId = ctx.params.signatoryId;

  if (!(await assertStudentOwnsClearance(clearanceId, studentId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const row = await prisma.studentClearanceStepNote.findUnique({
    where: { clearanceRequestId_signatoryId: { clearanceRequestId: clearanceId, signatoryId } },
    select: { note: true },
  });

  return NextResponse.json({ note: row?.note ?? '' });
}

const PutSchema = z.object({
  note: z.string().max(8000),
});

export async function PUT(req: Request, ctx: { params: { id: string; signatoryId: string } }) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as any).id as string;
  const clearanceId = ctx.params.id;
  const signatoryId = ctx.params.signatoryId;

  if (!(await assertStudentOwnsClearance(clearanceId, studentId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.studentClearanceStepNote.upsert({
    where: { clearanceRequestId_signatoryId: { clearanceRequestId: clearanceId, signatoryId } },
    create: {
      clearanceRequestId: clearanceId,
      signatoryId,
      note: parsed.data.note.trim(),
    },
    update: { note: parsed.data.note.trim() },
  });

  return NextResponse.json({ ok: true });
}
