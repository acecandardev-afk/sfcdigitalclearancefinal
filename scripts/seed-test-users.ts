/**
 * Minimal reset seed.
 * Run: npm run seed
 *
 * Requires a Supabase project. Add to .env (run with: npm run seed:supabase):
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (from Supabase Dashboard → Project Settings → API)
 * For local Neon/Prisma + NextAuth, use: npm run seed (prisma/seed.ts) instead.
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
  console.error('Missing Supabase env. Add to .env:');
  if (!supabaseUrl) console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  if (!serviceRoleKey) console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error(
    'If you use Prisma/Neon + NextAuth (no Supabase auth), use: npm run seed',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'sfcadmin@test.com';
const SIGNATORY_EMAIL = 'signatory1@gmail.com';
const STUDENT_EMAIL = 'student1@test.com';
const DEFAULT_PASSWORD = 'test1234';

async function seed() {
  console.log('Resetting to minimal dataset...\n');

  const keepEmails = new Set([ADMIN_EMAIL, SIGNATORY_EMAIL, STUDENT_EMAIL]);

  // 1) Clear app data (clearances, signatures, files, assignments, activity logs)
  // Note: some tables may not exist depending on migration set; ignore missing-table errors.
  const tryDeleteAllByColumn = async (table: string, column: string) => {
    const { error } = await supabase.from(table).delete().neq(column, '__never__');
    if (error && !String(error.message || '').toLowerCase().includes('does not exist')) {
      console.warn(`Warn: failed to clear ${table}:`, error.message);
    }
  };

  await tryDeleteAllByColumn('clearance_files', 'file_path');
  await tryDeleteAllByColumn('clearance_signatures', 'clearance_request_id');
  await tryDeleteAllByColumn('clearance_requests', 'title');
  await tryDeleteAllByColumn('clearance_default_signatories', 'sequence_order');
  await tryDeleteAllByColumn('notifications', 'title');
  await tryDeleteAllByColumn('activity_logs', 'action');
  await tryDeleteAllByColumn('signatories', 'email');
  await tryDeleteAllByColumn('user_roles', 'role');

  // 2) Delete Auth users except whitelisted accounts
  // (This also cascades profiles/user_roles/signatures/requests via FK constraints)
  const listAllUsers = async () => {
    const users: { id: string; email: string | null }[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const batch = (data.users || []).map((u) => ({ id: u.id, email: u.email ?? null }));
      users.push(...batch);
      if (batch.length < perPage) break;
      page++;
    }
    return users;
  };

  const allUsers = await listAllUsers();
  for (const u of allUsers) {
    const email = (u.email || '').trim().toLowerCase();
    if (!email) continue;
    if (!keepEmails.has(email)) {
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (error) console.warn('Warn: deleteUser failed:', email, error.message);
    }
  }

  // 3) Ensure superadmin exists
  const ensureUser = async (email: string, fullName: string) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (!error && data?.user) return data.user.id;

    const { data: prof, error: profErr } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (profErr) throw profErr;
    if (!prof?.id) throw new Error(`Could not resolve user id for ${email}`);

    await supabase.auth.admin.updateUserById(prof.id, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    return prof.id;
  };

  const adminId = await ensureUser(ADMIN_EMAIL, 'SFC Admin');
  await supabase.from('user_roles').delete().eq('user_id', adminId);
  await supabase.from('user_roles').insert({ user_id: adminId, role: 'superadmin' });

  // 4) Ensure signatory exists and linked
  const signatoryUserId = await ensureUser(SIGNATORY_EMAIL, 'Signatory One');
  await supabase.from('user_roles').delete().eq('user_id', signatoryUserId);
  await supabase.from('user_roles').insert({ user_id: signatoryUserId, role: 'signatory' });
  const { data: sigRow, error: sigErr } = await supabase
    .from('signatories')
    .insert({
      user_id: signatoryUserId,
      name: 'Signatory One',
      position: 'Signatory',
      department: 'General',
      email: SIGNATORY_EMAIL,
      is_active: true,
    })
    .select('id')
    .single();
  if (sigErr) throw sigErr;
  await supabase.from('clearance_default_signatories').insert({ signatory_id: sigRow.id, sequence_order: 1 });

  // 5) Ensure one student exists
  const studentId = await ensureUser(STUDENT_EMAIL, 'Student One');
  await supabase.from('user_roles').delete().eq('user_id', studentId);
  await supabase.from('user_roles').insert({ user_id: studentId, role: 'student' });
  await supabase.from('profiles').update({ student_id: '2024-00001', year_level: '1st Year', course: 'BSIT' }).eq('id', studentId);

  console.log('\nDone. Minimal logins:');
  console.log(`  ${ADMIN_EMAIL} / ${DEFAULT_PASSWORD} (superadmin)`);
  console.log(`  ${SIGNATORY_EMAIL} / ${DEFAULT_PASSWORD} (signatory)`);
  console.log(`  ${STUDENT_EMAIL} / ${DEFAULT_PASSWORD} (student)`);
}

seed().catch(console.error);
