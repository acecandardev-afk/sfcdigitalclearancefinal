import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().min(1).max(200),
  secret: z.string().min(1),
});

/**
 * One-time bootstrap endpoint to create the first superadmin user in a fresh DB.
 * Protect with env: BOOTSTRAP_SECRET.
 */
export async function POST(req: Request) {
  const envSecret = process.env.BOOTSTRAP_SECRET;
  if (!envSecret) {
    return NextResponse.json({ error: 'BOOTSTRAP_SECRET not set' }, { status: 500 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.secret !== envSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingAdmins = await prisma.userRole.count({ where: { role: 'superadmin' } });
  if (existingAdmins > 0) {
    return NextResponse.json({ error: 'Bootstrap already completed' }, { status: 409 });
  }

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          email,
          fullName: parsed.data.full_name,
        },
      },
      roles: {
        create: [{ role: 'superadmin' }],
      },
    },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
