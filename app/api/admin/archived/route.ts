import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canManageArchivedRecords } from '@/lib/permissionsMatrix';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getAppSession();
  const roles = (session?.user?.roles ?? []) as string[];
  if (!session?.user || !canManageArchivedRecords(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'all';

  const includeStudents = type === 'all' || type === 'students';
  const includeSignatories = type === 'all' || type === 'signatories';

  const [students, signatories] = await Promise.all([
    includeStudents
      ? prisma.user.findMany({
          where: {
            roles: { some: { role: 'student' } },
            profile: { isArchived: true },
          },
          include: { profile: true },
          orderBy: [{ profile: { archivedAt: 'desc' } }, { email: 'asc' }],
        })
      : Promise.resolve([]),
    includeSignatories
      ? prisma.signatory.findMany({
          where: { isArchived: true },
          orderBy: [{ archivedAt: 'desc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    students: students.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.profile?.fullName ?? '',
      student_id: u.profile?.studentId ?? null,
      course: u.profile?.course ?? null,
      year_level: u.profile?.yearLevel ?? null,
      archived_at: u.profile?.archivedAt?.toISOString() ?? null,
    })),
    signatories: signatories.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      department: s.department,
      position: s.position,
      archived_at: s.archivedAt?.toISOString() ?? null,
    })),
  });
}
