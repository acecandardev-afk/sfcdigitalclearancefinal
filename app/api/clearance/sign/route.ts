import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { writeAuditLog } from '@/server/auditLog';

const BodySchema = z.object({
  signature_id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  remarks: z.string().trim().min(1, 'Remarks are required').max(5000),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('signatory')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  if (parsed.data.action === 'approve') {
    const pendingOffice = await prisma.clearanceRequirementFulfillment.count({
      where: {
        clearanceSignatureId: parsed.data.signature_id,
        requirement: { kind: 'office' },
        officeVerifiedAt: null,
      },
    });
    if (pendingOffice > 0) {
      return NextResponse.json(
        {
          error:
            'Office verification is still pending for one or more requirements. Use “Verify office requirement” first.',
        },
        { status: 400 }
      );
    }
  }

  const sig = await prisma.clearanceSignature.update({
    where: { id: parsed.data.signature_id },
    data: {
      status: parsed.data.action === 'approve' ? 'approved' : 'rejected',
      remarks: parsed.data.remarks,
      signedAt: new Date(),
    },
  });

  const uid = (session.user as { id?: string }).id;
  if (uid) {
    void writeAuditLog({
      userId: uid,
      action: parsed.data.action === 'approve' ? 'clearance_signature_approved' : 'clearance_signature_rejected',
      details: { signatureId: sig.id },
      req,
    });
  }

  return NextResponse.json({ id: sig.id, status: sig.status });
}
