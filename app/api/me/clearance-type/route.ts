import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { canUseInstitutionalApp as canUseInstitutionalClearance, sessionRoles } from '@/lib/apiAuth';

const COOKIE = 'clearance_type';

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

/**
 * Synchronize clearance “mode” (student vs institutional) for the signed-in user.
 * `student` — any signed-in user. `institutional` — signatories and superadmins only.
 */
export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const body = await req.json().catch(() => ({}));
  const value = body?.value as string | undefined;
  if (value !== 'student' && value !== 'institutional') {
    return NextResponse.json({ error: 'Please choose a valid clearance type.' }, { status: 400 });
  }
  if (value === 'institutional' && !canUseInstitutionalClearance(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, value, cookieOptions(60 * 60 * 24 * 30));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  return res;
}
