/**
 * Postgres (Prisma) seed after `prisma migrate reset`:
 *   - Superadmin (required env)
 *   - Staff: optional employee user (passwords per env; see below)
 *   - Saint Francis College Guihulngan student clearance: **all** `signatories` rows are removed then 15 rows
 *     are created with logins `signatory1@gmail.com` … `signatory15@gmail.com` (registrar form names/positions)
 *     + rebuilt `clearance_default_signatories`. Each signatory gets document + physical + office requirements.
 *   - Institutional: `institutional_office_definitions` replaced, then 21 signatories
 *     `institutional1@gmail.com` … `institutional21@gmail.com` linked to each definition row (HRMDO line gets cert role `hrmdo`).
 *     Each institutional signatory gets the same three default requirements.
 *
 * Set in .env:
 *   DATABASE_URL=postgresql://...
 *   SEED_ADMIN_EMAIL=...
 *   SEED_ADMIN_PASSWORD=...   (min 6 chars)
 *   SEED_ADMIN_FULL_NAME=...  (optional)
 *
 * Optional (defaults shown):
 *   SEED_EMPLOYEE_EMAIL=employee@test.com
 *   SEED_STAFF_PASSWORD=...        (fallback for staff passwords)
 *   SEED_INSTITUTIONAL_PASSWORD=... (employee user: overrides staff fallback)
 *   SEED_SIGNATORY_PASSWORD=...   (all seeded signatory logins: student rows signatory1..N@gmail.com,
 *                                    institutional rows institutional1..N@gmail.com; falls back to STAFF/ADMIN)
 *
 * Run: npx prisma db seed   OR   npm run seed
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env');
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  /* optional .env */
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedDefaultSignatoryRequirements } from '../src/lib/defaultSignatoryRequirements';

const prisma = new PrismaClient();

async function seedSuperadmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  const fullName = (process.env.SEED_ADMIN_FULL_NAME || 'Administrator').trim() || 'Administrator';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Set SEED_ADMIN_EMAIL to a valid email in .env');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Set SEED_ADMIN_PASSWORD to at least 6 characters in .env');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            email,
            fullName,
          },
        },
        roles: {
          create: [{ role: 'superadmin' }],
        },
      },
    });
    console.log(`Created superadmin: ${email}`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  const hasSuperadmin = existing.roles.some((r) => r.role === 'superadmin');
  if (!hasSuperadmin) {
    await prisma.userRole.create({
      data: { userId: existing.id, role: 'superadmin' },
    });
  }

  await prisma.profile.upsert({
    where: { id: existing.id },
    create: {
      id: existing.id,
      email,
      fullName,
    },
    update: {
      email,
      fullName,
    },
  });

  console.log(`Updated superadmin (password + profile; superadmin role ensured): ${email}`);
}

async function ensureEmployee(email: string, passwordHash: string) {
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: true, profile: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            email,
            fullName: 'Staff — Employee',
            course: 'Office of the Registrar',
            yearLevel: 'Administrative staff',
          },
        },
        roles: { create: [{ role: 'employee' }] },
      },
    });
    console.log(`Created employee user: ${email}`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });
  if (!existing.roles.some((r) => r.role === 'employee')) {
    await prisma.userRole.create({ data: { userId: existing.id, role: 'employee' } });
  }
  if (!existing.profile) {
    await prisma.profile.create({
      data: {
        id: existing.id,
        email,
        fullName: 'Staff — Employee',
        course: 'Office of the Registrar',
        yearLevel: 'Administrative staff',
      },
    });
  } else {
    await prisma.profile.update({
      where: { id: existing.id },
      data: {
        email: existing.profile.email || email,
        fullName: existing.profile.fullName || 'Staff — Employee',
      },
    });
  }
  console.log(`Updated employee user: ${email}`);
}

