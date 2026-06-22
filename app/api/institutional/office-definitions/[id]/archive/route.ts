import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canManageInstitutionalOfficeDefinitions } from '@/lib/permissionsMatrix';
import { apiErrorResponse } from '@/server/apiUserError';
import { getOfficeDefinitionArchiveBlockers } from '@/server/archiveSafeguards';
import { NextResponse } from 'next/server';

function requireInstOfficeAdmin(session: { user?: unknown } | null) {
  const roles = ((session?.user as { roles?: string[] } | undefined)?.roles ?? []) as string[];
  return Boolean(session?.user && canManageInstitutionalOfficeDefinitions(roles));
}

const BodySchema = z.object({
  archive: z.boolean(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Ctx) {
  const { id } = await context.params;
  const session = await getAppSession();
  if (!requireInstOfficeAdmin(session)) {
    return apiErrorResponse('Only administrators can change office settings.', 403);
  }

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  if (!parsed.data.archive) {
    return apiErrorResponse('Restoring archived office rows is not available yet. Contact an administrator.', 400);
  }

  const blockers = await getOfficeDefinitionArchiveBlockers(prisma, id);
  if (blockers.ok === false) {
    return apiErrorResponse(blockers.message, 400);
  }

  const now = new Date();
  await prisma.institutionalOfficeDefinition.update({
    where: { id },
    data: { isArchived: true, archivedAt: now },
  });

  return NextResponse.json({ ok: true });
}
