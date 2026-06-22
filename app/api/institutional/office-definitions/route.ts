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

const CreateBody = z.object({
  departmentLabel: z.string().min(1).max(300),
  signatoryId: z.string().cuid(),
});

export async function GET() {
  const session = await getAppSession();
  if (!requireInstOfficeAdmin(session)) {
    return NextResponse.json({ error: 'Only administrators can change office settings.' }, { status: 401 });
  }
  const rows = await prisma.institutionalOfficeDefinition.findMany({
    where: { isArchived: false },
    orderBy: { sortOrder: 'asc' },
    include: {
      signatory: {
        select: { id: true, name: true, department: true, position: true },
      },
    },
  });
  return NextResponse.json({
    definitions: rows.map((r) => ({
      id: r.id,
      sortOrder: r.sortOrder,
      departmentLabel: r.departmentLabel,
      signatoryId: r.signatoryId,
      signatory: r.signatory,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!requireInstOfficeAdmin(session)) {
    return NextResponse.json({ error: 'Only administrators can change office settings.' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }
  const b = parsed.data;
  const s = await prisma.signatory.findUnique({ where: { id: b.signatoryId } });
  if (!s) {
    return NextResponse.json(
      { error: 'That signatory could not be found. Choose another one or refresh the page.' },
      { status: 400 }
    );
  }

  const maxSo = await prisma.institutionalOfficeDefinition.aggregate({ _max: { sortOrder: true } });
  const nextOrder = (maxSo._max.sortOrder ?? -1) + 1;
  await prisma.institutionalOfficeDefinition.create({
    data: {
      sortOrder: nextOrder,
      departmentLabel: b.departmentLabel.trim(),
      signatoryId: b.signatoryId,
    },
  });

  return NextResponse.json({ ok: true });
}