/** Login user for a signatory row (no `Signatory` row created here). */
async function upsertSignatoryLoginUser(email: string, passwordHash: string, profileFullName: string) {
  let user = await prisma.user.findUnique({
    where: { email },
    include: { roles: true, profile: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            email,
            fullName: profileFullName.slice(0, 500),
            course: 'Clearance',
            yearLevel: 'Signatory',
          },
        },
        roles: { create: [{ role: 'signatory' }] },
      },
      include: { roles: true, profile: true },
    });
    console.log(`Created signatory user: ${email}`);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    if (!user.roles.some((r) => r.role === 'signatory')) {
      await prisma.userRole.create({ data: { userId: user.id, role: 'signatory' } });
    }
    if (!user.profile) {
      await prisma.profile.create({
        data: {
          id: user.id,
          email,
          fullName: profileFullName.slice(0, 500),
          course: 'Clearance',
          yearLevel: 'Signatory',
        },
      });
    } else {
      await prisma.profile.update({
        where: { id: user.id },
        data: { fullName: profileFullName.slice(0, 500), email: user.profile.email || email },
      });
    }
    console.log(`Updated signatory user: ${email}`);
  }

  return user;
}

function studentClearanceSeedEmail(seq: number) {
  return `signatory${seq}@gmail.com`;
}

function institutionalSeedEmail(seq: number) {
  return `institutional${seq}@gmail.com`;
}

/**
 * Registrar student clearance form (Saint Francis College Guihulngan): designated personnel (`name`)
 * and Office/Role (`position`) per row. `department` is the form section. Default order: Part I offices
 * then Part II authority signatures.
 */
/** Typed so `authorityRank` is required only when `group` is `'authority'`. */
type SfcgStudentClearanceRow =
  | {
      name: string;
      position: string;
      department: string;
      group: 'standard';
    }
  | {
      name: string;
      position: string;
      department: string;
      group: 'authority';
      authorityRank: number;
    };

const SFCG_STUDENT_CLEARANCE_SIGNATORIES: readonly SfcgStudentClearanceRow[] = [
  {
    name: 'MS. MABELLE DUMASAPAL / MR. ALEXANDER A. BAYOT, JR., LPT',
    position: 'CSSG Adviser / SASO Coordinator',
    department: 'Student & Academic Leadership',
    group: 'standard' as const,
  },
  {
    name: 'MR. CLAIRESEAN PAUL P. FACULTAD',
    position: 'JPIC Office',
    department: 'Student & Academic Leadership',
    group: 'standard' as const,
  },
  {
    name: 'SR. NEMA C. MAGARZO, FMU',
    position: 'CMO (Campus Ministry Office) – for 3rd–4th Year only',
    department: 'Student & Academic Leadership',
    group: 'standard' as const,
  },
  {
    name: 'FR. PRESCILO ABA SALOMON, OFM, LPT',
    position:
      'College Chaplain / Office of the Community Extension and Outreach Services – for 1st–2nd Year only',
    department: 'Student & Academic Leadership',
    group: 'standard' as const,
  },
  {
    name: 'SR. MARIFE V. ROGEL, FMU, LPT',
    position: 'Franciscan Wellness Center (Guidance)',
    department: 'Student & Academic Leadership',
    group: 'standard' as const,
  },
  {
    name: 'MRS. JACQUELINE G. AMODIA',
    position: 'Library Staff',
    department: 'Support & Administrative Services',
    group: 'standard' as const,
  },
  {
    name: 'MRS. ANALYN P. PEÑONAL / MS. ANA JUDY MAY TAGANILE, RN',
    position: 'Dispensary Office',
    department: 'Support & Administrative Services',
    group: 'standard' as const,
  },
  {
    name: 'MR. RANDY S. VILLEJO, LPT',
    position: 'Prefect of Discipline',
    department: 'Support & Administrative Services',
    group: 'standard' as const,
  },
  {
    name: 'MS. MERILY NAVALLO / MS. MA. MAILYN S. BAYOYS',
    position: 'Office of the College Registrar',
    department: 'Support & Administrative Services',
    group: 'standard' as const,
  },
  {
    name: 'MRS. MARIORIE V. SABEJON / MR. BEN STA. ANA / MR. JEFF TYRON A. PIPO',
    position: 'Finance Office',
    department: 'Support & Administrative Services',
    group: 'standard' as const,
  },
  {
    name: 'MR. JOSEPH T. ALILING / MR. MIKE O. VERGARA / MR. JIMMY M. TEREC',
    position: 'ICT Office',
    department: 'Support & Administrative Services',
    group: 'standard' as const,
  },
  {
    name: 'MR. REX AGAPITO A. GEOPANO, MAT-CS',
    position: 'CCS Program Chair & Vice President for Academic Affairs',
    department: 'Program & College Administration',
    group: 'authority' as const,
    authorityRank: 1,
  },
  {
    name: 'MR. ALEXANDER A. BAYOT, JR., LPT',
    position: 'Vice President for Student Affairs',
    department: 'Program & College Administration',
    group: 'authority' as const,
    authorityRank: 2,
  },
  {
    name: 'BR. JUANITO O. LEBOSADA JR., OFM, Ed.D.',
    position: 'College Dean',
    department: 'Program & College Administration',
    group: 'authority' as const,
    authorityRank: 3,
  },
  {
    name: 'FR. JUMIL J. ALCASODA, OFM, LPT, MAED',
    position: 'College President',
    department: 'Program & College Administration',
    group: 'authority' as const,
    authorityRank: 4,
  },
];

