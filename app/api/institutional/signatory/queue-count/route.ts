import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, sessionRoles } from '@/lib/apiAuth';
import { activeItemId } from '@/lib/institutionalSequential';
import { isInstitutionalAdminElevation } from '@/lib/permissionsMatrix';

function isPendingRow(status: string) {
  return status === 'pending';
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

/**
 * Same eligibility rules as `signatory/queue` but returns only counts (nav polling).
 * Keep logic aligned with `app/api/institutional/signatory/queue/route.ts`.
 */
export async function GET() {
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
      requester: { select: { id: true } },
      items: { orderBy: { sortOrder: 'asc' }, select: { id: true, signatoryId: true, sortOrder: true, status: true } },
    },
  });

  const officeDefs = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { sortOrder: true, signatoryId: true },
  });
  const officeSignatoryIdBySortOrder = new Map(
    officeDefs.map((d) => [d.sortOrder, d.signatoryId ?? null] as const)
  );

  let toSignCount = 0;
  let waitingCount = 0;

  for (const c of openClearances) {
    const items = c.items;
    const activeId = activeItemId(items);
    for (const row of items) {
      if (!isPendingRow(row.status)) continue;
      const resolvedSignatoryId = row.signatoryId ?? officeSignatoryIdBySortOrder.get(row.sortOrder) ?? null;
      if (row.id === activeId) {
        if (c.requester.id === userId && !isSuper) {
          waitingCount += 1;
        } else if (canUserActOnItem(isSuper, hasSignatoryRole, mySignatoryId, resolvedSignatoryId)) {
          toSignCount += 1;
        } else {
          waitingCount += 1;
        }
      } else {
        waitingCount += 1;
      }
    }
  }

  return NextResponse.json({ toSignCount, waitingCount });
}
