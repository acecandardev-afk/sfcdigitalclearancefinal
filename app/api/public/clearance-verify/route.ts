import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { parseStudentClearanceVerifyToken } from '@/lib/studentClearanceVerifyToken';

/** Public read-only verification (no session). Rate-limit at edge in production. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const parsed = parseStudentClearanceVerifyToken(token);
  if (!parsed) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const cr = await prisma.clearanceRequest.findFirst({
    where: { id: parsed.clearanceRequestId, studentId: parsed.studentId },
    include: {
      student: { include: { profile: true } },
      signatures: {
        include: { signatory: { select: { name: true, department: true } } },
        orderBy: { sequenceOrder: 'asc' },
      },
    },
  });
  if (!cr) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    clearance_request_id: cr.id,
    status: cr.status,
    student: {
      name: cr.student.profile?.fullName ?? cr.student.email,
      student_id: cr.student.profile?.studentId ?? null,
    },
    steps: cr.signatures.map((s) => ({
      office: s.signatory.department,
      officer: s.signatory.name,
      status: s.status,
      signed_at: s.signedAt,
    })),
  });
}
