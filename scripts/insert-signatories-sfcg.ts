/**
 * Inserts the SFCG signatory roster and sets default clearance order (sequence 1–12).
 * Run: npx tsx scripts/insert-signatories-sfcg.ts
 *
 * Requires DATABASE_URL in .env
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Office column (short); position = full role / office line for officer display. */
const ROWS: { name: string; department: string; position: string; email: string }[] = [
  {
    name: 'Mr. Clairesean Paul P. Facultad',
    department: 'JPIC Office',
    position: 'JPIC Office',
    email: 'office.jpic.facultad@sfc-g.edu.ph',
  },
  {
    name: 'Sr. Nema C. Magarzo, FMIJ',
    department: 'CMO',
    position: 'CMO (3rd – 4th Year only)',
    email: 'office.cmo.magarzo@sfc-g.edu.ph',
  },
  {
    name: 'Fr. Prescilo Aba Salomon, OFM, LPT',
    department: 'Chaplaincy / OCES',
    position:
      'College Chaplain / Office of the Community Extension and Outreach Services (1st – 2nd Year only)',
    email: 'office.chaplain.salomon@sfc-g.edu.ph',
  },
  {
    name: 'Sr. Marife V. Rogel, FMIJ, LPT',
    department: 'Franciscan Wellness Center',
    position: 'Franciscan Wellness Center (Guidance)',
    email: 'office.guidance.rogel@sfc-g.edu.ph',
  },
  {
    name: 'Mrs. Jacqueline G. Amodia',
    department: 'Library',
    position: 'Library Staff',
    email: 'office.library.amodia@sfc-g.edu.ph',
  },
  {
    name: 'Mrs. Analyn P. Peñonal',
    department: 'Dispensary',
    position: 'Dispensary Office (1st year only)',
    email: 'office.dispensary.penonal@sfc-g.edu.ph',
  },
  {
    name: 'Ms. Ana Judy May Taganile, RN',
    department: 'Dispensary',
    position: 'Dispensary Office (1st year only)',
    email: 'office.dispensary.taganile@sfc-g.edu.ph',
  },
  {
    name: 'Mr. Randy S. Villejo, LPT',
    department: 'Prefect of Discipline',
    position: 'Prefect of Discipline',
    email: 'office.discipline.villejo@sfc-g.edu.ph',
  },
  {
    name: 'Ms. Merily Navallo',
    department: 'Registrar',
    position: 'Office of the College Registrar',
    email: 'office.registrar.navallo@sfc-g.edu.ph',
  },
  {
    name: 'Ms. Ma. Mailyn S. Bayoyos',
    department: 'Registrar',
    position: 'Office of the College Registrar',
    email: 'office.registrar.bayoyos@sfc-g.edu.ph',
  },
  {
    name: 'Mrs. Marjorie V. Sabejon',
    department: 'Finance',
    position: 'Finance Office',
    email: 'office.finance.sabejon@sfc-g.edu.ph',
  },
  {
    name: 'Mr. Ben Sta. Ana',
    department: 'Finance',
    position: 'Finance Office',
    email: 'office.finance.sta-ana@sfc-g.edu.ph',
  },
];

async function main() {
  console.log('Inserting', ROWS.length, 'signatories…');

  const createdIds: string[] = [];

  for (const row of ROWS) {
    const s = await prisma.signatory.create({
      data: {
        name: row.name,
        department: row.department,
        position: row.position,
        email: row.email,
        isActive: true,
        userId: null,
        signatoryGroup: 'standard',
        authoritySequenceOrder: null,
      },
    });
    createdIds.push(s.id);
    console.log('  ✓', row.name, '→', s.id);
  }

  console.log('Replacing default clearance signatory order (sequence 1–' + createdIds.length + ')…');
  await prisma.clearanceDefaultSignatory.deleteMany({});
  for (let i = 0; i < createdIds.length; i++) {
    await prisma.clearanceDefaultSignatory.create({
      data: {
        signatoryId: createdIds[i],
        sequenceOrder: i + 1,
      },
    });
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
