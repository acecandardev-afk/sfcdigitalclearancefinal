import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canReviewClearanceExtensions } from '@/lib/permissionsMatrix';

export async function GET() {
  const session = await getAppSession();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!session?.user || !canReviewClearanceExtensions(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const extensions = await prisma.clearancePeriodExtension.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      student: { select: { id: true, email: true, profile: { select: { fullName: true, studentId: true } } } },
    },
  });
  return NextResponse.json({ extensions });
}
