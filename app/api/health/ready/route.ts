import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

/** Readiness: database reachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ready', database: 'ok', ts: new Date().toISOString() });
  } catch (e) {
    console.error('[health/ready]', e);
    return NextResponse.json(
      { status: 'not_ready', database: 'error', ts: new Date().toISOString() },
      { status: 503 },
    );
  }
}
