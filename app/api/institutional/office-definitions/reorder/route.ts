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

const Body = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!requireInstOfficeAdmin(session)) {
    return NextResponse.json({ error: 'Only administrators can change office settings.' }, { status: 401 });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }
  const { orderedIds } = parsed.data;
  const all = await prisma.institutionalOfficeDefinition.findMany({ select: { id: true } });
  if (all.length !== orderedIds.length) {
    return NextResponse.json({ error: 'Include every office in the order and try again.' }, { status: 400 });
  }
  const set = new Set(orderedIds);
  if (set.size !== orderedIds.length) {
    return NextResponse.json({ error: 'One or more entries are duplicated. Refresh the page and try again.' }, { status: 400 });
  }
  for (const row of all) {
    if (!set.has(row.id)) {
      return NextResponse.json({ error: 'One or more entries could not be found. Refresh the page and try again.' }, { status: 400 });
    }
  }

  await prisma.$transaction(
    orderedIds.map((defId, index) =>
      prisma.institutionalOfficeDefinition.update({
        where: { id: defId },
        data: { sortOrder: index },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
