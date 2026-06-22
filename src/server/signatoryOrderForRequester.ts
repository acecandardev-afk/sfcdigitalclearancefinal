import { prisma } from '@/server/db';
import type { Signatory, SignatoryGroup } from '@prisma/client';

export type OrderedSignatoryRow = {
  signatory: Signatory;
  sequenceOrder: number;
  signatoryGroup: SignatoryGroup;
};

/**
 * Same signatory list as new student clearances: personal assignments, else default order.
 * Uses active signatories only.
 */
export async function getOrderedSignatoriesForRequester(
  requesterId: string
): Promise<OrderedSignatoryRow[]> {
  const assignments = await prisma.studentSignatoryAssignment.findMany({
    where: { studentId: requesterId },
    orderBy: { sequenceOrder: 'asc' },
    include: { signatory: true },
  });

  if (assignments.length) {
    return assignments
      .filter((a) => a.signatory.isActive)
      .map((a) => ({
        signatory: a.signatory,
        sequenceOrder: a.sequenceOrder,
        signatoryGroup: a.signatoryGroup,
      }));
  }

  const defaults = await prisma.clearanceDefaultSignatory.findMany({
    orderBy: { sequenceOrder: 'asc' },
    include: { signatory: true },
  });

  return defaults
    .filter((d) => d.signatory.isActive)
    .map((d) => ({
      signatory: d.signatory,
      sequenceOrder: d.sequenceOrder,
      signatoryGroup: d.signatory.signatoryGroup,
    }));
}
