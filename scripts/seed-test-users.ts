/**
 * Seed test data for development.
 * Run: npm run seed
 *
 * Requires in .env:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (from Supabase Dashboard → Project Settings → API)
 *
 * Seeds:
 * - 10 signatories
 * - 100 students
 * - 50% completed, 5% not submitted, 20% with 5 more signatories needed (5/10), 25% with 90% done (9/10)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env. Add to .env:');
  if (!supabaseUrl) console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  if (!serviceRoleKey) console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEPARTMENTS = ['Registrar', 'Library', 'Finance', 'Guidance', 'Clinic', 'IT', 'HR', 'Academics', 'Student Affairs', 'Security'];
const COURSES = ['BSIT', 'BSCS', 'BSBA', 'BSEd', 'BSN', 'BSHM', 'BSTM', 'AB Comm', 'BS Psych', 'BS Crim'];
const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

async function seed() {
  console.log('Seeding test data...\n');

  // 1. Superadmin
  const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
    email: 'sfcadmin@test.com',
    password: 'test1234',
    email_confirm: true,
    user_metadata: { full_name: 'SFC Admin' },
  });

  if (adminErr && !adminErr.message?.includes('already been registered')) {
    console.error('Admin create error:', adminErr.message);
  } else if (adminData?.user) {
    await supabase.from('user_roles').delete().eq('user_id', adminData.user.id);
    await supabase.from('user_roles').insert({ user_id: adminData.user.id, role: 'superadmin' });
    console.log('✓ sfcadmin@test.com (superadmin)');
  } else {
    const { data: prof } = await supabase.from('profiles').select('id').eq('email', 'sfcadmin@test.com').single();
    if (prof) {
      await supabase.from('user_roles').delete().eq('user_id', prof.id);
      await supabase.from('user_roles').insert({ user_id: prof.id, role: 'superadmin' });
      console.log('✓ sfcadmin@test.com (superadmin) - role ensured');
    }
  }

  // 2. Create 10 signatories
  const signatoryNames = [
    'Registrar Office', 'Library Head', 'Finance Officer', 'Guidance Counselor',
    'Clinic Nurse', 'IT Coordinator', 'HR Manager', 'Academic Dean',
    'Student Affairs', 'Security Office',
  ];
  const signatoryIds: string[] = [];

  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabase
      .from('signatories')
      .select('id')
      .eq('email', `signatory${i + 1}@sfc-g.edu.ph`)
      .maybeSingle();

    if (existing) {
      signatoryIds.push(existing.id);
    } else {
      const { data: newSig, error } = await supabase
        .from('signatories')
        .insert({
          name: signatoryNames[i],
          position: `${DEPARTMENTS[i]} Head`,
          department: DEPARTMENTS[i],
          email: `signatory${i + 1}@sfc-g.edu.ph`,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) {
        console.error(`Signatory ${i + 1} error:`, error.message);
      } else if (newSig) {
        signatoryIds.push(newSig.id);
      }
    }
  }
  console.log(`✓ ${signatoryIds.length} signatories`);

  // 3. Set default signatory order (all 10 in sequence)
  await supabase.from('clearance_default_signatories').delete().gte('sequence_order', 0);
  for (let i = 0; i < signatoryIds.length; i++) {
    await supabase.from('clearance_default_signatories').insert({
      signatory_id: signatoryIds[i],
      sequence_order: i + 1,
    });
  }
  console.log('✓ Default signatory order (1–10)');

  // 4. Create student@test.com (50% clearance - 5/10 signatories)
  let studentTestId: string | null = null;
  const { data: studentTestData, error: studentTestErr } = await supabase.auth.admin.createUser({
    email: 'student@test.com',
    password: 'test1234',
    email_confirm: true,
    user_metadata: { full_name: 'Test Student' },
  });
  if (studentTestErr && !studentTestErr.message?.includes('already been registered')) {
    console.error('student@test.com create error:', studentTestErr.message);
  } else if (studentTestData?.user) {
    studentTestId = studentTestData.user.id;
  } else {
    const { data: prof } = await supabase.from('profiles').select('id').eq('email', 'student@test.com').single();
    if (prof) studentTestId = prof.id;
  }
  if (studentTestId) {
    await supabase.from('user_roles').delete().eq('user_id', studentTestId);
    await supabase.from('user_roles').insert({ user_id: studentTestId, role: 'student' });
    await supabase.from('profiles').update({
      student_id: '2024-00000',
      course: COURSES[0],
      year_level: YEAR_LEVELS[0],
    }).eq('id', studentTestId);
    console.log('✓ student@test.com (50% clearance)');
  }

  // 5. Create 100 students
  const studentIds: string[] = [];
  for (let i = 0; i < 100; i++) {
    const email = `student${i + 1}@test.com`;
    const { data: studentData, error } = await supabase.auth.admin.createUser({
      email,
      password: 'test1234',
      email_confirm: true,
      user_metadata: { full_name: `Student ${i + 1}` },
    });

    if (error) {
      if (error.message?.includes('already been registered')) {
        const { data: prof } = await supabase.from('profiles').select('id').eq('email', email).single();
        if (prof) studentIds.push(prof.id);
      } else {
        console.error(`Student ${email}:`, error.message);
      }
    } else if (studentData?.user) {
      studentIds.push(studentData.user.id);
    }
  }

  // Update profiles with student_id, course, year_level
  for (let i = 0; i < studentIds.length; i++) {
    await supabase.from('profiles').update({
      student_id: `2024-${String(i + 1).padStart(5, '0')}`,
      course: COURSES[i % COURSES.length],
      year_level: YEAR_LEVELS[i % YEAR_LEVELS.length],
    }).eq('id', studentIds[i]);
  }
  console.log(`✓ ${studentIds.length} students`);

  // 6. Create clearances per distribution
  // 5 not submitted (indices 0–4)
  // 50 completed (indices 5–54)
  // 20 with 5/10 done (indices 55–74)
  // 25 with 9/10 done (indices 75–99)

  const notSubmittedIds = studentIds.slice(0, 5);
  const completedIds = studentIds.slice(5, 55);
  const fiveMoreNeededIds = studentIds.slice(55, 75);
  const ninetyPercentIds = studentIds.slice(75, 100);

  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setDate(baseDate.getDate() - 14);

  // Helper to create clearance with signatures
  const createClearance = async (
    studentId: string,
    title: string,
    approvedCount: number,
    totalSignatures: number
  ) => {
    const created = new Date(baseDate);
    created.setDate(created.getDate() + Math.floor(Math.random() * 10));

    const { data: cr, error: crErr } = await supabase
      .from('clearance_requests')
      .insert({
        student_id: studentId,
        title,
        description: 'Clearance request for graduation',
        status: approvedCount === totalSignatures ? 'approved' : 'in_progress',
        created_at: created.toISOString(),
        updated_at: created.toISOString(),
      })
      .select('id')
      .single();

    if (crErr || !cr) return;

    for (let s = 0; s < totalSignatures; s++) {
      const isApproved = s < approvedCount;
      await supabase.from('clearance_signatures').insert({
        clearance_request_id: cr.id,
        signatory_id: signatoryIds[s],
        status: isApproved ? 'approved' : 'pending',
        sequence_order: s + 1,
        signed_at: isApproved ? created.toISOString() : null,
      });
    }
    return cr.id;
  };

  const titles = ['Graduation Clearance', 'Enrollment Clearance', 'Exit Clearance', 'Transfer Clearance', 'Completion Clearance'];

  // Clear existing clearances for our test students (for clean re-seed)
  const testStudentEmails = ['student@test.com', ...Array.from({ length: 100 }, (_, i) => `student${i + 1}@test.com`)];
  const { data: testProfiles } = await supabase.from('profiles').select('id').in('email', testStudentEmails);
  const testProfileIds = (testProfiles || []).map((p) => p.id);
  if (testProfileIds.length > 0) {
    const { data: existingCr } = await supabase.from('clearance_requests').select('id').in('student_id', testProfileIds);
    const crIds = (existingCr || []).map((c) => c.id);
    if (crIds.length > 0) {
      await supabase.from('clearance_signatures').delete().in('clearance_request_id', crIds);
      await supabase.from('clearance_requests').delete().in('id', crIds);
      console.log(`  Cleared ${crIds.length} existing clearances for re-seed`);
    }
  }

  // 50 completed (10/10)
  for (let i = 0; i < completedIds.length; i++) {
    await createClearance(completedIds[i], titles[i % titles.length], 10, 10);
  }
  console.log('✓ 50 students with completed clearance (10/10 signatories)');

  // 20 with 5/10 done
  for (let i = 0; i < fiveMoreNeededIds.length; i++) {
    await createClearance(fiveMoreNeededIds[i], titles[i % titles.length], 5, 10);
  }
  console.log('✓ 20 students with 5 more signatories needed (5/10 done)');

  // 25 with 9/10 done
  for (let i = 0; i < ninetyPercentIds.length; i++) {
    await createClearance(ninetyPercentIds[i], titles[i % titles.length], 9, 10);
  }
  console.log('✓ 25 students with 90% done (9/10 signatories)');

  // student@test.com: 50% clearance (5/10)
  if (studentTestId && signatoryIds.length >= 10) {
    await createClearance(studentTestId, 'Graduation Clearance', 5, 10);
    console.log('✓ student@test.com with 50% clearance (5/10 signatories)');
  }

  // 5 not submitted - no clearances
  console.log('✓ 5 students with no clearance submitted');

  console.log('\nDone. Distribution:');
  console.log('  50% (50) Completed');
  console.log('  5% (5) Not submitted');
  console.log('  20% (20) + student@test.com: 5 more signatories needed (5/10 = 50%)');
  console.log('  25% (25) 90% done (1 more needed)');
  console.log('\nLogins: sfcadmin@test.com / test1234');
  console.log('  student@test.com / test1234 (50% clearance)');
  console.log('  Students: student1@test.com … student100@test.com / test1234');
}

seed().catch(console.error);
