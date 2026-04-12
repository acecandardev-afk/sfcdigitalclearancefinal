/**
 * SignatoriesTableSeeder - Seeds signatories with SFCG offices and personnel.
 * Run: npm run seed:signatories
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  /* optional .env missing */
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env. Add to .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Standard Group (Flexible Order) - office/department, name(s)
const STANDARD_GROUP = [
  { position: 'CSSG Adviser / SASO Coordinator', department: 'CSSG/SASO', name: 'Ms. Mabelle Dumasapal / Mr. Alexander A. Bayot, Jr.', email: 'cssg@sfc-g.edu.ph' },
  { position: 'JPIC Office', department: 'JPIC', name: 'Mr. Clairesean Paul P. Facultad', email: 'jpic@sfc-g.edu.ph' },
  { position: 'CMO', department: 'CMO', name: 'Sr. Nema C. Magarzo', email: 'cmo@sfc-g.edu.ph' },
  { position: 'College Chaplain', department: 'Chaplaincy', name: 'Fr. Prescilo Aba Salomon', email: 'chaplain@sfc-g.edu.ph' },
  { position: 'Guidance', department: 'Guidance', name: 'Sr. Marife V. Rogel', email: 'guidance@sfc-g.edu.ph' },
  { position: 'Library', department: 'Library', name: 'Mrs. Jacqueline G. Amodia', email: 'library@sfc-g.edu.ph' },
  { position: 'Dispensary', department: 'Dispensary', name: 'Mrs. Analyn P. Peñonal / Ms. Ana Judy May Taganile', email: 'dispensary@sfc-g.edu.ph' },
  { position: 'Prefect of Discipline', department: 'Discipline', name: 'Mr. Randy S. Villejo', email: 'discipline@sfc-g.edu.ph' },
  { position: 'Registrar', department: 'Registrar', name: 'Ms. Merily Navallo / Ms. Ma. Mailyn S. Bayoyos', email: 'registrar@sfc-g.edu.ph' },
  { position: 'Finance', department: 'Finance', name: 'Mrs. Marjorie V. Sabejon / Mr. Ben Sta. Ana', email: 'finance@sfc-g.edu.ph' },
];

// Authority Group (Strict Sequence 1-5)
const AUTHORITY_GROUP = [
  { position: 'CCS Program Chair', department: 'CCS', name: 'Mr. Rex Agapito A. Geopano', email: 'ccs-chair@sfc-g.edu.ph', order: 1 },
  { position: 'VPSA', department: 'VPSA', name: 'Mr. Alexander A. Bayot, Jr.', email: 'vpsa@sfc-g.edu.ph', order: 2 },
  { position: 'VPAA', department: 'VPAA', name: 'Mr. Rex Agapito A. Geopano', email: 'vpaa@sfc-g.edu.ph', order: 3 },
  { position: 'College Dean', department: 'Dean', name: 'Br. Juanito O. Lebosada Jr.', email: 'dean@sfc-g.edu.ph', order: 4 },
  { position: 'College President', department: 'President', name: 'Fr. Jumil J. Alcasoda', email: 'president@sfc-g.edu.ph', order: 5 },
];

async function seed() {
  console.log('SignatoriesTableSeeder: Seeding signatories...\n');

  const signatoryIds: { id: string; signatory_group: string; authority_sequence_order: number | null; email: string }[] = [];

  const upsertSignatory = async (s: {
    name: string;
    position: string;
    department: string;
    email: string;
    is_active: boolean;
    signatory_group: 'standard' | 'authority';
    authority_sequence_order: number | null;
  }) => {
    const { data, error } = await supabase
      .from('signatories')
      .upsert(
        {
          name: s.name,
          position: s.position,
          department: s.department,
          email: s.email,
          is_active: s.is_active,
          signatory_group: s.signatory_group,
          authority_sequence_order: s.authority_sequence_order,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single();

    if (error) {
      console.error(`Error upserting ${s.department}:`, error.message);
      return null;
    }
    return data?.id ?? null;
  };

  // Insert Standard Group
  for (const s of STANDARD_GROUP) {
    const id = await upsertSignatory({
      name: s.name,
      position: s.position,
      department: s.department,
      email: s.email,
      is_active: true,
      signatory_group: 'standard',
      authority_sequence_order: null,
    });
    if (id) signatoryIds.push({ id, signatory_group: 'standard', authority_sequence_order: null, email: s.email });
  }
  console.log(`✓ ${STANDARD_GROUP.length} Standard Group signatories`);

  // Insert Authority Group
  for (const s of AUTHORITY_GROUP) {
    const id = await upsertSignatory({
      name: s.name,
      position: s.position,
      department: s.department,
      email: s.email,
      is_active: true,
      signatory_group: 'authority',
      authority_sequence_order: s.order,
    });
    if (id) signatoryIds.push({ id, signatory_group: 'authority', authority_sequence_order: s.order, email: s.email });
  }
  console.log(`✓ ${AUTHORITY_GROUP.length} Authority Group signatories`);

  // Set default signatory order (all 15 in sequence: standard 1-10, then authority 1-5)
  // Deterministic order based on the arrays above.
  const idByEmail = new Map(signatoryIds.map((s) => [s.email, s.id] as const));

  const orderedIds: string[] = [];
  for (const s of STANDARD_GROUP) {
    const id = idByEmail.get(s.email);
    if (id) orderedIds.push(id);
  }
  for (const s of AUTHORITY_GROUP) {
    const id = idByEmail.get(s.email);
    if (id) orderedIds.push(id);
  }

  await supabase.from('clearance_default_signatories').delete().gte('sequence_order', 0);
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('clearance_default_signatories').insert({
      signatory_id: orderedIds[i],
      sequence_order: i + 1,
    });
  }
  console.log('✓ Default signatory order set (Standard 1-10, Authority 1-5)');

  console.log('\nDone. Total signatories:', signatoryIds.length);
}

seed().catch(console.error);