async function seedSaintFrancisGuihulnganStudentClearanceSignatories(signatoryPasswordHash: string) {
  /** Replace entire signatory set: cascades remove signatures, default order, assignments, requirements, step notes, etc. */
  const removed = await prisma.signatory.deleteMany({});
  console.log(`Student clearance: removed ${removed.count} existing signatory row(s).`);

  const idsInOrder: string[] = [];

  for (let i = 0; i < SFCG_STUDENT_CLEARANCE_SIGNATORIES.length; i++) {
    const row = SFCG_STUDENT_CLEARANCE_SIGNATORIES[i]!;
    const email = studentClearanceSeedEmail(i + 1);
    const isAuthority = row.group === 'authority';
    const authoritySequenceOrder = row.group === 'authority' ? row.authorityRank : null;

    const user = await upsertSignatoryLoginUser(email, signatoryPasswordHash, row.name);

    const sig = await prisma.signatory.create({
      data: {
        email,
        name: row.name,
        position: row.position,
        department: row.department,
        isActive: true,
        userId: user.id,
        signatoryGroup: isAuthority ? 'authority' : 'standard',
        authoritySequenceOrder,
        institutionalCertRole: 'none',
      },
    });

    await seedDefaultSignatoryRequirements(prisma, sig.id);

    idsInOrder.push(sig.id);
  }

  await prisma.clearanceDefaultSignatory.deleteMany({});

  for (let o = 0; o < idsInOrder.length; o++) {
    await prisma.clearanceDefaultSignatory.create({
      data: {
        signatoryId: idsInOrder[o]!,
        sequenceOrder: o + 1,
      },
    });
  }

  console.log(
    `Student clearance: seeded ${idsInOrder.length} SFC Guihulngan signatories (signatory1..${idsInOrder.length}@gmail.com; default order rebuilt).`,
  );
}

/**
 * Section II line labels: role / signer type — department or office (employee institutional clearance).
 * Replaces all rows in `institutional_office_definitions` (signatoryId null; linked in the next seed step).
 */
const INSTITUTIONAL_OFFICE_DEFINITION_LABELS: readonly string[] = [
  "Immediate Department Head — Employee's assigned department",
  'Dean / Principal — Academic Administration',
  'Human Resource Management Office Personnel — HRMDO',
  'Vice President for Administration — Administration Office',
  'Vice President for Academic Affairs — Academic Affairs Office',
  'Vice President for Student Affairs — Student Affairs Office',
  'Vice President for Finance — Finance Office',
  'Accounting / Bookkeeper — Accounting Office',
  'Disbursing Officer — Disbursing Office',
  'Canteen Personnel — Canteen',
  'Supply and Property Management Personnel — Supply and Property Management Office',
  'Librarian / Library Staff — Library',
  "Registrar Personnel — Registrar's Office",
  'ICT Personnel — ICT Office',
  'Guidance Personnel — Guidance Office',
  'Campus Ministry Personnel — Campus Ministry',
  'Chaplain / General Services Personnel — Chaplain / General Services',
  'Security Office / Head Guard — Security Office',
  'Planning and Quality Assurance Personnel — Planning and Quality Assurance Office',
  'Alumni Affairs Personnel — Alumni Affairs',
  'Dispensary Personnel — Dispensary / Health Services',
];

async function seedInstitutionalOfficeDefinitions() {
  await prisma.institutionalOfficeDefinition.deleteMany({});

  for (let i = 0; i < INSTITUTIONAL_OFFICE_DEFINITION_LABELS.length; i++) {
    await prisma.institutionalOfficeDefinition.create({
      data: {
        sortOrder: i,
        departmentLabel: INSTITUTIONAL_OFFICE_DEFINITION_LABELS[i]!,
        signatoryId: null,
      },
    });
  }

  console.log(
    `Institutional clearance: seeded ${INSTITUTIONAL_OFFICE_DEFINITION_LABELS.length} office definition rows.`,
  );
}

