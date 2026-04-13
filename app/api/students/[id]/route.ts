import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const PatchSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  student_id: z.string().max(100).nullable().optional(),
  year_level: z.string().max(50).nullable().optional(),
  course: z.string().max(200).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.profile.update({
    where: { id: ctx.params.id },
    data: {
      ...(parsed.data.full_name != null ? { fullName: parsed.data.full_name } : {}),
      ...(parsed.data.student_id !== undefined ? { studentId: parsed.data.student_id } : {}),
      ...(parsed.data.year_level !== undefined ? { yearLevel: parsed.data.year_level } : {}),
      ...(parsed.data.course !== undefined ? { course: parsed.data.course } : {}),
    },
  });

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
