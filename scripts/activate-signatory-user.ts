/**
 * One-off: create Auth user for signatory1@sfc-g.edu.ph, link signatories row, set role signatory.
 * Run: npm run activate:signatory
 *
 * Requires: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY in .env
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
  /* no .env */
}

import { createClient } from '@supabase/supabase-js';

const EMAIL = 'signatory1@sfc-g.edu.ph';
const PASSWORD = 'test1234';
const DISPLAY_NAME = 'Signatory One';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveUserId(): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('id').eq('email', EMAIL).maybeSingle();
  if (error) {
    console.error('profiles lookup:', error.message);
    return null;
  }
  return data?.id ?? null;
}

async function main() {
  console.log(`Activating ${EMAIL} …\n`);

  // Ensure a signatories row exists for this email
  let { data: sig, error: sigLookupErr } = await supabase
    .from('signatories')
    .select('id, user_id, name')
    .eq('email', EMAIL)
    .maybeSingle();

  if (sigLookupErr) {
    console.error('signatories lookup:', sigLookupErr.message);
    process.exit(1);
  }

  if (!sig) {
    const { data: inserted, error: insErr } = await supabase
      .from('signatories')
      .insert({
        name: DISPLAY_NAME,
        position: 'Signatory',
        department: 'General',
        email: EMAIL,
        is_active: true,
        signatory_group: 'standard',
        authority_sequence_order: null,
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Could not insert signatory row:', insErr.message);
      process.exit(1);
    }
    sig = { id: inserted.id, user_id: null, name: DISPLAY_NAME };
    console.log('Created signatories row:', sig.id);
  } else {
    console.log('Found signatories row:', sig.id, sig.user_id ? '(already linked)' : '(no login yet)');
  }

  let userId: string | null = sig.user_id ?? null;

  if (!userId) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: sig.name || DISPLAY_NAME },
    });

    if (createErr) {
      const msg = createErr.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        console.log('Auth user already exists; resolving id from profiles…');
        userId = await resolveUserId();
      } else {
        console.error('createUser:', createErr.message);
        process.exit(1);
      }
    } else if (created.user) {
      userId = created.user.id;
      console.log('Created Auth user:', userId);
    }
  }

  if (!userId) {
    userId = await resolveUserId();
  }

  if (!userId) {
    console.error('Could not determine user id. Check Auth → Users for', EMAIL);
    process.exit(1);
  }

  const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (pwdErr) {
    console.warn('updateUser (password):', pwdErr.message);
  } else {
    console.log('Password and email confirmation updated.');
  }

  const { error: linkErr } = await supabase.from('signatories').update({ user_id: userId }).eq('id', sig.id);
  if (linkErr) {
    console.error('Link signatory → user:', linkErr.message);
    process.exit(1);
  }
  console.log('Linked signatories.user_id →', userId);

  await supabase.from('user_roles').delete().eq('user_id', userId);
  const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: userId, role: 'signatory' });
  if (roleErr) {
    console.error('user_roles:', roleErr.message);
    process.exit(1);
  }
  console.log('Set role: signatory');

  await supabase.from('profiles').update({ full_name: sig.name || DISPLAY_NAME }).eq('id', userId);

  console.log('\nDone. Login with:');
  console.log('  Email:', EMAIL);
  console.log('  Password:', PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
