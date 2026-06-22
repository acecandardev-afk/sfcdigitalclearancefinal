import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canReviewClearanceExtensions } from '@/lib/permissionsMatrix';
import { writeAuditLog } from '@/server/auditLog';

const PatchSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  const roles = (session?.user?.roles ?? []) as string[];
  const userId = (session?.user as { id?: string })?.id;
  if (!session?.user || !userId || !canReviewClearanceExtensions(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const id = ctx.params.id;
  const row = await prisma.clearancePeriodExtension.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.status !== 'pending') {
    return NextResponse.json({ error: 'This request was already reviewed.' }, { status: 400 });
  }

  const updated = await prisma.clearancePeriodExtension.update({
    where: { id },
    data: {
      status: parsed.data.status,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });

  void writeAuditLog({
    userId,
    action: `clearance_extension_${parsed.data.status}`,
    details: { extensionId: id, studentId: row.studentId },
    req,
  });

  return NextResponse.json({ extension: updated });
}
