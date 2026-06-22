import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canManageStudents } from '@/lib/permissionsMatrix';

function requireStudentAdmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && canManageStudents(roles));
}

const PatchSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  student_id: z.string().max(100).nullable().optional(),
  year_level: z.string().max(50).nullable().optional(),
  course: z.string().max(200).nullable().optional(),
  new_password: z.string().min(6).max(72).optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireStudentAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const id = ctx.params.id;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: true, profile: true },
  });
  if (!user?.profile) {
    return NextResponse.json({ error: 'That student could not be found.' }, { status: 404 });
  }
  const isStudent = user.roles.some((r) => r.role === 'student');
  if (!isStudent) {
    return NextResponse.json({ error: 'That account is not a student.' }, { status: 403 });
  }

  const p = parsed.data;
  const hasProfileUpdate =
    p.full_name != null ||
    p.student_id !== undefined ||
    p.year_level !== undefined ||
    p.course !== undefined;
  const hasPassword = Boolean(p.new_password);
  if (!hasProfileUpdate && !hasPassword) {
    return NextResponse.json({ error: 'Nothing was changed.' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (hasProfileUpdate) {
      await tx.profile.update({
        where: { id },
        data: {
          ...(p.full_name != null ? { fullName: p.full_name } : {}),
          ...(p.student_id !== undefined ? { studentId: p.student_id } : {}),
          ...(p.year_level !== undefined ? { yearLevel: p.year_level } : {}),
          ...(p.course !== undefined ? { course: p.course } : {}),
        },
      });
    }
    if (hasPassword && p.new_password) {
      const passwordHash = await bcrypt.hash(p.new_password, 10);
      await tx.user.update({ where: { id }, data: { passwordHash } });
    }
  });

  const updated = await prisma.profile.findUniqueOrThrow({ where: { id } });

  return NextResponse.json({
    student: {
      id: updated.id,
      full_name: updated.fullName,
      email: updated.email,
      student_id: updated.studentId,
      year_level: updated.yearLevel,
      course: updated.course,
      is_archived: updated.isArchived ?? false,
    },
  });
}
