import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/server/db';
import { canCreateStudentAccounts, canCreateUsers } from '@/lib/permissionsMatrix';

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().min(1).max(200),
  role: z.nativeEnum(Role),
  student_id: z.string().max(100).optional(),
  year_level: z.string().max(50).optional(),
  course: z.string().max(200).optional(),
  signatory_id: z.string().optional(),
});

function canPerformCreate(roles: string[], body: z.infer<typeof BodySchema>) {
  if (canCreateUsers(roles)) return true;
  if (
    canCreateStudentAccounts(roles) &&
    body.role === Role.student &&
    !body.signatory_id
  ) {
    return true;
  }
  return false;
}

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session as any)?.user?.roles ?? []) as string[];

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  if (!session?.user || !canPerformCreate(roles, parsed.data)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, password, full_name, role, student_id, year_level, course, signatory_id } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
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

    if (role === Role.signatory && signatory_id) {
      await prisma.signatory.update({
        where: { id: signatory_id },
        data: { userId: user.id },
      });
    }

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'This email address is already registered. Use another email.' },
        { status: 409 }
      );
    }
    console.error('[POST /api/admin/create-user]', e);
    return NextResponse.json({ error: 'Could not create user.' }, { status: 500 });
  }
}
