import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { z } from 'zod';
import { prisma } from '@/server/db';

export async function GET() {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      yearLevel: true,
      course: true,
      address: true,
      age: true,
    },
  });

  return NextResponse.json({
    profile: {
      full_name: profile?.fullName ?? '',
      year_level: profile?.yearLevel ?? '',
      course: profile?.course ?? '',
      address: profile?.address ?? '',
      age: profile?.age ?? null,
    },
  });
}

const PatchSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  year_level: z.string().trim().max(50).nullable().optional(),
  course: z.string().trim().max(200).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = (session.user as any).id as string;
  const p = parsed.data;

  const updated = await prisma.profile.update({
    where: { id: userId },
    data: {
      fullName: p.full_name,
      ...(p.year_level !== undefined ? { yearLevel: p.year_level } : {}),
      ...(p.course !== undefined ? { course: p.course } : {}),
      ...(p.address !== undefined ? { address: p.address } : {}),
      ...(p.age !== undefined ? { age: p.age } : {}),
    },
  });

  return NextResponse.json({
    profile: {
      full_name: updated.fullName ?? '',
      year_level: updated.yearLevel ?? '',
      course: updated.course ?? '',
      address: updated.address ?? '',
      age: updated.age ?? null,
    },
  });
}
