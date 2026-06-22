import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { z } from 'zod';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canUseInstitutionalApp, sessionRoles } from '@/lib/apiAuth';
import { allItemsClearedForRecordComplete, itemSequentialUnlocked } from '@/lib/institutionalSequential';
import { getInstitutionalCertFieldPermissions } from '@/lib/institutionalCertPermissions';
import { notifyRequesterInstitutionalCompleted } from '@/lib/institutionalNotifications';
import { writeAuditLog } from '@/server/auditLog';
import { isInstitutionalAdminElevation } from '@/lib/permissionsMatrix';

const PatchBody = z.object({
  fullName: z.string().min(1).max(300).optional(),
  position: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(200).optional(),
  employeeType: z.enum(['teaching', 'ntp']).optional(),
  dateOfSeparation: z.string().datetime().optional(),
  reasonCategory: z.enum(['resignation', 'end_of_contract', 'transfer', 'other']).optional(),
  reasonOtherDetails: z.string().max(2000).optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
  finalClearanceStatus: z.enum(['cleared', 'not_cleared']).optional().nullable(),
  finalClearanceRemarks: z.string().max(4000).optional().nullable(),
  status: z.enum(['draft', 'pending', 'in_progress', 'completed', 'rejected']).optional(),
});

function denyIfNoInstAccess(roles: string[]) {
  if (!canUseInstitutionalApp(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const d = denyIfNoInstAccess(roles);
  if (d) return d;
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rec = await prisma.institutionalClearance.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          signatory: { include: { requirements: { orderBy: { sortOrder: 'asc' } } } },
          requirementFulfillments: { include: { requirement: { select: { id: true, kind: true, label: true } } } },
        },
      },
      approval: true,
      files: { where: { isArchived: false }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const isOwner = rec.requesterId === userId;
  const isStaff = roles.includes('signatory') || isInstitutionalAdminElevation(roles);
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const myS = await prisma.signatory.findFirst({
    where: { userId },
    select: { institutionalCertRole: true },
  });
  const certificationPermissions = getInstitutionalCertFieldPermissions(userId, rec.requesterId, roles, myS);

  const itemsForOrder = rec.items.map((i) => ({
    id: i.id,
    sortOrder: i.sortOrder,
    status: i.status,
  }));

  return NextResponse.json({
    clearance: {
      id: rec.id,
      requesterId: rec.requesterId,
      fullName: rec.fullName,
      position: rec.position,
      department: rec.department,
      employeeType: rec.employeeType,
      dateOfSeparation: rec.dateOfSeparation ? rec.dateOfSeparation.toISOString() : null,
      reasonCategory: rec.reasonCategory,
      reasonOtherDetails: rec.reasonOtherDetails,
      reason: rec.reason,
      finalClearanceStatus: rec.finalClearanceStatus,
      finalClearanceRemarks: rec.finalClearanceRemarks,
      status: rec.status,
      createdAt: rec.createdAt.toISOString(),
      updatedAt: rec.updatedAt.toISOString(),
      items: rec.items.map((i) => {
        const fulfillments = i.requirementFulfillments.map((f) => ({
          id: f.id,
          requirementId: f.signatoryRequirementId,
          kind: f.requirement.kind,
          label: f.requirement.label,
          documentUrls: f.documentUrls,
          physicalAttestedAt: f.physicalAttestedAt ? f.physicalAttestedAt.toISOString() : null,
          officeVerifiedAt: f.officeVerifiedAt ? f.officeVerifiedAt.toISOString() : null,
          officeVerificationNotes: f.officeVerificationNotes,
        }));
        const officeVerificationPending = fulfillments.some(
          (f) => f.kind === 'office' && !f.officeVerifiedAt
        );
        const hasSubmission = fulfillments.length > 0 || !!i.submissionRemarks;
        return {
          id: i.id,
          signatoryId: i.signatoryId,
          departmentLabel: i.departmentLabel,
          sortOrder: i.sortOrder,
          status: i.status,
          submissionRemarks: i.submissionRemarks,
          remarks: i.remarks,
          approverName: i.approverName,
          approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
          approvedByUserId: i.approvedByUserId,
          sequentialUnlocked: itemSequentialUnlocked(itemsForOrder, i.id),
          hasSubmission,
          officeVerificationPending,
          requirements: (i.signatory?.requirements ?? []).map((r) => ({
            id: r.id,
            kind: r.kind,
            label: r.label,
            instructions: r.instructions,
            required: r.required,
            sortOrder: r.sortOrder,
          })),
          fulfillments,
          signatory: i.signatory
            ? {
                id: i.signatory.id,
                name: i.signatory.name,
                position: i.signatory.position,
                department: i.signatory.department,
              }
            : null,
        };
      }),
      certification: rec.approval
        ? {
            preparedByName: rec.approval.preparedByName,
            preparedAt: rec.approval.preparedAt ? rec.approval.preparedAt.toISOString() : null,
            verifiedByName: rec.approval.verifiedByName,
            verifiedAt: rec.approval.verifiedAt ? rec.approval.verifiedAt.toISOString() : null,
            approvedByName: rec.approval.approvedByName,
            approvedAt: rec.approval.approvedAt ? rec.approval.approvedAt.toISOString() : null,
          }
        : null,
      certificationPermissions,
      files: rec.files.map((f) => ({
        id: f.id,
        file_name: f.fileName,
        content_type: f.contentType,
        blob_url: f.blobUrl,
        uploaded_at: f.createdAt.toISOString(),
        uploadedById: f.uploadedById,
      })),
    },
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const d = denyIfNoInstAccess(roles);
  if (d) return d;
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Something went wrong. Please sign in again and try again.' }, { status: 400 });
  }

  const existing = await prisma.institutionalClearance.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const p = parsed.data;
  const isStaff = roles.includes('signatory') || isInstitutionalAdminElevation(roles);
  const isRequester = existing.requesterId === userId;
  const isCompleteOnly =
    p.status === 'completed' &&
    p.fullName === undefined &&
    p.position === undefined &&
    p.department === undefined &&
    p.employeeType === undefined &&
    p.dateOfSeparation === undefined &&
    p.reasonCategory === undefined &&
    p.reasonOtherDetails === undefined &&
    p.finalClearanceStatus === undefined &&
    p.finalClearanceRemarks === undefined &&
    p.reason === undefined;
  if (isStaff && isCompleteOnly) {
    const withItems = await prisma.institutionalClearance.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!withItems) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!allItemsClearedForRecordComplete(withItems.items)) {
      return NextResponse.json(
        {
          error:
            'All signatory lines must be approved or waived in order before the record can be marked complete.',
        },
        { status: 400 }
      );
    }
    await prisma.institutionalClearance.update({ where: { id }, data: { status: 'completed' } });
    try {
      await notifyRequesterInstitutionalCompleted(existing.requesterId);
    } catch (e) {
      console.error('[institutional complete notify]', e);
    }
    void writeAuditLog({
      userId,
      action: 'institutional_clearance_complete',
      details: { institutionalClearanceId: id },
      req,
    });
    return NextResponse.json({ ok: true });
  }
  const wantsHeaderEdit =
    p.fullName !== undefined ||
    p.position !== undefined ||
    p.department !== undefined ||
    p.employeeType !== undefined ||
    p.dateOfSeparation !== undefined ||
    p.reasonCategory !== undefined ||
    p.reasonOtherDetails !== undefined ||
    p.reason !== undefined ||
    p.status !== undefined;

  const wantsFinalEdit = p.finalClearanceStatus !== undefined || p.finalClearanceRemarks !== undefined;
  if (wantsFinalEdit && !isStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (wantsHeaderEdit && !isRequester && !isInstitutionalAdminElevation(roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!wantsHeaderEdit && !wantsFinalEdit) {
    return NextResponse.json({ ok: true });
  }

  const data: Record<string, unknown> = {};
  if (p.fullName !== undefined) data.fullName = p.fullName.trim();
  if (p.position !== undefined) data.position = p.position.trim();
  if (p.department !== undefined) data.department = p.department.trim();
  if (p.employeeType !== undefined) data.employeeType = p.employeeType;
  if (p.dateOfSeparation !== undefined) data.dateOfSeparation = new Date(p.dateOfSeparation);
  if (p.reasonCategory !== undefined) data.reasonCategory = p.reasonCategory;
  if (p.reasonOtherDetails !== undefined) data.reasonOtherDetails = p.reasonOtherDetails?.trim() || null;
  if (p.reason !== undefined) data.reason = p.reason?.trim() || null;
  if (p.status !== undefined) data.status = p.status;
  if (p.finalClearanceStatus !== undefined) data.finalClearanceStatus = p.finalClearanceStatus;
  if (p.finalClearanceRemarks !== undefined) data.finalClearanceRemarks = p.finalClearanceRemarks?.trim() || null;

  await prisma.institutionalClearance.update({ where: { id }, data });

  void writeAuditLog({
    userId,
    action: 'institutional_clearance_update',
    details: { institutionalClearanceId: id, fields: Object.keys(data) },
    req,
  });

  return NextResponse.json({ ok: true });
}
