import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { z } from 'zod';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canUseInstitutionalApp, sessionRoles } from '@/lib/apiAuth';
import { getOfficeItemCreatesForNewClearance } from '@/lib/institutionalOfficeService';
import { notifyFirstInstitutionalAssignee } from '@/lib/institutionalNotifications';
import { isInstitutionalAdminElevation, canCreateOwnInstitutionalClearanceRequest } from '@/lib/permissionsMatrix';

const CreateBody = z
  .object({
    fullName: z.string().min(1).max(300),
    position: z.string().min(1).max(200),
    department: z.string().min(1).max(200),
    employeeType: z.enum(['teaching', 'ntp']).optional(),
    dateOfSeparation: z.string().datetime().optional(),
    reasonCategory: z.enum(['resignation', 'end_of_contract', 'transfer', 'other']).optional(),
    reasonOtherDetails: z.string().max(2000).optional().nullable(),
    reason: z.string().max(2000).optional().nullable(),
    status: z.enum(['draft', 'pending']).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.status === 'pending') {
      if (!d.employeeType) ctx.addIssue({ code: 'custom', path: ['employeeType'], message: 'Required' });
      if (!d.dateOfSeparation) ctx.addIssue({ code: 'custom', path: ['dateOfSeparation'], message: 'Required' });
      if (!d.reasonCategory) ctx.addIssue({ code: 'custom', path: ['reasonCategory'], message: 'Required' });
    }
  });

function denyIfNoInstAccess(roles: string[]) {
  if (!canUseInstitutionalApp(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const d = denyIfNoInstAccess(roles);
  if (d) return d;
  const isSignatoryOnly = roles.includes('signatory') && !isInstitutionalAdminElevation(roles);
  if (isSignatoryOnly) {
    return NextResponse.json(
      { error: 'Signatories use the signatory queue instead of creating requests here.' },
      { status: 403 }
    );
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const canViewAll = isInstitutionalAdminElevation(roles) || roles.includes('signatory');
    const rows = await prisma.institutionalClearance.findMany({
      where: canViewAll ? {} : { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({
      clearances: rows.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      fullName: r.fullName,
      position: r.position,
      department: r.department,
      employeeType: r.employeeType,
      dateOfSeparation: r.dateOfSeparation ? r.dateOfSeparation.toISOString() : null,
      reasonCategory: r.reasonCategory,
      reasonOtherDetails: r.reasonOtherDetails,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      requester: {
        email: r.requester.email,
        full_name: r.requester.profile?.fullName ?? null,
      },
      items_count: r._count.items,
    })),
    });
  } catch (e) {
    console.error('[GET /api/institutional/clearances]', e);
    return NextResponse.json(
      { error: 'Could not load clearance records. Please try again shortly.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const d = denyIfNoInstAccess(roles);
  if (d) return d;
  const isSignatoryOnly = roles.includes('signatory') && !isInstitutionalAdminElevation(roles);
  if (isSignatoryOnly) {
    return NextResponse.json(
      { error: 'Signatories cannot create clearance requests.' },
      { status: 403 }
    );
  }

  if (!canCreateOwnInstitutionalClearanceRequest(roles)) {
    return NextResponse.json(
      {
        error:
          'Only employees may create an institutional clearance request for themselves. Administrators manage records in Admin overview.',
      },
      { status: 403 }
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Something went wrong. Please sign in again and try again.' }, { status: 400 });
  }

  const b = parsed.data;
  const initialStatus = b.status === 'draft' ? 'draft' : 'pending';
  const dateSep = b.dateOfSeparation ? new Date(b.dateOfSeparation) : new Date();
  const employeeType = b.employeeType ?? 'teaching';
  const reasonCategory = b.reasonCategory ?? 'resignation';
  const created = await prisma.$transaction(async (tx) => {
    const officeRows = await getOfficeItemCreatesForNewClearance(tx);
    const c = await tx.institutionalClearance.create({
      data: {
        requesterId: userId,
        fullName: b.fullName.trim(),
        position: b.position.trim(),
        department: b.department.trim(),
        employeeType,
        dateOfSeparation: dateSep,
        reasonCategory,
        reasonOtherDetails: b.reasonOtherDetails?.trim() || null,
        reason: b.reason?.trim() || null,
        status: initialStatus,
        items: {
          create: officeRows,
        },
        approval: { create: {} },
      },
    });
    return c;
  });

  if (initialStatus === 'pending') {
    try {
      await notifyFirstInstitutionalAssignee(created.id);
    } catch (e) {
      console.error('[institutional create notify]', e);
    }
  }

  return NextResponse.json({ id: created.id }, { status: 201 });
}
