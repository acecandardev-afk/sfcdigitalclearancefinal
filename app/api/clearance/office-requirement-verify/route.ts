import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { writeAuditLog } from '@/server/auditLog';

const BodySchema = z.object({
  fulfillment_id: z.string().min(1),
  notes: z.string().trim().min(1, 'Verification notes are required').max(5000),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  const userId = (session?.user as { id?: string })?.id;
  if (!session?.user || !userId || !roles.includes('signatory')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const ful = await prisma.clearanceRequirementFulfillment.findUnique({
    where: { id: parsed.data.fulfillment_id },
    include: {
      requirement: true,
      signature: {
        include: {
          signatory: { select: { userId: true, id: true } },
          clearanceRequest: { select: { id: true } },
        },
      },
    },
  });

  if (!ful || ful.requirement.kind !== 'office') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (ful.signature.signatory?.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (ful.officeVerifiedAt) {
    return NextResponse.json({ ok: true, already: true });
  }

  await prisma.clearanceRequirementFulfillment.update({
    where: { id: ful.id },
    data: {
      officeVerifiedAt: new Date(),
      officeVerifiedByUserId: userId,
      officeVerificationNotes: parsed.data.notes,
    },
  });

  void writeAuditLog({
    userId,
    action: 'office_requirement_verified',
    details: { fulfillmentId: ful.id, clearanceRequestId: ful.signature.clearanceRequestId },
    req,
  });

  return NextResponse.json({ ok: true });
}
