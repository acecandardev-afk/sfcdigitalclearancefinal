import { PrismaClient } from '@prisma/client';

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

  const officeDefs = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true, departmentLabel: true },
  });

  if (officeDefs.length === 0) {
    throw new Error('No institutional office definitions found.');
  }

  // Assign office definitions in order using available active signatories (wrap if fewer signatories than rows).
  for (let i = 0; i < officeDefs.length; i++) {
    const office = officeDefs[i];
    const assigned = signatories[i % signatories.length];
    await prisma.institutionalOfficeDefinition.update({
      where: { id: office.id },
      data: { signatoryId: assigned.id },
    });
  }

  const defsWithSignatory = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { sortOrder: true, departmentLabel: true, signatoryId: true },
  });
  const signatoryIdBySortOrder = new Map(
    defsWithSignatory
      .filter((d) => d.signatoryId)
      .map((d) => [d.sortOrder, d.signatoryId as string] as const)
  );

  // Backfill open institutional clearance items so pending queue shows names now.
  const openClearances = await prisma.institutionalClearance.findMany({
    where: { status: { in: ['pending', 'in_progress'] } },
    select: { id: true },
  });

  for (const c of openClearances) {
    const items = await prisma.institutionalClearanceItem.findMany({
      where: { institutionalClearanceId: c.id, signatoryId: null },
      select: { id: true, sortOrder: true },
    });
    for (const item of items) {
      const signatoryId = signatoryIdBySortOrder.get(item.sortOrder) ?? null;
      if (!signatoryId) continue;
      await prisma.institutionalClearanceItem.update({
        where: { id: item.id },
        data: { signatoryId },
      });
    }
  }

  const assignedDefs = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { signatory: { select: { name: true, department: true } } },
  });

  console.log('Assigned office definitions:');
  for (const row of assignedDefs) {
    console.log(
      `${row.sortOrder + 1}. ${row.departmentLabel} -> ${row.signatory?.name ?? '(none)'} (${row.signatory?.department ?? '-'})`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

