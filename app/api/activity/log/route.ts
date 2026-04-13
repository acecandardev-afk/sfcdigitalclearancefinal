import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  action: z.string().min(1).max(100),
  details: z.any().optional(),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = (session.user as any).id as string;

  await prisma.activityLog.create({
    data: {
      userId,
      action: parsed.data.action,
      details: parsed.data.details ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    },
  });

  return NextResponse.json({ success: true });
}
