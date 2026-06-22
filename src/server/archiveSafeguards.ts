import type { PrismaClient } from '@prisma/client';

export type ArchiveBlocker = { ok: false; message: string } | { ok: true };

/** Pending student clearance steps that would be stranded if the signatory is archived. */
export async function getSignatoryArchiveBlockers(
  prisma: PrismaClient,
  signatoryId: string,
  archiving: boolean
): Promise<ArchiveBlocker> {
  if (!archiving) return { ok: true };

  const pendingStudentSteps = await prisma.clearanceSignature.count({
    where: {
      signatoryId,
      status: { in: ['pending', 'in_progress'] },
      clearanceRequest: { isArchived: false },
    },
  });
  if (pendingStudentSteps > 0) {
    return {
      ok: false,
      message:
        'This signatory still has pending student clearance steps. Wait until those are finished or reassign them before archiving.',
    };
  }

  const pendingInstitutionalItems = await prisma.institutionalClearanceItem.count({
    where: {
      signatoryId,
      status: 'pending',
      clearance: { status: { in: ['pending', 'in_progress', 'draft'] } },
    },
  });
  if (pendingInstitutionalItems > 0) {
    return {
      ok: false,
      message:
        'This signatory still has pending institutional clearance rows. Finish or reassign those before archiving.',
    };
  }

  const activeOfficeRows = await prisma.institutionalOfficeDefinition.count({
    where: { signatoryId, isArchived: false },
  });
  if (activeOfficeRows > 0) {
    return {
      ok: false,
      message:
        'This signatory is assigned to one or more office template rows. Reassign those offices before archiving the signatory.',
    };
  }

  return { ok: true };
}

/** Prevent archiving the last active office in the institutional template. */
export async function getOfficeDefinitionArchiveBlockers(
  prisma: PrismaClient,
  officeDefinitionId: string
): Promise<ArchiveBlocker> {
  const row = await prisma.institutionalOfficeDefinition.findUnique({
    where: { id: officeDefinitionId },
    select: { id: true, isArchived: true, signatoryId: true },
  });
  if (!row) {
    return { ok: false, message: 'We could not find that office row.' };
  }
  if (row.isArchived) {
    return { ok: false, message: 'That office row is already archived.' };
  }

  const activeCount = await prisma.institutionalOfficeDefinition.count({
    where: { isArchived: false },
  });
  if (activeCount <= 1) {
    return {
      ok: false,
      message: 'At least one office must stay in the template. Add another office before archiving this one.',
    };
  }

  if (row.signatoryId) {
    const signatory = await prisma.signatory.findUnique({
      where: { id: row.signatoryId },
      select: { isArchived: true, name: true },
    });
    if (signatory?.isArchived) {
      return {
        ok: false,
        message:
          'The assigned signatory is archived. Choose an active signatory and save this row before archiving it.',
      };
    }
  }

  return { ok: true };
}

/** Student clearance requests may only be archived before any office has started processing. */
export async function getClearanceRequestArchiveBlockers(
  prisma: PrismaClient,
  clearanceRequestId: string,
  studentId: string
): Promise<ArchiveBlocker> {
  const cr = await prisma.clearanceRequest.findUnique({
    where: { id: clearanceRequestId },
    include: { signatures: { select: { status: true } } },
  });
  if (!cr) {
    return { ok: false, message: 'We could not find that clearance request.' };
  }
  if (cr.studentId !== studentId) {
    return { ok: false, message: 'You do not have permission to archive this request.' };
  }
  if (cr.isArchived) {
    return { ok: false, message: 'This request is already archived.' };
  }
  const hasNonPending = cr.signatures.some((s) => s.status !== 'pending');
  if (hasNonPending) {
    return {
      ok: false,
      message:
        'This request can no longer be archived because one or more offices have already started processing it.',
    };
  }
  return { ok: true };
}

/** Block removing a signatory from the default order if active student clearances depend on it. */
export async function getDefaultSignatoryRemoveBlockers(
  prisma: PrismaClient,
  defaultSignatoryRowId: string
): Promise<ArchiveBlocker> {
  const row = await prisma.clearanceDefaultSignatory.findUnique({
    where: { id: defaultSignatoryRowId },
    select: { signatoryId: true },
  });
  if (!row) {
    return { ok: false, message: 'We could not find that default signatory entry.' };
  }

  const activeDefaultCount = await prisma.clearanceDefaultSignatory.count();
  if (activeDefaultCount <= 1) {
    return {
      ok: false,
      message: 'At least one signatory must remain in the default order. Add another before removing this one.',
    };
  }

  const pendingOnSignatory = await prisma.clearanceSignature.count({
    where: {
      signatoryId: row.signatoryId,
      status: { in: ['pending', 'in_progress'] },
      clearanceRequest: { isArchived: false },
    },
  });
  if (pendingOnSignatory > 0) {
    return {
      ok: false,
      message:
        'This signatory still has pending clearance steps. Wait until they are finished before removing them from the default order.',
    };
  }

  return { ok: true };
}
