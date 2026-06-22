import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { isStudentRecordsElevation, canRequestStudentClearance, isHrAdmin } from '@/lib/permissionsMatrix';

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const clearanceRequestId = url.searchParams.get('clearanceRequestId');
  const signatoryId = url.searchParams.get('signatoryId');
  if (!clearanceRequestId || !signatoryId) {
    return NextResponse.json({ error: 'Missing clearanceRequestId or signatoryId' }, { status: 400 });
  }

  const userId = (session.user as any).id as string;
  const roles = ((session.user as any).roles ?? []) as string[];

  const cr = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceRequestId },
    select: { studentId: true },
  });
  if (!cr) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isStaffAdmin = isStudentRecordsElevation(roles) || isHrAdmin(roles);
  const isOwnStudentRequester =
    canRequestStudentClearance(roles) && cr.studentId === userId;
  if (!isStaffAdmin && !isOwnStudentRequester) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<
    { id: string; action: string; details: unknown; created_at: Date }[]
  >`
    SELECT id, action, details, "createdAt" AS created_at
    FROM activity_logs
    WHERE details->>'clearance_request_id' = ${clearanceRequestId}
      AND details->>'signatory_id' = ${signatoryId}
    ORDER BY "createdAt" ASC
  `;

  const logs = rows.map((r) => ({
    action: r.action,
    details: r.details,
    created_at: r.created_at.toISOString(),
  }));

  return NextResponse.json({ logs });
}
