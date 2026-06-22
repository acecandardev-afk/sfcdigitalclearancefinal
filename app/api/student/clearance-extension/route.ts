import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';

const PostSchema = z.object({
  extends_to: z.string().datetime(),
  reason: z.string().min(1).max(4000),
});

export async function GET() {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !canRequestStudentClearance(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const studentId = (session.user as any).id as string;
  const rows = await prisma.clearancePeriodExtension.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return NextResponse.json({ extensions: rows });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !canRequestStudentClearance(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const studentId = (session.user as any).id as string;
  const json = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const pending = await prisma.clearancePeriodExtension.count({
    where: { studentId, status: 'pending' },
  });
  if (pending > 0) {
    return NextResponse.json({ error: 'You already have a pending extension request.' }, { status: 400 });
  }

  const created = await prisma.clearancePeriodExtension.create({
    data: {
      studentId,
      extendsTo: new Date(parsed.data.extends_to),
      reason: parsed.data.reason,
      status: 'pending',
    },
  });
  return NextResponse.json({ extension: created }, { status: 201 });
}
