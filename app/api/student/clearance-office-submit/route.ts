import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { Prisma, type RequirementKind } from '@prisma/client';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { parseClearancePeriodFromSettings } from '@/lib/clearancePeriod';
import { effectiveClearanceEnd } from '@/lib/effectiveClearanceDeadline';
import { isSignatoryOpenNow } from '@/lib/officeHours';
import { writeAuditLog } from '@/server/auditLog';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';
import {
  getStudentPreClearanceStatus,
  preClearanceBlockMessage,
} from '@/server/preClearanceService';

function prismaErrorMessage(e: unknown): { status: number; error: string } {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002':
        return {
          status: 409,
          error: 'This clearance step was updated elsewhere. Refresh the page and try again.',
        };
      case 'P2003':
        return {
          status: 400,
          error:
            'A linked record is missing (for example the assigned office). Ask your administrator to check signatory setup, then refresh.',
        };
      case 'P2025':
        return {
          status: 400,
          error: 'We could not find that record. Refresh and try again.',
        };
      case 'P2028':
      case 'P2034':
        return {
          status: 503,
          error:
            'Saving took too long or conflicted with another update. Wait a moment, refresh My Clearance, and try again (or submit offices one at a time).',
        };
      default:
        return {
          status: 500,
          error: 'Could not save your submission. Please try again.',
        };
    }
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      error: 'Some of the information you entered could not be saved. Check your entries and try again.',
    };
  }
  return {
    status: 500,
    error: 'Could not save your submission. Please try again.',
  };
}

const httpUrl = z
  .string()
  .min(1)
  .max(2048)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Invalid file URL');

const FulfillmentSchema = z.object({
  requirement_id: z.number().int(),
  document_urls: z
    .array(
      z.object({
        blob_url: httpUrl,
        file_name: z.string().min(1).max(500),
        content_type: z.string().max(200).nullable().optional(),
      })
    )
    .optional(),
  physical_attested: z.boolean().optional(),
});

const BodySchema = z.object({
  clearanceRequestId: z.string().nullable().optional(),
  readonlyCompleted: z.boolean().optional(),
  signatoryId: z.string().min(1),
  sequenceOrder: z.number().int().min(0),
  signatoryGroup: z.enum(['standard', 'authority']),
  authoritySequenceOrder: z.number().int().nullable().optional(),
  signatureId: z.string().nullable().optional(),
  note: z.string().trim().min(1, 'Remarks are required').max(5000),
  files: z.array(
    z.object({
      blob_url: httpUrl,
      file_name: z.string().min(1).max(500),
      content_type: z.string().max(200).nullable().optional(),
    })
  ),
  fulfillments: z.array(FulfillmentSchema).optional(),
  /** Part I parallel “submit all”: same payload applied to every listed operational signatory (first id must match `signatoryId`). */
  batchOperationalSignatoryIds: z.array(z.string().min(1)).min(2).optional(),
});

type FulfillmentIn = z.infer<typeof FulfillmentSchema>;

function mapPrimaryFulfillmentsToTargetRequirements(
  primaryReqs: { id: number; kind: RequirementKind; label: string; required: boolean }[],
  primaryFulfillments: FulfillmentIn[],
  targetReqs: { id: number; kind: RequirementKind; label: string; required: boolean }[]
): FulfillmentIn[] {
  if (primaryReqs.length !== targetReqs.length) {
    throw new Error('BATCH_REQUIREMENT_MISMATCH');
  }
  const primaryById = new Map(primaryFulfillments.map((f) => [f.requirement_id, f]));
  const out: FulfillmentIn[] = [];
  for (let i = 0; i < primaryReqs.length; i++) {
    if (primaryReqs[i].kind !== targetReqs[i].kind) {
      throw new Error('BATCH_REQUIREMENT_MISMATCH');
    }
    const pin = primaryById.get(primaryReqs[i].id);
    if (primaryReqs[i].required && !pin) {
      throw new Error('BATCH_REQUIREMENT_MISMATCH');
    }
    out.push({
      requirement_id: targetReqs[i].id,
      document_urls: pin?.document_urls,
      physical_attested: pin?.physical_attested,
    });
  }
  return out;
}

