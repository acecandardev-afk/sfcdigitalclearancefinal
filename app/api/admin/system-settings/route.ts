import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

const KEYS = ['general', 'notifications', 'security', 'clearance'] as const;

export async function GET() {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings: Record<string, unknown> = {};
  for (const key of KEYS) {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    settings[key] = row?.valueJson ?? null;
  }

  return NextResponse.json({ settings });
}

const PutSchema = z.object({
  key: z.enum(KEYS),
  valueJson: z.any(),
});

export async function PUT(req: Request) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.systemSetting.upsert({
    where: { key: parsed.data.key },
    create: { key: parsed.data.key, valueJson: parsed.data.valueJson },
    update: { valueJson: parsed.data.valueJson },
  });

  return NextResponse.json({ ok: true });
}
