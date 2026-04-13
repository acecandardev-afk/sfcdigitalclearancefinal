import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';
import { clearanceSignatureActivityDate } from '@/server/prismaDateCompat';
import { parseRequirements } from '@/components/clearance/my-clearance/myClearanceTypes';

function mapDbStatusToUi(
  status: string | null | undefined,
  hasSignature: boolean
): 'Request' | 'Pending' | 'Approved' | 'Rejected' {
  if (!hasSignature) return 'Request';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

export async function GET() {
  const session = await getServerSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as any).id as string;

  const security = await prisma.systemSetting.findUnique({
    where: { key: 'security' },
    select: { valueJson: true },
  });
  const allowMultiple =
    (security?.valueJson as { allow_multiple_clearances?: boolean } | null)?.allow_multiple_clearances === true;

  const draft = await prisma.clearanceRequest.findFirst({
    where: { studentId, status: { in: ['pending', 'in_progress'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  let completedRequestId: string | null = null;
  if (!draft?.id && !allowMultiple) {
    const last = await prisma.clearanceRequest.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (last?.status === 'approved') completedRequestId = last.id;
  }

  const draftRequestId = draft?.id ?? null;
  const requestIdForSigs = draftRequestId ?? completedRequestId;

  const sigMap = new Map<
    string,
    {
      id: string;
      status: string;
      remarks: string | null;
      notes: string | null;
      signedAt: Date | null;
      createdAt: Date | null;
    }
  >();

  if (requestIdForSigs) {
    const sigs = await prisma.clearanceSignature.findMany({
      where: { clearanceRequestId: requestIdForSigs },
    });
    sigs.forEach((s) =>
      sigMap.set(s.signatoryId, {
        id: s.id,
        status: s.status,
        remarks: s.remarks,
        notes: s.notes,
        signedAt: s.signedAt,
        createdAt: clearanceSignatureActivityDate(s),
      })
    );
  }

  let assigns: {
    sequenceOrder: number;
    signatoryGroup: string;
    signatory: {
      id: string;
      name: string;
      position: string;
      department: string;
      signatoryGroup: string;
      authoritySequenceOrder: number | null;
      isActive: boolean;
    };
  }[] = [];

  const personal = await prisma.studentSignatoryAssignment.findMany({
    where: { studentId },
    orderBy: { sequenceOrder: 'asc' },
    include: { signatory: true },
  });

  if (personal.length) {
    assigns = personal.map((a) => ({
      sequenceOrder: a.sequenceOrder,
      signatoryGroup: a.signatoryGroup,
      signatory: a.signatory,
    }));
  } else {
    const defaults = await prisma.clearanceDefaultSignatory.findMany({
      orderBy: { sequenceOrder: 'asc' },
      include: { signatory: true },
    });
    assigns = defaults.map((d) => ({
      sequenceOrder: d.sequenceOrder,
      signatoryGroup: d.signatory.signatoryGroup,
      signatory: d.signatory,
    }));
  }

  const rows: Record<string, unknown>[] = [];
  for (const a of assigns) {
    const s = a.signatory;
    if (!s.isActive) continue;
    const group = (s.signatoryGroup || a.signatoryGroup || 'standard') as 'standard' | 'authority';
    const sig = sigMap.get(s.id);
    const hasSig = !!sig;
    const uiStatus = mapDbStatusToUi(sig?.status, hasSig);
    const displayStatus = hasSig ? uiStatus : 'Request';
    const ts = sig?.signedAt ?? sig?.createdAt;
    const dateStr = ts ? ts.toLocaleDateString() : '—';
    rows.push({
      id: s.id,
      signatoryId: s.id,
      sequenceOrder: a.sequenceOrder,
      office: s.department || s.name,
      officer: `${s.name} — ${s.position}`,
      uiStatus: displayStatus,
      date: dateStr,
      schedule: '—',
      remarks: sig?.remarks || sig?.notes || '—',
      requirements: parseRequirements(null),
      signatureId: sig?.id ?? null,
      signatoryGroup: group,
      authoritySequenceOrder: s.authoritySequenceOrder,
      signatureCreatedAt: sig?.createdAt?.toISOString() ?? null,
      signatureSignedAt: sig?.signedAt?.toISOString() ?? null,
    });
  }

  return NextResponse.json({
    allowMultiple,
    draftRequestId,
    completedRequestId,
    rows,
  });
}
