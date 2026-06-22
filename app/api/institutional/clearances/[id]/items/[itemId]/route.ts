import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { z } from 'zod';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, sessionRoles } from '@/lib/apiAuth';
import { isPreviousRowsCleared } from '@/lib/institutionalSequential';
import { notifyAfterInstitutionalItemPatch } from '@/lib/institutionalNotifications';
import { isInstitutionalAdminElevation } from '@/lib/permissionsMatrix';

const PatchBody = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'waived']),
  remarks: z.string().max(2000).optional().nullable(),
  approverName: z.string().max(200).optional().nullable(),
  /** set true to stamp approval with current time & session user */
  setApproved: z.boolean().optional(),
});

function denyIfNotSigner(roles: string[]) {
  if (!canAccessInstitutionalModule(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: Request, context: Ctx) {
  const { id, itemId } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const d = denyIfNotSigner(roles);
  if (d) return d;
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Something went wrong. Please sign in again and try again.' }, { status: 400 });
  }

  const item = await prisma.institutionalClearanceItem.findFirst({
    where: { id: itemId, institutionalClearanceId: id },
    include: {
      clearance: {
        include: {
          requester: { select: { id: true } },
          items: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isSuper = isInstitutionalAdminElevation(roles);
  if (!isSuper && item.clearance.requester.id === userId) {
    return NextResponse.json(
      { error: 'You submitted this request. Another assigned signatory must sign this row.' },
      { status: 403 }
    );
  }
  if (!isSuper) {
    if (item.signatoryId) {
      const mySignatory = await prisma.signatory.findFirst({
        where: { userId, id: item.signatoryId },
      });
      if (!mySignatory) {
        return NextResponse.json(
          { error: 'You are not the assigned signatory for this row' },
          { status: 403 }
        );
      }
    } else {
      // Legacy item without signatory link: any active signatory may update
      const any = await prisma.signatory.findFirst({ where: { userId } });
      if (!any) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  const body = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const b = parsed.data;
  const isActing = b.status === 'approved' || b.status === 'rejected' || b.status === 'waived';
  if (isActing) {
    const remarksTrim = b.remarks?.trim() ?? '';
    if (!remarksTrim) {
      return NextResponse.json({ error: 'Remarks are required when approving, waiving, or rejecting.' }, { status: 400 });
    }
  }
  if ((b.status === 'approved' || b.status === 'waived') && !isSuper) {
    const pendingOffice = await prisma.institutionalClearanceItemFulfillment.count({
      where: {
        institutionalClearanceItemId: itemId,
        requirement: { kind: 'office' },
        officeVerifiedAt: null,
      },
    });
    if (pendingOffice > 0) {
      return NextResponse.json(
        {
          error:
            'Office verification is still pending for one or more requirements. Verify in-office checks first.',
        },
        { status: 400 }
      );
    }
  }
  if (isActing && !isSuper) {
    const allRows = item.clearance.items.map((i) => ({
      id: i.id,
      sortOrder: i.sortOrder,
      status: i.status,
    }));
    const seq = isPreviousRowsCleared(allRows, itemId);
    if (!seq.ok) {
      return NextResponse.json(
        { error: 'Complete earlier signatories in order before acting on this line.' },
        { status: 400 }
      );
    }
  }
  const now = new Date();
  const isFinal = b.status === 'approved' || b.status === 'waived';
  const shouldStamp = isFinal && (b.setApproved || !item.approvedAt);

  await prisma.institutionalClearanceItem.update({
    where: { id: itemId },
    data: {
      status: b.status,
      remarks: b.remarks === undefined ? undefined : b.remarks?.trim() || null,
      approverName: b.approverName === undefined ? undefined : b.approverName?.trim() || null,
      approvedAt: isFinal
        ? shouldStamp
          ? now
          : item.approvedAt
        : null,
      approvedByUserId: isFinal && shouldStamp ? userId : isFinal ? item.approvedByUserId : null,
    },
  });

  const clearance = await prisma.institutionalClearance.findUnique({ where: { id } });
  if (clearance && clearance.status === 'pending') {
    await prisma.institutionalClearance.update({
      where: { id },
      data: { status: 'in_progress' },
    });
  }

  if (b.status === 'approved' || b.status === 'rejected' || b.status === 'waived') {
    try {
      await notifyAfterInstitutionalItemPatch({
        clearanceId: id,
        itemId,
        newStatus: b.status,
        departmentLabel: item.departmentLabel,
        clearancesRequesterId: item.clearance.requester.id,
      });
    } catch (e) {
      console.error('[institutional item notify]', e);
    }
  }

  return NextResponse.json({ ok: true });
}
