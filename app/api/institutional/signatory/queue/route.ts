import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, sessionRoles } from '@/lib/apiAuth';
import { activeItemId } from '@/lib/institutionalSequential';
import { isInstitutionalAdminElevation } from '@/lib/permissionsMatrix';

function isPendingRow(status: string) {
  return status === 'pending';
}

function isActedStatus(status: string) {
  return status === 'approved' || status === 'waived' || status === 'rejected';
}

function canUserActOnItem(
  isSuper: boolean,
  hasSignatoryRole: boolean,
  mySignatoryId: string | null,
  itemSignatoryId: string | null
) {
  if (isSuper) return true;
  if (itemSignatoryId == null) return hasSignatoryRole;
  return mySignatoryId != null && mySignatoryId === itemSignatoryId;
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  if (!canAccessInstitutionalModule(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isSuper = isInstitutionalAdminElevation(roles);
  const hasSignatoryRole = roles.includes('signatory');
  const mySign = await prisma.signatory.findFirst({
    where: { userId },
    select: { id: true },
  });
  const mySignatoryId = mySign?.id ?? null;

  const myHistoryItems = await prisma.institutionalClearanceItem.findMany({
    where: { approvedByUserId: userId },
    orderBy: { clearance: { updatedAt: 'desc' } },
    include: {
      signatory: {
        select: {
          id: true,
          name: true,
          department: true,
        },
      },
      clearance: {
        include: {
          requester: {
            select: {
              id: true,
              email: true,
              profile: { select: { fullName: true } },
            },
          },
          items: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });

  const clearanceWhere =
    isSuper || !mySignatoryId
      ? { status: { in: ['pending', 'in_progress'] as ('pending' | 'in_progress')[] } }
      : {
          status: { in: ['pending', 'in_progress'] as ('pending' | 'in_progress')[] },
          items: { some: { signatoryId: mySignatoryId } },
        };

  const openClearances = await prisma.institutionalClearance.findMany({
    where: clearanceWhere,
    orderBy: { updatedAt: 'desc' },
    include: {
      requester: {
        select: {
          id: true,
          email: true,
          profile: { select: { fullName: true } },
        },
      },
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          signatory: {
            select: {
              id: true,
              name: true,
              department: true,
            },
          },
        },
      },
      files: {
        select: { id: true },
      },
    },
  });
  const officeDefs = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      signatory: {
        select: {
          id: true,
          name: true,
          department: true,
        },
      },
    },
  });
  const officeSignatoryBySortOrder = new Map(
    officeDefs.map((d) => [d.sortOrder, d.signatory ?? null] as const)
  );
  const officeSignatoryIdBySortOrder = new Map(
    officeDefs.map((d) => [d.sortOrder, d.signatoryId ?? null] as const)
  );

  type ClearanceMapInput = {
    id: string;
    fullName: string;
    position: string;
    department: string;
    status: string;
    createdAt: Date;
    requester: { id: string; email: string; profile?: { fullName: string | null } | null };
    files?: { id: string }[];
  };

  const mapClearance = (c: ClearanceMapInput) => ({
    id: c.id,
    fullName: c.fullName,
    position: c.position,
    department: c.department,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    requester: {
      id: c.requester.id,
      email: c.requester.email,
      full_name: c.requester.profile?.fullName ?? null,
    },
    attachmentCount: c.files?.length ?? 0,
  });

  const mapItem = (i: {
    id: string;
    signatoryId: string | null;
    sortOrder: number;
    status: string;
    departmentLabel: string;
    approvedAt: Date | null;
    signatory?: { id: string; name: string; department: string } | null;
  }) => {
    const resolvedSignatory = i.signatory ?? officeSignatoryBySortOrder.get(i.sortOrder) ?? null;
    return {
      id: i.id,
      signatoryId: i.signatoryId,
      signatoryName: resolvedSignatory?.name ?? '',
      signatoryDepartment: resolvedSignatory?.department ?? '',
      sortOrder: i.sortOrder,
      status: i.status,
      departmentLabel: i.departmentLabel,
      approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
    };
  };

  const toSign: unknown[] = [];
  const waiting: unknown[] = [];

  for (const c of openClearances) {
    const items = c.items;
    const activeId = activeItemId(items);
    const cl = mapClearance(c);
    for (const row of items) {
      if (!isPendingRow(row.status)) continue;
      const resolvedSignatoryId = row.signatoryId ?? officeSignatoryIdBySortOrder.get(row.sortOrder) ?? null;
      const isAssignedToCurrentSignatory = mySignatoryId != null && resolvedSignatoryId === mySignatoryId;
      const it = mapItem(row);
      if (row.id === activeId) {
        if (c.requester.id === userId && !isSuper) {
          waiting.push({
            clearance: cl,
            item: it,
            blockedReason: 'You submitted this request. Another assigned signatory must sign this line.',
          });
        } else if (canUserActOnItem(isSuper, hasSignatoryRole, mySignatoryId, resolvedSignatoryId)) {
          toSign.push({ clearance: cl, item: it });
        } else {
          // Non-assigned signatories can still view the request, but cannot sign this line yet.
          waiting.push({
            clearance: cl,
            item: it,
            blockedReason: isAssignedToCurrentSignatory
              ? 'This request is ready for your sign-off.'
              : 'This request is currently assigned to another signatory.',
          });
        }
      } else {
        waiting.push({ clearance: cl, item: it, blockedReason: 'Waiting for earlier offices to finish first.' });
      }
    }
  }

  const history: unknown[] = [];
  for (const row of myHistoryItems) {
    if (!isActedStatus(row.status)) continue;
    const c = mapClearance(row.clearance);
    const it = mapItem(row);
    history.push({ clearance: c, item: it });
  }

  return NextResponse.json({ toSign, waiting, history, mode: 'signatory' });
}