async function submitOneClearanceStep(
  tx: Prisma.TransactionClient,
  params: {
    requestId: string;
    signatoryId: string;
    sequenceOrder: number;
    signatoryGroup: 'standard' | 'authority';
    authoritySequenceOrder: number | null;
    clientSignatureId: string | null;
    note: string;
    files: z.infer<typeof BodySchema>['files'];
    fulfillments: FulfillmentIn[] | null;
    dbReqs: { id: number; kind: RequirementKind; label: string; required: boolean }[];
    hasDb: boolean;
    physicalPreVerified: boolean;
  }
): Promise<string> {
  const {
    requestId,
    signatoryId,
    sequenceOrder,
    signatoryGroup,
    authoritySequenceOrder,
    clientSignatureId,
    note,
    files,
    fulfillments,
    dbReqs,
    hasDb,
    physicalPreVerified,
  } = params;

  let sigId = clientSignatureId;

  if (sigId) {
    const sig = await tx.clearanceSignature.findFirst({
      where: { id: sigId, clearanceRequestId: requestId },
    });
    if (!sig) {
      throw new Error('Signature not found');
    }
    await tx.clearanceFile.deleteMany({ where: { signatureId: sigId } });
    await tx.clearanceRequirementFulfillment.deleteMany({ where: { clearanceSignatureId: sigId } });
    await tx.clearanceSignature.update({
      where: { id: sigId },
      data: {
        status: 'pending',
        remarks: note,
        signedAt: null,
      },
    });
  } else {
    const existing = await tx.clearanceSignature.findFirst({
      where: { clearanceRequestId: requestId, signatoryId },
    });
    if (existing) {
      sigId = existing.id;
      await tx.clearanceFile.deleteMany({ where: { signatureId: sigId } });
      await tx.clearanceRequirementFulfillment.deleteMany({ where: { clearanceSignatureId: sigId } });
      await tx.clearanceSignature.update({
        where: { id: sigId },
        data: {
          sequenceOrder,
          status: 'pending',
          signatoryGroup,
          authoritySequenceOrder: authoritySequenceOrder ?? null,
          remarks: note,
          signedAt: null,
        },
      });
    } else {
      const createdSig = await tx.clearanceSignature.create({
        data: {
          clearanceRequestId: requestId,
          signatoryId,
          sequenceOrder,
          status: 'pending',
          signatoryGroup,
          authoritySequenceOrder: authoritySequenceOrder ?? null,
          remarks: note,
        },
      });
      sigId = createdSig.id;
    }
  }

  if (hasDb && fulfillments && sigId) {
    const byId = new Map(fulfillments.map((f) => [f.requirement_id, f]));
    for (const r of dbReqs) {
      const p = byId.get(r.id);
      const docUrls: { blobUrl: string; fileName: string; contentType?: string | null }[] = [];
      if (r.kind === 'document' && p?.document_urls?.length) {
        for (const u of p.document_urls) {
          docUrls.push({
            blobUrl: u.blob_url,
            fileName: u.file_name,
            contentType: u.content_type ?? null,
          });
          await tx.clearanceFile.create({
            data: {
              clearanceRequestId: requestId,
              signatureId: sigId,
              fileName: u.file_name,
              contentType: u.content_type ?? null,
              blobUrl: u.blob_url,
            },
          });
        }
      }
      await tx.clearanceRequirementFulfillment.create({
        data: {
          clearanceSignatureId: sigId,
          signatoryRequirementId: r.id,
          documentUrls: docUrls as unknown as Prisma.InputJsonValue,
          physicalAttestedAt:
            r.kind === 'physical' && (p?.physical_attested || physicalPreVerified) ? new Date() : null,
        },
      });
    }
  } else if (files.length > 0 && sigId) {
    for (const f of files) {
      await tx.clearanceFile.create({
        data: {
          clearanceRequestId: requestId,
          signatureId: sigId,
          fileName: f.file_name,
          contentType: f.content_type ?? null,
          blobUrl: f.blob_url,
        },
      });
    }
  }

  return sigId!;
}

