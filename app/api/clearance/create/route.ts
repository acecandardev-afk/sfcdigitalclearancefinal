import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getServerSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const studentId = (session.user as any).id as string;

  const clearance = await prisma.clearanceRequest.create({
    data: {
      studentId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: 'pending',
    },
  });

  return NextResponse.json({ id: clearance.id });
}
