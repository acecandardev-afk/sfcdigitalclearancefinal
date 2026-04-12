import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().min(1).max(200),
  role: z.enum(['student', 'signatory', 'superadmin']),
});

export async function POST(req: Request) {
  const session = await getServerSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, full_name, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      profile: {
        create: {
          email: email.toLowerCase(),
          fullName: full_name,
        },
      },
      roles: {
        create: [{ role }],
      },
    },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
