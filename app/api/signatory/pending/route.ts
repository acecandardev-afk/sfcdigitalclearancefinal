import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/server/db';

function requireSignatory(session: any) {
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('signatory'));
}

export async function GET() {
  const session = await getServerSession();
  if (!requireSignatory(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const signatory = await prisma.signatory.findUnique({
    where: { userId },
    select: { id: true, name: true, position: true, department: true },
  });

  if (!signatory) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sigs = await prisma.clearanceSignature.findMany({
    where: {
      signatoryId: signatory.id,
      status: { in: ['pending', 'in_progress'] as any },
    },
    orderBy: { clearanceRequest: { createdAt: 'desc' } },
    select: {
      id: true,
      signatoryId: true,
      status: true,
      notes: true,
      remarks: true,
      sequenceOrder: true,
      signatoryGroup: true,
      authoritySequenceOrder: true,
      clearanceRequest: {
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          studentId: true,
          student: { select: { profile: { select: { fullName: true, studentId: true, course: true, yearLevel: true } } } },
        },
      },
    },
  });

  const clearanceIds = Array.from(new Set(sigs.map((s) => s.clearanceRequest.id)));
  const allSigs = clearanceIds.length
    ? await prisma.clearanceSignature.findMany({
        where: { clearanceRequestId: { in: clearanceIds } },
        select: {
          id: true,
          status: true,
          sequenceOrder: true,
          clearanceRequestId: true,
          signatoryGroup: true,
          authoritySequenceOrder: true,
        },
      })
    : [];

  const allByClearance = new Map<string, typeof allSigs>();
  for (const s of allSigs) {
    const key = s.clearanceRequestId;
    const arr = allByClearance.get(key) ?? [];
    arr.push(s);
    allByClearance.set(key, arr);
  }

  const mapped = sigs.map((s) => {
    const all = allByClearance.get(s.clearanceRequest.id) ?? [];
    let canSign = false;
    if (s.status === 'pending') {
      const isAuthority = s.signatoryGroup === 'authority' && s.authoritySequenceOrder != null;
      if (!isAuthority) {
        canSign = true;
      } else {
        const prev = all.filter(
          (x) =>
            x.signatoryGroup === 'authority' &&
            x.authoritySequenceOrder != null &&
            (x.authoritySequenceOrder ?? 0) < (s.authoritySequenceOrder ?? 0)
        );
        canSign = prev.every((p) => p.status === 'approved');
      }
    }

    return {
      id: s.id,
      signatory_id: s.signatoryId,
      status: s.status,
      notes: s.notes ?? null,
      remarks: s.remarks ?? null,
      sequence_order: s.sequenceOrder,
      created_at: s.clearanceRequest.createdAt.toISOString(),
      signatory_group: s.signatoryGroup,
      authority_sequence_order: s.authoritySequenceOrder ?? null,
      canSign,
      clearance_request: {
        id: s.clearanceRequest.id,
        title: s.clearanceRequest.title,
        description: s.clearanceRequest.description,
        created_at: s.clearanceRequest.createdAt.toISOString(),
        profiles: {
          full_name: s.clearanceRequest.student.profile?.fullName ?? 'Unknown',
          student_id: s.clearanceRequest.student.profile?.studentId ?? null,
          course: s.clearanceRequest.student.profile?.course ?? null,
          year_level: s.clearanceRequest.student.profile?.yearLevel ?? null,
        },
      },
    };
  });

  return NextResponse.json({ signatory, signatures: mapped });
}