/** Split template label "Role — Office" into signatory name / position when possible. */
function splitInstitutionalLabel(line: string): { name: string; position: string } {
  const sep = ' — ';
  const idx = line.indexOf(sep);
  if (idx !== -1) {
    return {
      name: line.slice(0, idx).trim(),
      position: line.slice(idx + sep.length).trim(),
    };
  }
  return { name: line.trim(), position: 'Institutional clearance' };
}

/**
 * One login + `Signatory` per office definition row; emails institutional1@gmail.com, …
 * Links each `institutional_office_definitions` row to its signatory.
 */
async function seedInstitutionalSignatoriesAndLinkOffices(signatoryPasswordHash: string) {
  const defs = await prisma.institutionalOfficeDefinition.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!;
    const seq = i + 1;
    const email = institutionalSeedEmail(seq);
    const { name, position } = splitInstitutionalLabel(def.departmentLabel);
    const label = def.departmentLabel;
    const institutionalCertRole = /HRMDO|Human Resource Management/i.test(label) ? 'hrmdo' : 'none';

    const displayName = (name || `Institutional office (${seq})`).slice(0, 500);
    const user = await upsertSignatoryLoginUser(email, signatoryPasswordHash, displayName);

    const sig = await prisma.signatory.create({
      data: {
        email,
        name: name || `Institutional office (${seq})`,
        position: position || 'Institutional clearance',
        department: 'Employee institutional clearance',
        isActive: true,
        userId: user.id,
        signatoryGroup: 'standard',
        authoritySequenceOrder: null,
        institutionalCertRole,
      },
    });

    await seedDefaultSignatoryRequirements(prisma, sig.id);

    await prisma.institutionalOfficeDefinition.update({
      where: { id: def.id },
      data: { signatoryId: sig.id },
    });
  }

  console.log(
    `Institutional clearance: created ${defs.length} signatory login(s) (institutional1..${defs.length}@gmail.com) and linked office definitions.`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Add your Postgres URL to .env');
    process.exit(1);
  }

  await seedSuperadmin();

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();

  const employeeEmail = (process.env.SEED_EMPLOYEE_EMAIL || 'employee@test.com').trim().toLowerCase();

  if (employeeEmail === adminEmail) {
    console.warn(`Skipping employee seed: SEED_EMPLOYEE_EMAIL matches admin (${adminEmail}).`);
  } else {
    const employeePassword = (
      process.env.SEED_INSTITUTIONAL_PASSWORD ||
      process.env.SEED_STAFF_PASSWORD ||
      process.env.SEED_ADMIN_PASSWORD ||
      ''
    ).trim();
    if (employeePassword.length < 6) {
      console.error(
        'Employee seed needs SEED_INSTITUTIONAL_PASSWORD, SEED_STAFF_PASSWORD, or SEED_ADMIN_PASSWORD (min 6 characters).',
      );
      process.exit(1);
    }
    const hash = await bcrypt.hash(employeePassword, 10);
    await ensureEmployee(employeeEmail, hash);
  }

  const signatoryPassword = (
    process.env.SEED_SIGNATORY_PASSWORD ||
    process.env.SEED_STAFF_PASSWORD ||
    process.env.SEED_ADMIN_PASSWORD ||
    ''
  ).trim();
  if (signatoryPassword.length < 6) {
    console.error(
      'Student + institutional signatory seeds need SEED_SIGNATORY_PASSWORD, SEED_STAFF_PASSWORD, or SEED_ADMIN_PASSWORD (min 6 characters).',
    );
    process.exit(1);
  }
  const signatoryPasswordHash = await bcrypt.hash(signatoryPassword, 10);

  await seedSaintFrancisGuihulnganStudentClearanceSignatories(signatoryPasswordHash);
  await seedInstitutionalOfficeDefinitions();
  await seedInstitutionalSignatoriesAndLinkOffices(signatoryPasswordHash);

  console.log(
    '\nSeed finished (superadmin; student signatories signatory1..15@gmail.com; institutional signatories institutional1..21@gmail.com; office definitions; employee where applicable).',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
