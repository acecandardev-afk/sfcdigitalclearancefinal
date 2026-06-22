import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, canUseInstitutionalApp, sessionRoles } from '@/lib/apiAuth';
import { getInstitutionalCertFieldPermissions } from '@/lib/institutionalCertPermissions';
import { z } from 'zod';

const PatchBody = z.object({
  preparedByName: z.string().max(200).optional().nullable(),
  preparedAt: z.string().datetime().optional().nullable(),
  verifiedByName: z.string().max(200).optional().nullable(),
  verifiedAt: z.string().datetime().optional().nullable(),
  approvedByName: z.string().max(200).optional().nullable(),
  approvedAt: z.string().datetime().optional().nullable(),
});

function denyIfCannotAccessRoute(userId: string, requesterId: string, roles: string[]) {
  if (!canUseInstitutionalApp(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (userId === requesterId) return null;
  if (!canAccessInstitutionalModule(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

type Ctx = { params: Promise<{ id: string }> };

function parseT(v: string | null | undefined) {
  if (v == null || v === '') return null;
  return new Date(v);
}

export async function PATCH(req: Request, context: Ctx) {
  const { id } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cl = await prisma.institutionalClearance.findUnique({ where: { id } });
  if (!cl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const d = denyIfCannotAccessRoute(userId, cl.requesterId, roles);
  if (d) return d;

  const json = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }
  const p = parsed.data;

  const isRequesterOnly = userId === cl.requesterId && !canAccessInstitutionalModule(roles);
  if (isRequesterOnly) {
    if (
      p.verifiedByName !== undefined ||
      p.verifiedAt !== undefined ||
      p.approvedByName !== undefined ||
      p.approvedAt !== undefined
    ) {
      return NextResponse.json({ error: 'You can only edit the "Prepared by" section on your own request.' }, { status: 403 });
    }
  }

  const myS = await prisma.signatory.findFirst({
    where: { userId },
    select: { institutionalCertRole: true },
  });
  const perms = getInstitutionalCertFieldPermissions(userId, cl.requesterId, roles, myS);

  const wantsPrepared =
    p.preparedByName !== undefined || p.preparedAt !== undefined;
  const wantsVerified = p.verifiedByName !== undefined || p.verifiedAt !== undefined;
  const wantsApproved = p.approvedByName !== undefined || p.approvedAt !== undefined;

  if (wantsPrepared && !perms.canEditPrepared) {
    return NextResponse.json({ error: 'You do not have permission to edit the "Prepared by" section.' }, { status: 403 });
  }
  if (wantsVerified && !perms.canEditVerified) {
    return NextResponse.json({ error: 'You do not have permission to edit HRMDO verification.' }, { status: 403 });
  }
  if (wantsApproved && !perms.canEditApproved) {
    return NextResponse.json({ error: 'You do not have permission to edit President approval.' }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (p.preparedByName !== undefined) data.preparedByName = p.preparedByName?.trim() || null;
  if (p.preparedAt !== undefined) data.preparedAt = parseT(p.preparedAt as string | null | undefined);
  if (p.verifiedByName !== undefined) data.verifiedByName = p.verifiedByName?.trim() || null;
  if (p.verifiedAt !== undefined) data.verifiedAt = parseT(p.verifiedAt as string | null | undefined);
  if (p.approvedByName !== undefined) data.approvedByName = p.approvedByName?.trim() || null;
  if (p.approvedAt !== undefined) data.approvedAt = parseT(p.approvedAt as string | null | undefined);

  await prisma.institutionalClearanceCertification.upsert({
    where: { institutionalClearanceId: id },
    create: {
      institutionalClearanceId: id,
      preparedByName: (data.preparedByName as string | null | undefined) ?? null,
      preparedAt: (data.preparedAt as Date | null | undefined) ?? null,
      verifiedByName: (data.verifiedByName as string | null | undefined) ?? null,
      verifiedAt: (data.verifiedAt as Date | null | undefined) ?? null,
      approvedByName: (data.approvedByName as string | null | undefined) ?? null,
      approvedAt: (data.approvedAt as Date | null | undefined) ?? null,
    },
    update: {
      ...('preparedByName' in data ? { preparedByName: data.preparedByName } : {}),
      ...('preparedAt' in data ? { preparedAt: data.preparedAt } : {}),
      ...('verifiedByName' in data ? { verifiedByName: data.verifiedByName } : {}),
      ...('verifiedAt' in data ? { verifiedAt: data.verifiedAt } : {}),
      ...('approvedByName' in data ? { approvedByName: data.approvedByName } : {}),
      ...('approvedAt' in data ? { approvedAt: data.approvedAt } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
