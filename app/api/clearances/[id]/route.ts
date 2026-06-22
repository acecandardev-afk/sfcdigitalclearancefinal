import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { isStudentRecordsElevation, canRequestStudentClearance, isHrAdmin } from '@/lib/permissionsMatrix';

function roles(session: any): string[] {
  return ((session as any)?.user?.roles ?? []) as string[];
}

async function getSignatoryIdForUser(userId: string): Promise<string | null> {
  const s = await prisma.signatory.findUnique({ where: { userId }, select: { id: true } });
  return s?.id ?? null;
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = ctx.params.id;
  const userId = (session.user as any).id as string;
  const r = roles(session);
  const isStaffAdmin = isStudentRecordsElevation(r) || isHrAdmin(r);

  const cr = await prisma.clearanceRequest.findUnique({
    where: { id },
    include: {
      student: { include: { profile: true } },
      signatures: { include: { signatory: true }, orderBy: { sequenceOrder: 'asc' } },
      files: { orderBy: { uploadedAt: 'desc' } },
    },
  });

  if (!cr) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (cr.isArchived && !isStaffAdmin && cr.studentId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwnStudentRequester = canRequestStudentClearance(r) && cr.studentId === userId;
  const isSignatory = r.includes('signatory');

  let allowed = false;
  let signatoryId: string | null = null;

  if (isStaffAdmin) allowed = true;
  if (isOwnStudentRequester) allowed = true;
  if (!allowed && isSignatory) {
    signatoryId = await getSignatoryIdForUser(userId);
    if (signatoryId) {
      allowed = cr.signatures.some((s) => s.signatoryId === signatoryId);
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // per-signatory student note
  let stepNote: string | null = null;
  if (isSignatory && signatoryId) {
    const n = await prisma.studentClearanceStepNote.findUnique({
      where: { clearanceRequestId_signatoryId: { clearanceRequestId: id, signatoryId } },
      select: { note: true },
    });
    stepNote = n?.note ?? null;
  }

  const clearance = {
    id: cr.id,
    title: cr.title,
    description: cr.description,
    status: cr.status,
    created_at: cr.createdAt.toISOString(),
    updated_at: cr.updatedAt.toISOString(),
    student_id: cr.studentId,
    student: {
      full_name: cr.student.profile?.fullName ?? 'Unknown',
      student_id: cr.student.profile?.studentId ?? null,
      course: cr.student.profile?.course ?? null,
      year_level: cr.student.profile?.yearLevel ?? null,
      address: cr.student.profile?.address ?? null,
      age: cr.student.profile?.age ?? null,
      email: cr.student.profile?.email ?? cr.student.email,
    },
  };

  const signatures = cr.signatures.map((s) => ({
    id: s.id,
    signatory_id: s.signatoryId,
    status: s.status,
    notes: s.notes ?? null,
    remarks: s.remarks ?? null,
    sequence_order: s.sequenceOrder,
    signed_at: s.signedAt ? s.signedAt.toISOString() : null,
    signatory_group: s.signatoryGroup,
    authority_sequence_order: s.authoritySequenceOrder ?? null,
    signatory: {
      id: s.signatory.id,
      name: s.signatory.name,
      position: s.signatory.position,
      department: s.signatory.department,
    },
  }));

  const files = cr.files.map((f) => ({
    id: f.id,
    file_name: f.fileName,
    content_type: f.contentType ?? null,
    blob_url: f.blobUrl,
    uploaded_at: f.uploadedAt.toISOString(),
    signature_id: f.signatureId ?? null,
  }));

  let pendingOfficeVerifications: { signature_id: string; fulfillment_id: string; label: string }[] = [];
  let verifiedOfficeRequirements: {
    signature_id: string;
    fulfillment_id: string;
    label: string;
    notes: string | null;
    verified_at: string | null;
  }[] = [];
  if (isSignatory && signatoryId) {
    const mineSigIds = cr.signatures.filter((s) => s.signatoryId === signatoryId).map((s) => s.id);
    if (mineSigIds.length) {
      const fuls = await prisma.clearanceRequirementFulfillment.findMany({
        where: {
          clearanceSignatureId: { in: mineSigIds },
          requirement: { kind: 'office' },
        },
        include: { requirement: { select: { label: true } } },
      });
      pendingOfficeVerifications = fuls
        .filter((f) => !f.officeVerifiedAt)
        .map((f) => ({
          signature_id: f.clearanceSignatureId,
          fulfillment_id: f.id,
          label: f.requirement.label,
        }));
      verifiedOfficeRequirements = fuls
        .filter((f) => f.officeVerifiedAt)
        .map((f) => ({
          signature_id: f.clearanceSignatureId,
          fulfillment_id: f.id,
          label: f.requirement.label,
          notes: f.officeVerificationNotes ?? null,
          verified_at: f.officeVerifiedAt ? f.officeVerifiedAt.toISOString() : null,
        }));
    }
  }

  return NextResponse.json({
    clearance,
    signatures,
    files,
    step_note: stepNote,
    signatory_id: signatoryId,
    pending_office_verifications: pendingOfficeVerifications,
    verified_office_requirements: verifiedOfficeRequirements,
  });
}

import { apiErrorResponse } from '@/server/apiUserError';

export async function DELETE(_req: Request, _ctx: { params: { id: string } }) {
  return apiErrorResponse(
    'Clearance requests cannot be deleted. Use Archive instead while the request is still pending.',
    405
  );
}
