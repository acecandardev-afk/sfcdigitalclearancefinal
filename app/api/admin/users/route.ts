import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

export async function GET() {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    include: { profile: true, roles: true },
    orderBy: { email: 'asc' },
  });

  const mapped = users.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.profile?.fullName ?? u.email,
    roles: u.roles.map((r) => r.role),
  }));

  return NextResponse.json({ users: mapped });
}
