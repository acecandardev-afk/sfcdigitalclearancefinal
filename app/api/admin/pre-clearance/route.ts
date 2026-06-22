import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import {
  gatesUserMayVerify,
  getStudentPreClearanceStatus,
  userHasPreClearanceVerificationAccess,
} from '@/server/preClearanceService';
import { PRE_CLEARANCE_GATES } from '@/lib/preClearanceGates';

export async function GET(req: Request) {
  const session = await getAppSession();
  const userId = (session?.user as { id?: string })?.id;
  const roles = ((session?.user as { roles?: string[] })?.roles ?? []) as string[];
  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await userHasPreClearanceVerificationAccess(userId, roles);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') ?? '').trim();

  const allowedGates = await gatesUserMayVerify(userId, roles);

  if (!search) {
    return NextResponse.json({
      allowedGates,
      gateDefinitions: PRE_CLEARANCE_GATES,
      students: [],
    });
  }

  const students = await prisma.user.findMany({
    where: {
      roles: { some: { role: Role.student } },
      profile: {
        isArchived: false,
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentId: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
    },
    take: 25,
    include: {
      profile: { select: { fullName: true, studentId: true, course: true, yearLevel: true, email: true } },
    },
    orderBy: { profile: { fullName: 'asc' } },
  });

  const withStatus = await Promise.all(
    students.map(async (s) => {
      const status = await getStudentPreClearanceStatus(s.id);
      return {
        id: s.id,
        email: s.email,
        full_name: s.profile?.fullName ?? '—',
        student_id: s.profile?.studentId ?? '—',
        course: s.profile?.course ?? '—',
        year_level: s.profile?.yearLevel ?? '—',
        preClearance: status,
      };
    })
  );

  return NextResponse.json({
    allowedGates,
    gateDefinitions: PRE_CLEARANCE_GATES,
    students: withStatus,
  });
}

const PostBody = z.object({
  studentId: z.string().min(1),
  gate: z.enum(['faculty', 'cmo', 'guidance']),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  const userId = (session?.user as { id?: string })?.id;
  const roles = ((session?.user as { roles?: string[] })?.roles ?? []) as string[];
  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const canVerify = await gatesUserMayVerify(userId, roles);
  if (!canVerify.includes(parsed.data.gate)) {
    return NextResponse.json({ error: 'You do not have permission to verify this office.' }, { status: 403 });
  }

  const student = await prisma.user.findFirst({
    where: {
      id: parsed.data.studentId,
      roles: { some: { role: Role.student } },
      profile: { isArchived: false },
    },
    select: { id: true },
  });
  if (!student) {
    return NextResponse.json({ error: 'We could not find that student.' }, { status: 404 });
  }

  await prisma.studentPreClearanceVerification.upsert({
    where: {
      studentId_gate: { studentId: parsed.data.studentId, gate: parsed.data.gate },
    },
    create: {
      studentId: parsed.data.studentId,
      gate: parsed.data.gate,
      verifiedByUserId: userId,
      notes: parsed.data.notes?.trim() || null,
    },
    update: {
      verifiedAt: new Date(),
      verifiedByUserId: userId,
      notes: parsed.data.notes?.trim() || null,
    },
  });

  const status = await getStudentPreClearanceStatus(parsed.data.studentId);
  return NextResponse.json({ ok: true, preClearance: status });
}
