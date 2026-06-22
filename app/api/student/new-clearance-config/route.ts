import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';
import {
  getStudentPreClearanceStatus,
  preClearanceBlockMessage,
} from '@/server/preClearanceService';

export async function GET() {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !canRequestStudentClearance(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as any).id as string;

  const preClearance = await getStudentPreClearanceStatus(studentId);
  const preClearanceComplete = preClearance.allComplete;

  const security = await prisma.systemSetting.findUnique({
    where: { key: 'security' },
    select: { valueJson: true },
  });

  const allowMultiple =
    (security?.valueJson as any)?.allow_multiple_clearances === true;

  let allowNewClearance = true;
  if (!allowMultiple) {
    const activeCount = await prisma.clearanceRequest.count({
      where: {
        studentId,
        status: { in: ['pending', 'in_progress'] as any },
      },
    });
    allowNewClearance = activeCount === 0;
  }

  const assignments = await prisma.studentSignatoryAssignment.findMany({
    where: { studentId },
    orderBy: { sequenceOrder: 'asc' },
    include: { signatory: true },
  });

  const defaults = await prisma.clearanceDefaultSignatory.findMany({
    orderBy: { sequenceOrder: 'asc' },
    include: { signatory: true },
  });

  const rows = assignments.length
    ? assignments.map((a) => ({
        signatory: a.signatory,
        sequenceOrder: a.sequenceOrder,
        signatoryGroup: a.signatoryGroup,
      }))
    : defaults.map((d) => ({
        signatory: d.signatory,
        sequenceOrder: d.sequenceOrder,
        signatoryGroup: d.signatory.signatoryGroup,
      }));

  const signatories = rows
    .filter((r) => r.signatory.isActive)
    .map((r) => ({
      id: r.signatory.id,
      name: r.signatory.name,
      position: r.signatory.position,
      department: r.signatory.department,
      order: r.sequenceOrder,
      signatory_group: r.signatoryGroup,
      authority_sequence_order: r.signatory.authoritySequenceOrder ?? null,
    }));

  return NextResponse.json({
    allowNewClearance,
    preClearanceComplete,
    preClearanceBlockReason: preClearanceComplete
      ? null
      : preClearanceBlockMessage(preClearance.missingGates),
    signatories,
  });
}
