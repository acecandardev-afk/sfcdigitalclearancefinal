import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, canUseInstitutionalApp, sessionRoles } from '@/lib/apiAuth';
import { apiErrorResponse } from '@/server/apiUserError';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_req: Request, _context: Ctx) {
  return apiErrorResponse('Attached files cannot be deleted. Use Archive instead.', 405);
}
