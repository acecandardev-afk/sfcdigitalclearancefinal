import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';

export async function GET() {
  const session = await getServerSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('signatory')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const signatory = await prisma.signatory.findUnique({
    where: { userId },
    select: { id: true, name: true, position: true, department: true },
  });

  if (!signatory) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ signatory });
}
