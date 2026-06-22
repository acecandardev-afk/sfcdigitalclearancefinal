import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { resolveSignatoryForSessionUser } from '@/server/resolveSignatoryForSessionUser';

export async function GET() {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('signatory')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signatory = await resolveSignatoryForSessionUser(prisma, userId);

  if (!signatory) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ signatory });
}
