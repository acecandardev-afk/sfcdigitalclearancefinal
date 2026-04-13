import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  clearanceRequestId: z.string().nullable().optional(),
  readonlyCompleted: z.boolean().optional(),
  signatoryId: z.string().min(1),
  sequenceOrder: z.number().int().min(1),
  signatoryGroup: z.enum(['standard', 'authority']),
  authoritySequenceOrder: z.number().int().nullable().optional(),
  signatureId: z.string().nullable().optional(),
  note: z.string().max(5000),
  files: z.array(
    z.object({
      blob_url: z.string().url(),
      file_name: z.string().min(1).max(500),
      content_type: z.string().max(200).nullable().optional(),
    })
  ),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = (session.user as any).id as string;
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const b = parsed.data;
  if (b.readonlyCompleted) {
    return NextResponse.json({ error: 'This clearance cycle is closed' }, { status: 400 });
  }

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

  const result = await prisma.$transaction(async (tx) => {
    let requestId = b.clearanceRequestId ?? null;

    if (!requestId) {
      const title = `Clearance â€” ${new Date().toLocaleDateString('en-US')}`;
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

    let sigId = b.signatureId;

    if (sigId) {
      const sig = await tx.clearanceSignature.findFirst({
        where: { id: sigId, clearanceRequestId: requestId },
      });
      if (!sig) {
        throw new Error('Signature not found');
      }
      await tx.clearanceFile.deleteMany({ where: { signatureId: sigId } });
      await tx.clearanceSignature.update({
        where: { id: sigId },
        data: {
          status: 'pending',
          remarks: b.note,
          notes: b.note,
          signedAt: null,
        },
      });
    } else {
      const existing = await tx.clearanceSignature.findFirst({
        where: { clearanceRequestId: requestId, signatoryId: b.signatoryId },
      });
      if (existing) {
        sigId = existing.id;
        await tx.clearanceFile.deleteMany({ where: { signatureId: sigId } });
        await tx.clearanceSignature.update({
          where: { id: sigId },
          data: {
            sequenceOrder: b.sequenceOrder,
            status: 'pending',
            signatoryGroup: b.signatoryGroup as any,
            authoritySequenceOrder: b.authoritySequenceOrder ?? null,
            remarks: b.note,
            notes: b.note,
            signedAt: null,
          },
        });
      } else {
        const createdSig = await tx.clearanceSignature.create({
          data: {
            clearanceRequestId: requestId,
            signatoryId: b.signatoryId,
            sequenceOrder: b.sequenceOrder,
            status: 'pending',
            signatoryGroup: b.signatoryGroup as any,
            authoritySequenceOrder: b.authoritySequenceOrder ?? null,
            remarks: b.note,
            notes: b.note,
          },
        });
        sigId = createdSig.id;
      }
    }

    if (b.files.length > 0 && sigId) {
      await tx.clearanceFile.createMany({
        data: b.files.map((f) => ({
          clearanceRequestId: requestId!,
          signatureId: sigId!,
          fileName: f.file_name,
          contentType: f.content_type ?? null,
          blobUrl: f.blob_url,
        })),
      });
    }

    return { requestId: requestId!, signatureId: sigId! };
  });

  return NextResponse.json(result);
}
