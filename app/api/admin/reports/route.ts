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
  const type = url.searchParams.get('type') || 'clearances';
  const allDates = url.searchParams.get('allDates') === '1' || url.searchParams.get('allDates') === 'true';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (type === 'clearances') {
    const clearanceStatus = url.searchParams.get('clearanceStatus');
    const where: Record<string, unknown> = {};
    if (clearanceStatus && clearanceStatus !== 'all') {
      where.status = clearanceStatus;
    }
    if (!allDates && from && to) {
      where.createdAt = {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      };
    }

    const rows = await prisma.clearanceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 2500,
      include: { student: { include: { profile: true } } },
    });

    const clearanceRows = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
      student_id: r.studentId,
      profiles: {
        full_name: r.student.profile?.fullName ?? 'Unknown',
        email: r.student.profile?.email ?? r.student.email,
        student_id: r.student.profile?.studentId ?? null,
        course: r.student.profile?.course ?? null,
        year_level: r.student.profile?.yearLevel ?? null,
      },
    }));

    return NextResponse.json({ clearances: clearanceRows });
  }

  if (type === 'signatures') {
    const signatureStatus = url.searchParams.get('signatureStatus');
    const signatureClearanceStatus = url.searchParams.get('signatureClearanceStatus');

    const sigWhere: Record<string, unknown> = {};
    if (signatureStatus && signatureStatus !== 'all') {
      sigWhere.status = signatureStatus;
    }
    if (!allDates && from && to) {
      sigWhere.createdAt = {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      };
    }
    if (signatureClearanceStatus && signatureClearanceStatus !== 'all') {
      sigWhere.clearanceRequest = { status: signatureClearanceStatus };
    }

    const sigs = await prisma.clearanceSignature.findMany({
      where: sigWhere,
      // Use id ordering for stable sort (avoids Prisma/client mismatches when createdAt migration not applied).
      orderBy: { id: 'desc' },
      take: 2500,
      include: {
        signatory: true,
        clearanceRequest: {
          include: { student: { include: { profile: true } } },
        },
      },
    });

    const signatureRows = sigs.map((s) => {
      const cr = s.clearanceRequest;
      const st = cr.student;
      const p = st.profile;
      return {
        id: s.id,
        clearance_request_id: cr.id,
        status: s.status,
        signed_at: s.signedAt?.toISOString() ?? null,
        // createdAt exists in schema/DB; some generated clients omit it from types until `prisma generate` matches migrations.
        created_at:
          (s as { createdAt?: Date | null }).createdAt?.toISOString() ?? s.signedAt?.toISOString() ?? null,
        sequence_order: s.sequenceOrder,
        notes: s.notes,
        remarks: s.remarks,
        signatories: {
          name: s.signatory.name,
          position: s.signatory.position,
          department: s.signatory.department,
          email: s.signatory.email,
        },
        clearance: {
          id: cr.id,
          title: cr.title,
          status: cr.status,
          created_at: cr.createdAt.toISOString(),
          student_id: cr.studentId,
        },
        student: {
          full_name: p?.fullName ?? '—',
          email: p?.email ?? st.email,
          student_id: p?.studentId ?? null,
          course: p?.course ?? null,
          year_level: p?.yearLevel ?? null,
        },
      };
    });

    return NextResponse.json({ signatures: signatureRows });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
