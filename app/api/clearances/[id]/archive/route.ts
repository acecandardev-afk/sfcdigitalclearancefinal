import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';
import { apiErrorResponse, apiValidationErrorResponse } from '@/server/apiUserError';
import { getClearanceRequestArchiveBlockers } from '@/server/archiveSafeguards';
import { NextResponse } from 'next/server';

const BodySchema = z.object({
  archive: z.boolean(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!session?.user) {
    return apiErrorResponse('Please sign in to continue.', 401);
  }

  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!canRequestStudentClearance(roles)) {
    return apiErrorResponse('You do not have permission to do that.', 403);
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  if (!parsed.data.archive) {
    return apiErrorResponse('Restoring archived clearance requests is not available here.', 400);
  }

  const userId = (session.user as { id: string }).id;
  const id = ctx.params.id;

  const blockers = await getClearanceRequestArchiveBlockers(prisma, id, userId);
  if (blockers.ok === false) {
    return apiErrorResponse(blockers.message, 400);
  }

  const now = new Date();
  await prisma.clearanceRequest.update({
    where: { id },
    data: { isArchived: true, archivedAt: now },
  });

  return NextResponse.json({ success: true });
}
