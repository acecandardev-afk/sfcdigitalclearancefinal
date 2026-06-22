import { NextResponse } from 'next/server';
import type { Prisma, RequirementKind } from '@prisma/client';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';
import { clearanceSignatureActivityDate } from '@/server/prismaDateCompat';
import { formatWeeklyHoursSummary } from '@/lib/officeHours';
import { requirementToOfficeUi } from '@/lib/signatoryRequirements';
import { parseClearancePeriodFromSettings } from '@/lib/clearancePeriod';
import { effectiveClearanceEnd } from '@/lib/effectiveClearanceDeadline';
import { buildStudentClearanceVerifyToken } from '@/lib/studentClearanceVerifyToken';
import {
  getStudentPreClearanceStatus,
  preClearanceBlockMessage,
} from '@/server/preClearanceService';

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
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !canRequestStudentClearance(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as any).id as string;

  const [security, draft] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { key: 'security' },
      select: { valueJson: true },
    }),
    prisma.clearanceRequest.findFirst({
      where: { studentId, status: { in: ['pending', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
  ]);
  const allowMultiple =
    (security?.valueJson as { allow_multiple_clearances?: boolean } | null)?.allow_multiple_clearances === true;

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
      weeklyHoursJson: unknown;
      requirements: {
        id: number;
        kind: RequirementKind;
        label: string;
        instructions: string | null;
        required: boolean;
      }[];
    };
  }[] = [];

  const personal = await prisma.studentSignatoryAssignment.findMany({
    where: { studentId },
    orderBy: { sequenceOrder: 'asc' },
    include: {
      signatory: {
        include: {
          requirements: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
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
      include: {
        signatory: {
          include: {
            requirements: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    assigns = defaults.map((d) => ({
      sequenceOrder: d.sequenceOrder,
      signatoryGroup: d.signatory.signatoryGroup,
      signatory: d.signatory,
    }));
  }

  const fulfillmentBySig = new Map<string, { officePending: boolean }>();
  if (requestIdForSigs) {
    const sigRows = await prisma.clearanceSignature.findMany({
      where: { clearanceRequestId: requestIdForSigs },
      select: { id: true, signatoryId: true },
    });
    const reqsBySig = new Map<string, { id: number; kind: string }[]>();
    for (const a of assigns) {
      reqsBySig.set(
        a.signatory.id,
        a.signatory.requirements.map((r) => ({ id: r.id, kind: r.kind }))
      );
    }
    const sigIds = sigRows.map((r) => r.id);
    const allFul =
      sigIds.length > 0
        ? await prisma.clearanceRequirementFulfillment.findMany({
            where: { clearanceSignatureId: { in: sigIds } },
            include: { requirement: { select: { kind: true } } },
          })
        : [];
    const fulBySig = new Map<string, typeof allFul>();
    for (const f of allFul) {
      const list = fulBySig.get(f.clearanceSignatureId) ?? [];
      list.push(f);
      fulBySig.set(f.clearanceSignatureId, list);
    }
    for (const sr of sigRows) {
      const reqKinds = reqsBySig.get(sr.signatoryId) ?? [];
      if (!reqKinds.some((r) => r.kind === 'office')) {
        fulfillmentBySig.set(sr.id, { officePending: false });
        continue;
      }
      const ful = fulBySig.get(sr.id) ?? [];
      let officePending = false;
      for (const f of ful) {
        if (f.requirement.kind === 'office' && !f.officeVerifiedAt) {
          officePending = true;
          break;
        }
      }
      fulfillmentBySig.set(sr.id, { officePending });
    }
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
    const dbReqs = s.requirements ?? [];
    const hasDbRequirements = dbReqs.length > 0;
    const requirements = hasDbRequirements
      ? requirementToOfficeUi(
          dbReqs.map((r) => ({
            id: r.id,
            kind: r.kind,
            label: r.label,
            instructions: r.instructions,
            required: r.required,
          }))
        )
      : [];
    const officeVerificationPending =
      sig?.id && fulfillmentBySig.get(sig.id)?.officePending === true;

    rows.push({
      id: s.id,
      signatoryId: s.id,
      sequenceOrder: a.sequenceOrder,
      /** Form section (Student & Academic Leadership, etc.) — optional for search/UI. */
      department: s.department,
      /** Office / role line (unique per row). */
      office: s.position || s.name,
      /** Designated personnel only (name line from the registrar form). */
      officer: s.name,
      uiStatus: displayStatus,
      date: dateStr,
      schedule: formatWeeklyHoursSummary(s.weeklyHoursJson as Prisma.JsonValue),
      remarks: sig?.remarks || '—',
      requirements,
      hasDbRequirements,
      officeVerificationPending: !!officeVerificationPending,
      signatureId: sig?.id ?? null,
      signatoryGroup: group,
      authoritySequenceOrder: s.authoritySequenceOrder,
      signatureCreatedAt: sig?.createdAt?.toISOString() ?? null,
      signatureSignedAt: sig?.signedAt?.toISOString() ?? null,
    });
  }

  const [clearanceSetting, approvedExt, preClearanceStatus] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { key: 'clearance' },
      select: { valueJson: true },
    }),
    prisma.clearancePeriodExtension.findMany({
      where: { studentId, status: 'approved' },
      select: { extendsTo: true, status: true },
    }),
    getStudentPreClearanceStatus(studentId),
  ]);
  const period = parseClearancePeriodFromSettings(clearanceSetting?.valueJson);
  const gate = effectiveClearanceEnd(period, approvedExt);

  let submissionAllowed = gate.allowed;
  let submissionBlockReason: string | null = gate.allowed ? null : 'reason' in gate ? gate.reason : null;
  if (!preClearanceStatus.allComplete) {
    submissionAllowed = false;
    submissionBlockReason = preClearanceBlockMessage(preClearanceStatus.missingGates);
  }

  return NextResponse.json({
    allowMultiple,
    draftRequestId,
    completedRequestId,
    rows,
    submissionAllowed,
    submissionBlockReason,
    preClearance: preClearanceStatus,
    verifyToken:
      requestIdForSigs != null
        ? buildStudentClearanceVerifyToken(requestIdForSigs, studentId)
        : null,
  });
}
