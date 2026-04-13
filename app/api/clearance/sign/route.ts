import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  signature_id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sig = await prisma.clearanceSignature.update({
    where: { id: parsed.data.signature_id },
    data: {
      status: parsed.data.action === 'approve' ? 'approved' : 'rejected',
      notes: parsed.data.notes ?? null,
      remarks: parsed.data.remarks ?? null,
      signedAt: new Date(),
    },
  });

  return NextResponse.json({ id: sig.id, status: sig.status });
}
