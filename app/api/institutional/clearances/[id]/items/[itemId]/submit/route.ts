import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { Prisma, type RequirementKind } from '@prisma/client';
import { z } from 'zod';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { sessionRoles } from '@/lib/apiAuth';
import { isPreviousRowsCleared } from '@/lib/institutionalSequential';
import { isInstitutionalAdminElevation } from '@/lib/permissionsMatrix';
import { writeAuditLog } from '@/server/auditLog';

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
  note: z.string().trim().min(1, 'Remarks are required').max(5000),
  files: z
    .array(
      z.object({
        blob_url: httpUrl,
        file_name: z.string().min(1).max(500),
        content_type: z.string().max(200).nullable().optional(),
      })
    )
    .default([]),
  fulfillments: z.array(FulfillmentSchema).optional(),
});

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function POST(req: Request, context: Ctx) {
  const { id, itemId } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const item = await prisma.institutionalClearanceItem.findFirst({
    where: { id: itemId, institutionalClearanceId: id },
    include: {
      clearance: {
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
        },
      },
      signatory: {
        include: { requirements: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isOwner = item.clearance.requesterId === userId;
  const isAdmin = isInstitutionalAdminElevation(roles);
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (item.status !== 'pending') {
    return NextResponse.json({ error: 'This row is no longer pending submission.' }, { status: 400 });
  }

  const allRows = item.clearance.items.map((i) => ({
    id: i.id,
    sortOrder: i.sortOrder,
    status: i.status,
  }));
  const seq = isPreviousRowsCleared(allRows, itemId);
  if (!seq.ok) {
    return NextResponse.json(
      { error: 'Complete earlier signatories in order before submitting this office.' },
      { status: 400 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const b = parsed.data;
  const dbReqs = item.signatory?.requirements ?? [];
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
        if (r.kind === 'physical' && !p.physical_attested) {
          return NextResponse.json({ error: `Confirmation required: ${r.label}` }, { status: 400 });
        }
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.institutionalClearanceItemFulfillment.deleteMany({
        where: { institutionalClearanceItemId: itemId },
      });

      if (hasDb && b.fulfillments) {
        const byId = new Map(b.fulfillments.map((f) => [f.requirement_id, f]));
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
            }
          }
          await tx.institutionalClearanceItemFulfillment.create({
            data: {
              institutionalClearanceItemId: itemId,
              signatoryRequirementId: r.id,
              documentUrls: docUrls as unknown as Prisma.InputJsonValue,
              physicalAttestedAt: r.kind === 'physical' && p?.physical_attested ? new Date() : null,
            },
          });
        }
      }

      await tx.institutionalClearanceItem.update({
        where: { id: itemId },
        data: { submissionRemarks: b.note },
      });

      if (item.clearance.status === 'pending') {
        await tx.institutionalClearance.update({
          where: { id },
          data: { status: 'in_progress' },
        });
      }
    });

    void writeAuditLog({
      userId,
      action: 'institutional_item_office_submit',
      details: { institutionalClearanceId: id, itemId },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[institutional item submit]', e);
    return NextResponse.json({ error: 'Could not save submission.' }, { status: 500 });
  }
}
