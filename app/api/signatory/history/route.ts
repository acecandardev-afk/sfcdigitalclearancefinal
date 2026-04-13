import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';

function requireSignatory(session: any) {
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('signatory'));
}

export async function GET() {
  const session = await getAppSession();
  if (!requireSignatory(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const signatory = await prisma.signatory.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!signatory) return NextResponse.json({ signatures: [] });

  const sigs = await prisma.clearanceSignature.findMany({
    where: {
      signatoryId: signatory.id,
      status: { in: ['approved', 'rejected'] as any },
    },
    orderBy: { signedAt: 'desc' },
    select: {
      id: true,
      status: true,
      remarks: true,
      signedAt: true,
      clearanceRequest: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          student: { select: { profile: { select: { fullName: true, studentId: true, course: true, yearLevel: true } } } },
        },
      },
    },
  });

  const mapped = sigs.map((s) => ({
    id: s.id,
    status: s.status,
    remarks: s.remarks ?? null,
    signed_at: s.signedAt ? s.signedAt.toISOString() : new Date().toISOString(),
    clearance_request: {
      id: s.clearanceRequest.id,
      title: s.clearanceRequest.title,
      description: s.clearanceRequest.description,
      status: s.clearanceRequest.status,
      created_at: s.clearanceRequest.createdAt.toISOString(),
      profiles: {
        full_name: s.clearanceRequest.student.profile?.fullName ?? 'Unknown',
        student_id: s.clearanceRequest.student.profile?.studentId ?? null,
        course: s.clearanceRequest.student.profile?.course ?? null,
        year_level: s.clearanceRequest.student.profile?.yearLevel ?? null,
      },
    },
  }));

  return NextResponse.json({ signatures: mapped });
}
