import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { z } from 'zod';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, sessionRoles } from '@/lib/apiAuth';
import { isInstitutionalAdminElevation } from '@/lib/permissionsMatrix';
import { writeAuditLog } from '@/server/auditLog';

const BodySchema = z.object({
  fulfillment_id: z.string().min(1),
  notes: z.string().trim().min(1, 'Verification notes are required').max(5000),
});

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function POST(req: Request, context: Ctx) {
  const { id, itemId } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  if (!canAccessInstitutionalModule(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const ful = await prisma.institutionalClearanceItemFulfillment.findUnique({
    where: { id: parsed.data.fulfillment_id },
    include: {
      requirement: true,
      item: {
        include: {
          clearance: { select: { id: true, requesterId: true } },
          signatory: { select: { userId: true, id: true } },
        },
      },
    },
  });

  if (!ful || ful.item.institutionalClearanceId !== id || ful.item.id !== itemId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (ful.requirement.kind !== 'office') {
    return NextResponse.json({ error: 'That item is not an office requirement.' }, { status: 400 });
  }

  const isSuper = isInstitutionalAdminElevation(roles);
  if (!isSuper) {
    if (ful.item.clearance.requesterId === userId) {
      return NextResponse.json(
        { error: 'You submitted this request. The assigned signatory must verify this requirement.' },
        { status: 403 }
      );
    }
    if (ful.item.signatory?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (ful.officeVerifiedAt) {
    return NextResponse.json({ ok: true, already: true });
  }

  await prisma.institutionalClearanceItemFulfillment.update({
    where: { id: ful.id },
    data: {
      officeVerifiedAt: new Date(),
      officeVerifiedByUserId: userId,
      officeVerificationNotes: parsed.data.notes,
    },
  });

  void writeAuditLog({
    userId,
    action: 'institutional_office_requirement_verified',
    details: { institutionalClearanceId: id, itemId, fulfillmentId: ful.id },
    req,
  });

  return NextResponse.json({ ok: true });
}
