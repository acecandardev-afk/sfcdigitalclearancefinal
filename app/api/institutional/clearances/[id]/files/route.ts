import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { z } from 'zod';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canAccessInstitutionalModule, canUseInstitutionalApp, sessionRoles } from '@/lib/apiAuth';

const CreateBody = z.object({
  file_name: z.string().min(1).max(500),
  content_type: z.string().max(200).optional().nullable(),
  blob_url: z.string().url().max(2000),
});

function canAccessFileRoute(userId: string, requesterId: string, roles: string[]) {
  if (!canUseInstitutionalApp(roles)) return false;
  if (userId === requesterId) return true;
  return canAccessInstitutionalModule(roles);
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  const { id } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const c = await prisma.institutionalClearance.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canAccessFileRoute(userId, c.requesterId, roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const files = await prisma.institutionalClearanceFile.findMany({
    where: { institutionalClearanceId: id, isArchived: false },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      file_name: f.fileName,
      content_type: f.contentType,
      blob_url: f.blobUrl,
      uploaded_at: f.createdAt.toISOString(),
      uploadedById: f.uploadedById,
    })),
  });
}

export async function POST(req: Request, context: Ctx) {
  const { id } = await context.params;
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const roles = sessionRoles(session);
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const c = await prisma.institutionalClearance.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canAccessFileRoute(userId, c.requesterId, roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }
  const b = parsed.data;

  const created = await prisma.institutionalClearanceFile.create({
    data: {
      institutionalClearanceId: id,
      fileName: b.file_name.trim(),
      contentType: b.content_type?.trim() || null,
      blobUrl: b.blob_url,
      uploadedById: userId,
    },
  });
  return NextResponse.json(
    {
      file: {
        id: created.id,
        file_name: created.fileName,
        content_type: created.contentType,
        blob_url: created.blobUrl,
        uploaded_at: created.createdAt.toISOString(),
        uploadedById: created.uploadedById,
      },
    },
    { status: 201 }
  );
}
