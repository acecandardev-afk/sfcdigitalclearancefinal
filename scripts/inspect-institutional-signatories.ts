import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const signatories = await prisma.signatory.findMany({
    select: { id: true, name: true, department: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  const officeDefs = await prisma.institutionalOfficeDefinition.findMany({
    select: { id: true, sortOrder: true, departmentLabel: true, signatoryId: true },
    orderBy: { sortOrder: 'asc' },
  });

  const pendingItemsWithoutSignatory = await prisma.institutionalClearanceItem.count({
    where: {
      status: 'pending',
      signatoryId: null,
      clearance: { status: { in: ['pending', 'in_progress'] } },
    },
  });

  console.log('SIGNATORIES');
  console.log(JSON.stringify(signatories, null, 2));
  console.log('OFFICE_DEFINITIONS');
  console.log(JSON.stringify(officeDefs, null, 2));
  console.log('PENDING_ITEMS_WITHOUT_SIGNATORY', pendingItemsWithoutSignatory);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

