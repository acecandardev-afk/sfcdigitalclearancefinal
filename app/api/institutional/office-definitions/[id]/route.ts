import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { z } from 'zod';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canManageInstitutionalOfficeDefinitions } from '@/lib/permissionsMatrix';

function requireInstOfficeAdmin(session: { user?: unknown } | null) {
  const roles = ((session?.user as { roles?: string[] } | undefined)?.roles ?? []) as string[];
  return Boolean(session?.user && canManageInstitutionalOfficeDefinitions(roles));
}

const PatchBody = z.object({
  departmentLabel: z.string().min(1).max(300).optional(),
  signatoryId: z.string().cuid().optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Ctx) {
  const { id } = await context.params;
  const session = await getAppSession();
  if (!requireInstOfficeAdmin(session)) {
    return NextResponse.json({ error: 'Only administrators can change office settings.' }, { status: 401 });
  }
  const existing = await prisma.institutionalOfficeDefinition.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }
  const p = parsed.data;
  if (p.signatoryId === null) {
    return NextResponse.json({ error: 'A signatory is required for each office.' }, { status: 400 });
  }
  if (p.signatoryId) {
    const s = await prisma.signatory.findUnique({ where: { id: p.signatoryId } });
    if (!s) {
      return NextResponse.json(
        { error: 'That signatory could not be found. Choose another one or refresh the page.' },
        { status: 400 }
      );
    }
  }
  const data: { departmentLabel?: string; signatoryId?: string } = {};
  if (p.departmentLabel !== undefined) data.departmentLabel = p.departmentLabel.trim();
  if (p.signatoryId !== undefined) data.signatoryId = p.signatoryId;
  await prisma.institutionalOfficeDefinition.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

import { apiErrorResponse } from '@/server/apiUserError';

export async function DELETE(_req: Request, _context: Ctx) {
  return apiErrorResponse('Office rows cannot be deleted. Use Archive instead.', 405);
}
