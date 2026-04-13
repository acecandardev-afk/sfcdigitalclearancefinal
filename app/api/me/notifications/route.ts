import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/server/db';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const notifications = rows.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: 'info' as const,
    related_id: null,
    related_type: null,
    is_read: n.isRead,
    created_at: n.createdAt.toISOString(),
  }));

  return NextResponse.json({ notifications });
}

const PatchSchema = z.object({
  markAll: z.boolean().optional(),
  ids: z.array(z.string()).optional(),
  id: z.string().optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.markAll) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  const markIds = parsed.data.ids?.length
    ? parsed.data.ids
    : parsed.data.id
      ? [parsed.data.id]
      : [];
  if (markIds.length) {
    await prisma.notification.updateMany({
      where: { userId, id: { in: markIds } },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  await prisma.notification.deleteMany({ where: { userId, id } });
  return NextResponse.json({ ok: true });
}
