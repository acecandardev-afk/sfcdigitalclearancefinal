import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canRequestStudentClearance, isHrAdmin, isStudentRecordsElevation } from '@/lib/permissionsMatrix';

function getRoles(session: any): string[] {
  return ((session as any)?.user?.roles ?? []) as string[];
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roles = getRoles(session);
  const isStaffAdmin = isStudentRecordsElevation(roles) || isHrAdmin(roles);
  const canRequest = canRequestStudentClearance(roles);

  const where = {
    isArchived: false,
    ...(isStaffAdmin ? {} : canRequest ? { studentId: (session.user as any).id } : {}),
  };

  // For signatories we don't use this endpoint yet (they have dedicated endpoints)
  if (!isStaffAdmin && !canRequest) {
    return NextResponse.json({ clearances: [] });
  }

  const url = new URL(req.url);
  const includeSignatures = url.searchParams.get('include') === 'signatures' && canRequest;

  if (includeSignatures) {
    const rows = await prisma.clearanceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        signatures: { include: { signatory: true }, orderBy: { sequenceOrder: 'asc' } },
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
      clearance_signatures: r.signatures.map((s) => ({
        id: s.id,
        status: s.status,
        sequence_order: s.sequenceOrder,
        signed_at: s.signedAt ? s.signedAt.toISOString() : null,
        signatories: {
          id: s.signatory.id,
          name: s.signatory.name,
          position: s.signatory.position,
          department: s.signatory.department,
        },
      })),
    }));

    return NextResponse.json({ clearances: mapped });
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
