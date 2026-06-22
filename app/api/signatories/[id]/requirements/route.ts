import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canWriteSignatories } from '@/lib/permissionsMatrix';
import { writeAuditLog } from '@/server/auditLog';

const ReqItem = z.object({
  id: z.number().int().optional(),
  sort_order: z.number().int(),
  kind: z.enum(['document', 'physical', 'office']),
  label: z.string().min(1).max(500),
  instructions: z.string().max(2000).nullable().optional(),
  required: z.boolean().optional(),
});

const PutSchema = z.object({
  requirements: z.array(ReqItem).max(50),
});

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!session?.user || !canWriteSignatories(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = ctx.params.id;
  const list = await prisma.signatoryRequirement.findMany({
    where: { signatoryId: id },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json({ requirements: list });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!session?.user || !canWriteSignatories(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = ctx.params.id;
  const json = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const exists = await prisma.signatory.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.signatoryRequirement.deleteMany({ where: { signatoryId: id } }),
    prisma.signatoryRequirement.createMany({
      data: parsed.data.requirements.map((r, idx) => ({
        signatoryId: id,
        sortOrder: r.sort_order ?? idx,
        kind: r.kind,
        label: r.label,
        instructions: r.instructions ?? null,
        required: r.required ?? true,
      })),
    }),
  ]);

  const list = await prisma.signatoryRequirement.findMany({
    where: { signatoryId: id },
    orderBy: { sortOrder: 'asc' },
  });

  const uid = (session.user as { id?: string }).id;
  if (uid) {
    void writeAuditLog({
      userId: uid,
      action: 'signatory_requirements_updated',
      details: { signatoryId: id, count: list.length },
      req,
    });
  }

  return NextResponse.json({ requirements: list });
}
