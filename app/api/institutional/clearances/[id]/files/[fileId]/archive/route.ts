import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, canUseInstitutionalApp, sessionRoles } from '@/lib/apiAuth';
import { apiErrorResponse } from '@/server/apiUserError';
import { NextResponse } from 'next/server';

function canAccessFileRoute(userId: string, requesterId: string, roles: string[]) {
  if (!canUseInstitutionalApp(roles)) return false;
  if (userId === requesterId) return true;
  return canAccessInstitutionalModule(roles);
}

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export async function POST(_req: Request, context: Ctx) {
  const { id, fileId } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return apiErrorResponse('Please sign in to continue.', 401);
  }
  const roles = sessionRoles(session);
  const userId = (session.user as { id?: string }).id;
  if (!userId) return apiErrorResponse('Please sign in to continue.', 401);

  const c = await prisma.institutionalClearance.findUnique({ where: { id } });
  if (!c) return apiErrorResponse('We could not find that.', 404);
  if (!canAccessFileRoute(userId, c.requesterId, roles)) {
    return apiErrorResponse('You do not have permission to do that.', 403);
  }

  const f = await prisma.institutionalClearanceFile.findFirst({
    where: { id: fileId, institutionalClearanceId: id, isArchived: false },
  });
  if (!f) {
    return apiErrorResponse('We could not find that file.', 404);
  }

  const isUploader = f.uploadedById === userId;
  if (!isUploader && !canAccessInstitutionalModule(roles)) {
    return apiErrorResponse('Only the uploader or an authorized staff member may archive this file.', 403);
  }

  await prisma.institutionalClearanceFile.update({
    where: { id: fileId },
    data: { isArchived: true, archivedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
