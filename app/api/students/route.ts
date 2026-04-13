import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const showArchived = url.searchParams.get('archived') === '1';
  const course = url.searchParams.get('course');
  const yearLevel = url.searchParams.get('year_level');

  const archivedClause = showArchived
    ? { isArchived: true }
    : { OR: [{ isArchived: false }, { isArchived: null as any }] };

  const profileWhere =
    course && course !== 'all' && yearLevel && yearLevel !== 'all'
      ? { ...archivedClause, course, yearLevel }
      : course && course !== 'all'
        ? { ...archivedClause, course }
        : yearLevel && yearLevel !== 'all'
          ? { ...archivedClause, yearLevel }
          : archivedClause;

  const students = await prisma.user.findMany({
    where: {
      roles: { some: { role: 'student' } },
      profile: profileWhere,
    },
    include: { profile: true },
    orderBy: { profile: { fullName: 'asc' } },
  });

  const mapped = students.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.profile?.fullName ?? '',
    student_id: u.profile?.studentId ?? null,
    year_level: u.profile?.yearLevel ?? null,
    course: u.profile?.course ?? null,
    is_archived: u.profile?.isArchived ?? false,
  }));

  return NextResponse.json({ students: mapped });
}
