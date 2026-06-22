import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness: process is up (for load balancers / k8s). */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'digital-clearance',
    ts: new Date().toISOString(),
  });
}
