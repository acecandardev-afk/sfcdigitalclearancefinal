import { PrismaClient } from '@prisma/client';
import { INSTITUTIONAL_CLEARANCE_OFFICE_ROWS } from '../src/lib/institutionalOffices';

const prisma = new PrismaClient();

async function main() {
  const signatories = await prisma.signatory.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, department: true },
  });

  if (signatories.length === 0) {
    throw new Error('No active signatories found.');
  }

  const existing = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });

  const targetRows = [...INSTITUTIONAL_CLEARANCE_OFFICE_ROWS];

  for (let i = 0; i < targetRows.length; i++) {
    const label = targetRows[i];
    const assigned = signatories[i % signatories.length];
    const row = existing[i];
    if (row) {
      await prisma.institutionalOfficeDefinition.update({
        where: { id: row.id },
        data: {
          sortOrder: i,
          departmentLabel: label,
          signatoryId: assigned.id,
        },
      });
    } else {
      await prisma.institutionalOfficeDefinition.create({
        data: {
          sortOrder: i,
          departmentLabel: label,
          signatoryId: assigned.id,
        },
      });
    }
  }

  // Remove extra old definitions beyond the form row count.
  if (existing.length > targetRows.length) {
    const staleIds = existing.slice(targetRows.length).map((r) => r.id);
    await prisma.institutionalOfficeDefinition.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  const defs = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { signatory: { select: { id: true, name: true, department: true } } },
  });

  const signatoryIdBySortOrder = new Map(
    defs.filter((d) => d.signatoryId).map((d) => [d.sortOrder, d.signatoryId as string] as const)
  );

  // Backfill pending open requests so current queue immediately shows names.
  const pendingItems = await prisma.institutionalClearanceItem.findMany({
    where: {
      signatoryId: null,
      status: 'pending',
      clearance: { status: { in: ['pending', 'in_progress'] } },
    },
    select: { id: true, sortOrder: true },
  });

  for (const item of pendingItems) {
    const assigned = signatoryIdBySortOrder.get(item.sortOrder);
    if (!assigned) continue;
    await prisma.institutionalClearanceItem.update({
      where: { id: item.id },
      data: { signatoryId: assigned },
    });
  }

  console.log('Institutional office definitions synced from form:');
  defs.forEach((d) => {
    console.log(
      `${d.sortOrder + 1}. ${d.departmentLabel} -> ${d.signatory?.name ?? '(none)'} (${d.signatory?.department ?? '-'})`
    );
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

