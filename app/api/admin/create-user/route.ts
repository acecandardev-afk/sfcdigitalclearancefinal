import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().min(1).max(200),
  role: z.enum(['student', 'signatory', 'superadmin']),
  student_id: z.string().max(100).optional(),
  year_level: z.string().max(50).optional(),
  course: z.string().max(200).optional(),
  signatory_id: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];
  if (!session?.user || !roles.includes('superadmin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, full_name, role, student_id, year_level, course, signatory_id } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      profile: {
        create: {
          email: email.toLowerCase(),
          fullName: full_name,
          ...(student_id ? { studentId: student_id } : {}),
          ...(year_level ? { yearLevel: year_level } : {}),
          ...(course ? { course } : {}),
        },
      },
      roles: {
        create: [{ role }],
      },
    },
  });

  if (role === 'signatory' && signatory_id) {
    await prisma.signatory.update({
      where: { id: signatory_id },
      data: { userId: user.id },
    });
  }

  return NextResponse.json({ id: user.id, email: user.email });
}