async function loadStudentSignatoryAssigns(studentId: string) {
  const personal = await prisma.studentSignatoryAssignment.findMany({
    where: { studentId },
    orderBy: { sequenceOrder: 'asc' },
    include: {
      signatory: {
        include: { requirements: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  if (personal.length) {
    return personal.map((a) => ({
      signatoryId: a.signatoryId,
      sequenceOrder: a.sequenceOrder,
      signatoryGroup: a.signatoryGroup,
      signatory: a.signatory,
    }));
  }
  const defaults = await prisma.clearanceDefaultSignatory.findMany({
    orderBy: { sequenceOrder: 'asc' },
    include: {
      signatory: {
        include: { requirements: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  return defaults.map((d) => ({
    signatoryId: d.signatoryId,
    sequenceOrder: d.sequenceOrder,
    signatoryGroup: d.signatory.signatoryGroup,
    signatory: d.signatory,
  }));
}

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !canRequestStudentClearance(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as any).id as string;
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const b = parsed.data;
  if (b.readonlyCompleted) {
    return NextResponse.json({ error: 'This clearance cycle is closed' }, { status: 400 });
  }

  const clearanceSetting = await prisma.systemSetting.findUnique({
    where: { key: 'clearance' },
    select: { valueJson: true },
  });
  const period = parseClearancePeriodFromSettings(clearanceSetting?.valueJson);
  const approvedExt = await prisma.clearancePeriodExtension.findMany({
    where: { studentId, status: 'approved' },
    select: { extendsTo: true, status: true },
  });
  const gate = effectiveClearanceEnd(period, approvedExt);
  if (!gate.allowed) {
    const reason = 'reason' in gate ? gate.reason : 'Submissions are not available for this clearance period.';
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  const preClearanceStatus = await getStudentPreClearanceStatus(studentId);
  if (!preClearanceStatus.allComplete) {
    return NextResponse.json(
      { error: preClearanceBlockMessage(preClearanceStatus.missingGates) },
      { status: 400 }
    );
  }
  const physicalPreVerified = preClearanceStatus.allComplete;

  const security = await prisma.systemSetting.findUnique({
    where: { key: 'security' },
    select: { valueJson: true },
  });
  const allowMultiple =
    (security?.valueJson as { allow_multiple_clearances?: boolean } | null)?.allow_multiple_clearances === true;

  if (b.clearanceRequestId) {
    const cr = await prisma.clearanceRequest.findUnique({
      where: { id: b.clearanceRequestId },
      select: { studentId: true },
    });
    if (!cr || cr.studentId !== studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (!allowMultiple) {
    const active = await prisma.clearanceRequest.count({
      where: {
        studentId,
        status: { in: ['pending', 'in_progress'] },
      },
    });
    if (active > 0) {
      return NextResponse.json(
        { error: 'You already have an active clearance request.' },
        { status: 400 }
      );
    }
  }

  const batchIds = b.batchOperationalSignatoryIds;
  if (batchIds?.length) {
    if (b.signatureId) {
      return NextResponse.json(
        {
          error:
            'Batch submit cannot be used when resubmitting an office. Use the row action for that office, or refresh My Clearance.',
        },
        { status: 400 }
      );
    }
    if (batchIds[0] !== b.signatoryId) {
      return NextResponse.json({ error: 'Invalid batch submit. Refresh My Clearance and try again.' }, { status: 400 });
    }
    const uniq = new Set(batchIds);
    if (uniq.size !== batchIds.length) {
      return NextResponse.json({ error: 'Duplicate offices in batch submit.' }, { status: 400 });
    }
    // Do not reject when some signatures already exist — submitOneClearanceStep updates existing rows
    // (e.g. student submitted one office first, then uses submit-all for the rest).
  }

  const signatoryRow = await prisma.signatory.findUnique({
    where: { id: b.signatoryId },
    include: { requirements: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!signatoryRow) {
    return NextResponse.json(
      { error: 'This office is no longer available. Refresh the page or contact your administrator.' },
      { status: 400 }
    );
  }
  if (!signatoryRow.isActive) {
    return NextResponse.json(
      { error: 'This office is inactive. Contact your administrator.' },
      { status: 400 }
    );
  }

  if (!isSignatoryOpenNow(signatoryRow.weeklyHoursJson)) {
    return NextResponse.json(
      { error: 'This office is not accepting submissions right now (outside posted hours).' },
      { status: 400 }
    );
  }

  const dbReqs = signatoryRow.requirements;
  const hasDb = dbReqs.length > 0;
  if (hasDb) {
    if (!b.fulfillments?.length) {
      return NextResponse.json(
        { error: 'This office uses configured requirements — submit fulfillments from the form.' },
        { status: 400 }
      );
    }
    const byId = new Map(b.fulfillments.map((f) => [f.requirement_id, f]));
    for (const r of dbReqs) {
      if (r.required) {
        const p = byId.get(r.id);
        if (!p) {
          return NextResponse.json({ error: `Missing fulfillment for requirement: ${r.label}` }, { status: 400 });
        }
        if (r.kind === 'document' && !p.document_urls?.length) {
          return NextResponse.json({ error: `Documents required: ${r.label}` }, { status: 400 });
        }
        if (r.kind === 'physical' && !p.physical_attested && !physicalPreVerified) {
          return NextResponse.json({ error: `Confirmation required: ${r.label}` }, { status: 400 });
        }
      }
    }
  }

  const mismatchMsg =
    'Submit-all needs the same requirement layout for every office (same count and types in order), or only offices with no configured requirements. Ask your administrator to align templates, or submit offices one at a time.';

  const fulfillmentsBySignatoryId = new Map<string, FulfillmentIn[] | null>();
  let assignBySigId = new Map<
    string,
    { sequenceOrder: number; signatoryGroup: string; signatory: typeof signatoryRow }
  >();
  let signatoryById = new Map<string, typeof signatoryRow>();

  if (batchIds?.length) {
    const assigns = await loadStudentSignatoryAssigns(studentId);
    assignBySigId = new Map(
      assigns.map((a) => [
        a.signatoryId,
        { sequenceOrder: a.sequenceOrder, signatoryGroup: a.signatoryGroup, signatory: a.signatory },
      ])
    );

    for (const sid of batchIds) {
      const a = assignBySigId.get(sid);
      if (!a || !a.signatory.isActive) {
        return NextResponse.json(
          { error: 'One or more offices are not on your clearance list or are inactive. Refresh and try again.' },
          { status: 400 }
        );
      }
      if (a.signatory.signatoryGroup !== 'standard') {
        return NextResponse.json(
          { error: 'Submit-all is only for Part I operational offices.' },
          { status: 400 }
        );
      }
      if (!isSignatoryOpenNow(a.signatory.weeklyHoursJson)) {
        const label = a.signatory.department || a.signatory.name;
        return NextResponse.json(
          { error: `This office is not accepting submissions right now (outside posted hours): ${label}` },
          { status: 400 }
        );
      }
    }

    const restIds = batchIds.slice(1);
    const restRows =
      restIds.length > 0
        ? await prisma.signatory.findMany({
            where: { id: { in: restIds } },
            include: { requirements: { orderBy: { sortOrder: 'asc' } } },
          })
        : [];
    signatoryById = new Map([[signatoryRow.id, signatoryRow], ...restRows.map((r) => [r.id, r] as const)]);

    const primaryReqsOrdered = dbReqs.map((r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      required: r.required,
    }));

    fulfillmentsBySignatoryId.set(batchIds[0]!, b.fulfillments ?? null);

    if (!hasDb) {
      for (const sid of restIds) {
        const row = signatoryById.get(sid);
        if (!row) {
          return NextResponse.json({ error: 'Office not found. Refresh and try again.' }, { status: 400 });
        }
        if (row.requirements.length > 0) {
          return NextResponse.json({ error: mismatchMsg }, { status: 400 });
        }
        fulfillmentsBySignatoryId.set(sid, null);
      }
    } else {
      for (const sid of restIds) {
        const row = signatoryById.get(sid);
        if (!row) {
          return NextResponse.json({ error: 'Office not found. Refresh and try again.' }, { status: 400 });
        }
        const tReqs = row.requirements.map((r) => ({
          id: r.id,
          kind: r.kind,
          label: r.label,
          required: r.required,
        }));
        try {
          const mapped = mapPrimaryFulfillmentsToTargetRequirements(
            primaryReqsOrdered,
            b.fulfillments!,
            tReqs
          );
          fulfillmentsBySignatoryId.set(sid, mapped);
        } catch {
          return NextResponse.json({ error: mismatchMsg }, { status: 400 });
        }
      }
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let requestId = b.clearanceRequestId ?? null;

      if (!requestId) {
        const title = `Clearance — ${new Date().toLocaleDateString('en-US')}`;
        const created = await tx.clearanceRequest.create({
          data: {
            studentId,
            title,
            description: b.note || null,
            status: 'pending',
          },
        });
        requestId = created.id;
      }

      let firstSignatureId: string | null = null;

      if (batchIds?.length) {
        for (const sid of batchIds) {
          const a = assignBySigId.get(sid);
          const si = signatoryById.get(sid);
          if (!a || !si) {
            throw new Error('BATCH_ASSIGN_OR_OFFICE_MISSING');
          }
          const tReqs = si.requirements;
          const tHasDb = tReqs.length > 0;
          const ful = fulfillmentsBySignatoryId.get(sid) ?? null;
          const sigId = await submitOneClearanceStep(tx, {
            requestId: requestId!,
            signatoryId: sid,
            sequenceOrder: a.sequenceOrder,
            signatoryGroup: a.signatoryGroup as 'standard' | 'authority',
            authoritySequenceOrder: a.signatory.authoritySequenceOrder,
            clientSignatureId: null,
            note: b.note,
            files: b.files,
            fulfillments: tHasDb ? ful : null,
            dbReqs: tReqs,
            hasDb: tHasDb,
            physicalPreVerified,
          });
          if (!firstSignatureId) firstSignatureId = sigId;
        }
      } else {
        firstSignatureId = await submitOneClearanceStep(tx, {
          requestId: requestId!,
          signatoryId: b.signatoryId,
          sequenceOrder: b.sequenceOrder,
          signatoryGroup: b.signatoryGroup,
          authoritySequenceOrder: b.authoritySequenceOrder ?? null,
          clientSignatureId: b.signatureId ?? null,
          note: b.note,
          files: b.files,
          fulfillments: hasDb ? b.fulfillments ?? null : null,
          dbReqs,
          hasDb,
          physicalPreVerified,
        });
      }

      await tx.clearanceRequest.update({
        where: { id: requestId! },
        data: { status: 'in_progress' },
      });

      return { requestId: requestId!, signatureId: firstSignatureId! };
    }, { maxWait: 15_000, timeout: 120_000 });

    void writeAuditLog({
      userId: studentId,
      action: 'student_clearance_office_submit',
      details: {
        signatoryId: b.signatoryId,
        requestId: result.requestId,
        ...(batchIds?.length ? { batchOperationalSignatoryIds: batchIds } : {}),
      },
      req,
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('[clearance-office-submit]', e);
    if (e instanceof Error && e.message === 'Signature not found') {
      return NextResponse.json({ error: 'This step could not be found. Refresh and try again.' }, { status: 400 });
    }
    if (e instanceof Error && e.message === 'BATCH_REQUIREMENT_MISMATCH') {
      return NextResponse.json({ error: mismatchMsg }, { status: 400 });
    }
    if (e instanceof Error && e.message === 'BATCH_ASSIGN_OR_OFFICE_MISSING') {
      return NextResponse.json(
        { error: 'Your clearance list changed while submitting. Refresh My Clearance and try again.' },
        { status: 400 }
      );
    }
    const mapped = prismaErrorMessage(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
