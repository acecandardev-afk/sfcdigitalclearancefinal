import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canManageStudents } from '@/lib/permissionsMatrix';

function requireStudentAdmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && canManageStudents(roles));
}

const BodySchema = z.object({
  archive: z.boolean(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireStudentAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const id = ctx.params.id;
  const now = new Date();
  await prisma.profile.update({
    where: { id },
    data: {
      isArchived: parsed.data.archive,
      archivedAt: parsed.data.archive ? now : null,
    },
  });

  return NextResponse.json({ success: true });
}
