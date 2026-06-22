import { NextResponse } from 'next/server';
import { apiErrorResponse, apiMsg, apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canDeleteSignatory, canWriteSignatories } from '@/lib/permissionsMatrix';

function requireSignatoryWriter(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && canWriteSignatories(roles));
}

function requireSignatoryDelete(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && canDeleteSignatory(roles));
}

const unauthorized = () => apiErrorResponse(apiMsg.forbidden, 403);

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.string().min(1).max(100).optional(),
  department: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  is_active: z.boolean().optional(),
  institutional_cert_role: z.enum(['none', 'preparer', 'hrmdo', 'president']).optional(),
  weekly_hours_json: z.unknown().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSignatoryWriter(session)) return unauthorized();

  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const id = ctx.params.id;
  const s = parsed.data;

  try {
    const updated = await prisma.signatory.update({
      where: { id },
      data: {
        ...(s.name != null ? { name: s.name } : {}),
        ...(s.position != null ? { position: s.position } : {}),
        ...(s.department != null ? { department: s.department } : {}),
        ...(s.email != null ? { email: s.email.toLowerCase() } : {}),
        ...(s.is_active != null ? { isActive: s.is_active } : {}),
        ...(s.institutional_cert_role != null
          ? { institutionalCertRole: s.institutional_cert_role as 'none' | 'preparer' | 'hrmdo' | 'president' }
          : {}),
        ...(s.weekly_hours_json !== undefined ? { weeklyHoursJson: s.weekly_hours_json as object | null } : {}),
      },
    });
    return NextResponse.json({ signatory: updated });
  } catch (e: unknown) {
    console.error('[PATCH /api/signatories/[id]]', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return apiErrorResponse(apiMsg.notFound, 404);
      }
      if (e.code === 'P2002') {
        return apiErrorResponse(
          'This email is already in use. Choose a different email or ask an administrator.',
          409
        );
      }
    }
    return NextResponse.json(
      { error: 'Could not update signatory. Please try again in a moment.' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, _ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!requireSignatoryDelete(session)) return unauthorized();

  return apiErrorResponse('Signatories cannot be deleted. Use Archive instead.', 405);
}
