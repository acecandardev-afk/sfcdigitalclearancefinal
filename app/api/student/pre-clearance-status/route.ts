import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';
import { getStudentPreClearanceStatus } from '@/server/preClearanceService';

export async function GET() {
  const session = await getAppSession();
  const roles = ((session?.user as { roles?: string[] })?.roles ?? []) as string[];
  if (!session?.user || !canRequestStudentClearance(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as { id: string }).id;
  const preClearance = await getStudentPreClearanceStatus(studentId);

  return NextResponse.json({ preClearance });
}
