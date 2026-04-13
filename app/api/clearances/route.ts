import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';

function getRoles(session: any): string[] {
  return ((session as any)?.user?.roles ?? []) as string[];
}

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roles = getRoles(session);
  const isSuperadmin = roles.includes('superadmin');
  const isStudent = roles.includes('student');

  const where = isSuperadmin
    ? {}
    : isStudent
      ? { studentId: (session.user as any).id }
      : {};

  // For signatories we don't use this endpoint yet (they have dedicated endpoints)
  if (!isSuperadmin && !isStudent) {
    return NextResponse.json({ clearances: [] });
  }

  const rows = await prisma.clearanceRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      studentId: true,
      student: { select: { profile: { select: { fullName: true, studentId: true, course: true, yearLevel: true } } } },
      _count: { select: { signatures: true, files: true } },
    },
  });

  const mapped = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    student_id: r.studentId,
    signatures_count: r._count.signatures,
    files_count: r._count.files,
    student: {
      full_name: r.student.profile?.fullName ?? 'Unknown',
      student_id: r.student.profile?.studentId ?? null,
      course: r.student.profile?.course ?? null,
      year_level: r.student.profile?.yearLevel ?? null,
    },
  }));

  return NextResponse.json({ clearances: mapped });
}
