import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { include: { profile: true } } },
  });

  const rows = logs.map((log) => ({
    id: log.id,
    user_id: log.userId,
    action: log.action,
    details: log.details,
    user_agent: log.userAgent,
    created_at: log.createdAt.toISOString(),
    user_email: log.user.profile?.email ?? log.user.email,
    user_name: log.user.profile?.fullName ?? log.user.email,
  }));

  return NextResponse.json({ logs: rows });
}
