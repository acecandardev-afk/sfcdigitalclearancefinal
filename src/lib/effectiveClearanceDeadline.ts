import { endOfDay, isAfter, isBefore, max, startOfDay } from 'date-fns';
import type { ClearancePeriod } from '@/lib/clearancePeriod';
import type { ExtensionStatus } from '@prisma/client';

export type ExtensionRow = { extendsTo: Date; status: ExtensionStatus };

/**
 * Effective last day a student may act (submit / resubmit), combining global period
 * with the latest approved extension's `extendsTo` (whichever is later).
 */
export function effectiveClearanceEnd(
  period: ClearancePeriod | null,
  approvedExtensions: ExtensionRow[],
  now = new Date()
): { allowed: true } | { allowed: false; reason: string } {
  if (!period) {
    return { allowed: true };
  }
  const day = startOfDay(now);
  const start = startOfDay(period.start);
  const baseEnd = endOfDay(period.end);
  const approved = approvedExtensions.filter((e) => e.status === 'approved');
  const extEnd =
    approved.length > 0
      ? endOfDay(max(approved.map((e) => startOfDay(e.extendsTo))))
      : baseEnd;
  const effectiveEnd = isAfter(extEnd, baseEnd) ? extEnd : baseEnd;

  if (isBefore(day, start)) {
    return { allowed: false, reason: 'Clearance has not opened yet.' };
  }
  if (isAfter(day, effectiveEnd)) {
    return { allowed: false, reason: 'The clearance period (including any approved extension) has ended.' };
  }
  return { allowed: true };
}
