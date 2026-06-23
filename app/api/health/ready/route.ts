import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

/** Readiness: database reachable + whether a superadmin exists (login needs seed/bootstrap). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const superadminCount = await prisma.userRole.count({ where: { role: 'superadmin' } });
    const dbHost = process.env.DATABASE_URL?.match(/@([^/?]+)/)?.[1] ?? null;
    return NextResponse.json({
      status: 'ready',
      database: 'ok',
      superadminCount,
      loginReady: superadminCount > 0,
      dbHost,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[health/ready]', e);
    return NextResponse.json(
      { status: 'not_ready', database: 'error', loginReady: false, ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}
