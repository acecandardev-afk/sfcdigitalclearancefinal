import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

function prismaErrorMessage(e: unknown): { status: number; error: string; detail?: string } {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = e.meta ? JSON.stringify(e.meta) : '';
    const dev = process.env.NODE_ENV === 'development';
    switch (e.code) {
      case 'P2002':
        return {
          status: 409,
          error: 'This clearance step was updated elsewhere. Refresh the page and try again.',
          detail: dev ? `${e.message} ${meta}` : undefined,
        };
      case 'P2003':
        return {
          status: 400,
          error:
            'A linked record is missing (for example the assigned office). Ask your administrator to check signatory setup, then refresh.',
          detail: dev ? `${e.message} ${meta}` : undefined,
        };
      case 'P2025':
        return {
          status: 400,
          error: 'Record not found. Refresh and try again.',
          detail: dev ? e.message : undefined,
        };
      default:
        return {
          status: 500,
          error: 'Could not save your submission. Please try again.',
          detail: dev ? `${e.code}: ${e.message} ${meta}` : undefined,
        };
    }
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      error: 'Invalid data for this submission.',
      detail: process.env.NODE_ENV === 'development' ? e.message : undefined,
    };
  }
  const msg = e instanceof Error ? e.message : String(e);
  return {
    status: 500,
    error: 'Could not save your submission. Please try again.',
    detail: process.env.NODE_ENV === 'development' ? msg : undefined,
  };
}

/** Accept any absolute http(s) URL (Vercel Blob and other hosts; avoids strict z.string().url() rejects). */
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

const BodySchema = z.object({
  clearanceRequestId: z.string().nullable().optional(),
  readonlyCompleted: z.boolean().optional(),
  signatoryId: z.string().min(1),
  sequenceOrder: z.number().int().min(0),
  signatoryGroup: z.enum(['standard', 'authority']),
  authoritySequenceOrder: z.number().int().nullable().optional(),
  signatureId: z.string().nullable().optional(),
  note: z.string().max(5000),
  files: z.array(
    z.object({
      blob_url: httpUrl,
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

  const signatoryExists = await prisma.signatory.findUnique({
    where: { id: b.signatoryId },
    select: { id: true, isActive: true },
  });
  if (!signatoryExists) {
    return NextResponse.json(
      { error: 'This office is no longer available. Refresh the page or contact your administrator.' },
      { status: 400 }
    );
  }
  if (!signatoryExists.isActive) {
    return NextResponse.json(
      { error: 'This office is inactive. Contact your administrator.' },
      { status: 400 }
    );
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
      for (const f of b.files) {
        await tx.clearanceFile.create({
          data: {
            clearanceRequestId: requestId!,
            signatureId: sigId!,
            fileName: f.file_name,
            contentType: f.content_type ?? null,
            blobUrl: f.blob_url,
          },
        });
      }
    }

    await tx.clearanceRequest.update({
      where: { id: requestId! },
      data: { status: 'in_progress' },
    });

    return { requestId: requestId!, signatureId: sigId! };
  });

  return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('[clearance-office-submit]', e);
    if (e instanceof Error && e.message === 'Signature not found') {
      return NextResponse.json({ error: 'This step could not be found. Refresh and try again.' }, { status: 400 });
    }
    const mapped = prismaErrorMessage(e);
    return NextResponse.json(
      { error: mapped.error, ...(mapped.detail ? { detail: mapped.detail } : {}) },
      { status: mapped.status }
    );
  }
}
