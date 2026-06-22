import { NextResponse } from 'next/server';
import { apiErrorResponse, apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canArchiveSignatory } from '@/lib/permissionsMatrix';
import { getSignatoryArchiveBlockers } from '@/server/archiveSafeguards';

const BodySchema = z.object({
  archive: z.boolean(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!session?.user || !canArchiveSignatory(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const id = ctx.params.id;
  const existing = await prisma.signatory.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const blockers = await getSignatoryArchiveBlockers(prisma, id, parsed.data.archive);
  if (blockers.ok === false) {
    return apiErrorResponse(blockers.message, 400);
  }

  const now = new Date();
  await prisma.signatory.update({
    where: { id },
    data: {
      isArchived: parsed.data.archive,
      archivedAt: parsed.data.archive ? now : null,
      ...(parsed.data.archive ? { isActive: false } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
