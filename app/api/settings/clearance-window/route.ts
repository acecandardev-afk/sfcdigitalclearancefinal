import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';

/** Any signed-in user — used for clearance period banner on student pages. */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const row = await prisma.systemSetting.findUnique({
    where: { key: 'clearance' },
    select: { valueJson: true },
  });

  return NextResponse.json({ value_json: row?.valueJson ?? null });
}
