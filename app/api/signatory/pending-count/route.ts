import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { resolveSignatoryForSessionUser } from '@/server/resolveSignatoryForSessionUser';

function requireSignatory(session: unknown) {
  const roles = ((session as { user?: { roles?: string[] } })?.user?.roles ?? []) as string[];
  return Boolean((session as { user?: unknown })?.user && roles.includes('signatory'));
}

/** Lightweight count for nav badges (student clearance signatures awaiting this signatory). */
export async function GET() {
  const session = await getAppSession();
  if (!requireSignatory(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signatory = await resolveSignatoryForSessionUser(prisma, userId);

  if (!signatory) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.clearanceSignature.count({
    where: {
      signatoryId: signatory.id,
      status: { in: ['pending', 'in_progress'] },
    },
  });

  return NextResponse.json({ count });
}
