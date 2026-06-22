import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { canRequestStudentClearance } from '@/lib/permissionsMatrix';
import {
  getStudentPreClearanceStatus,
  preClearanceBlockMessage,
} from '@/server/preClearanceService';

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  signatories: z
    .array(
      z.object({
        signatory_id: z.string().min(1),
        sequence_order: z.number().int().min(1),
        signatory_group: z.enum(['standard', 'authority']).optional(),
        authority_sequence_order: z.number().int().nullable().optional(),
      })
    )
    .min(1),
  files: z
    .array(
      z.object({
        file_name: z.string().min(1).max(500),
        content_type: z.string().max(200).nullable().optional(),
        blob_url: z.string().url(),
      })
    )
    .optional(),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !canRequestStudentClearance(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const studentId = (session.user as any).id as string;

  const preClearance = await getStudentPreClearanceStatus(studentId);
  if (!preClearance.allComplete) {
    return NextResponse.json(
      { error: preClearanceBlockMessage(preClearance.missingGates) },
      { status: 400 }
    );
  }

  const clearance = await prisma.$transaction(async (tx) => {
    const created = await tx.clearanceRequest.create({
      data: {
        studentId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: 'pending',
      },
    });

    await tx.clearanceSignature.createMany({
      data: parsed.data.signatories.map((s) => ({
        clearanceRequestId: created.id,
        signatoryId: s.signatory_id,
        status: 'pending',
        sequenceOrder: s.sequence_order,
        signatoryGroup: (s.signatory_group ?? 'standard') as any,
        authoritySequenceOrder: s.authority_sequence_order ?? null,
      })),
    });

    if (parsed.data.files && parsed.data.files.length > 0) {
      await tx.clearanceFile.createMany({
        data: parsed.data.files.map((f) => ({
          clearanceRequestId: created.id,
          fileName: f.file_name,
          contentType: f.content_type ?? null,
          blobUrl: f.blob_url,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({ id: clearance.id });
}
