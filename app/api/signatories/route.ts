import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canWriteSignatories } from '@/lib/permissionsMatrix';
import { apiErrorResponse, apiMsg, apiValidationErrorResponse } from '@/server/apiUserError';

function requireSignatoryWriter(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && canWriteSignatories(roles));
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!requireSignatoryWriter(session)) {
    return apiErrorResponse(apiMsg.forbidden, 403);
  }

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('active_only') === '1' || url.searchParams.get('active_only') === 'true';
  const includeArchived = url.searchParams.get('archived') === '1';
  const orderBulk = url.searchParams.get('order') === 'bulk_assign';

  try {
    const signatories = await prisma.signatory.findMany({
      where: {
        ...(includeArchived ? { isArchived: true } : { isArchived: false }),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: orderBulk
        ? [{ signatoryGroup: 'asc' }, { authoritySequenceOrder: { sort: 'asc', nulls: 'first' } }]
        : [{ department: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ signatories });
  } catch (e: unknown) {
    console.error('[GET /api/signatories]', e);
    return NextResponse.json({ error: 'Could not load signatories. Please try again.' }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  email: z.string().email().max(255),
  is_active: z.boolean().optional(),
  signatory_group: z.enum(['standard', 'authority']).optional(),
  authority_sequence_order: z.number().int().nullable().optional(),
  institutional_cert_role: z.enum(['none', 'preparer', 'hrmdo', 'president']).optional(),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!requireSignatoryWriter(session)) {
    return apiErrorResponse(apiMsg.forbidden, 403);
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const s = parsed.data;
  try {
    const signatory = await prisma.signatory.create({
      data: {
        name: s.name,
        position: s.position,
        department: s.department,
        email: s.email.toLowerCase(),
        isActive: s.is_active ?? true,
        signatoryGroup: (s.signatory_group ?? 'standard') as any,
        authoritySequenceOrder: s.authority_sequence_order ?? null,
        institutionalCertRole: (s.institutional_cert_role ?? 'none') as 'none' | 'preparer' | 'hrmdo' | 'president',
      },
    });
    return NextResponse.json({ signatory }, { status: 201 });
  } catch (e: unknown) {
    console.error('[POST /api/signatories]', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return apiErrorResponse(
          'This email is already in use. Choose a different email or ask an administrator.',
          409
        );
      }
    }
    return NextResponse.json(
      { error: 'Could not create signatory. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
