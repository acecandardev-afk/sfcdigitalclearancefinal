import type { Prisma } from '@prisma/client';
import { staticOfficeItemCreates } from '@/lib/institutionalOffices';

/**
 * Build Section II line items for a new institutional clearance.
 * Prefers `institutional_office_definitions` (configurable in admin). Falls back to code defaults if the table is empty.
 */
export async function getOfficeItemCreatesForNewClearance(
  tx: Prisma.TransactionClient
): Promise<Prisma.InstitutionalClearanceItemCreateWithoutClearanceInput[]> {
  const defs = await tx.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  if (defs.length === 0) {
    return staticOfficeItemCreates() as Prisma.InstitutionalClearanceItemCreateWithoutClearanceInput[];
  }
  return defs.map((d) => ({
    signatoryId: d.signatoryId,
    departmentLabel: d.departmentLabel,
    sortOrder: d.sortOrder,
    status: 'pending' as const,
  }));
}
