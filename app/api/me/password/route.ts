import { NextResponse } from 'next/server';
import { apiValidationErrorResponse } from '@/server/apiUserError';
import { getAppSession } from '@/lib/getAppSession';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';

const BodySchema = z.object({
  current_password: z.string().min(1).max(72),
  new_password: z.string().min(6).max(72),
});

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return apiValidationErrorResponse();
  }

  const userId = (session.user as any).id as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'We could not find your account.' }, { status: 404 });
  }

  const ok = await bcrypt.compare(parsed.data.current_password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.new_password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return NextResponse.json({ success: true });
}
