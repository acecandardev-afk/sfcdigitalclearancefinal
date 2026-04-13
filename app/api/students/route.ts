import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';

/** Session uses headers — must not be statically analyzed at build time. */
export const dynamic = 'force-dynamic';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

export async function GET(req: Request) {
  try {
    const session = await getAppSession();
    if (!requireSuperadmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'Superadmin session required. Sign out and sign in again if this persists.' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const showArchived = url.searchParams.get('archived') === '1';
    const course = url.searchParams.get('course');
    const yearLevel = url.searchParams.get('year_level');

    const hasCourse = Boolean(course && course !== 'all');
    const hasYear = Boolean(yearLevel && yearLevel !== 'all');

    const profileExtras: Prisma.ProfileWhereInput = {};
    if (hasCourse && hasYear) {
      profileExtras.course = course!;
      profileExtras.yearLevel = yearLevel!;
    } else if (hasCourse) {
      profileExtras.course = course!;
    } else if (hasYear) {
      profileExtras.yearLevel = yearLevel!;
    }
    const hasProfileExtras = Object.keys(profileExtras).length > 0;

    let where: Prisma.UserWhereInput = {
      roles: { some: { role: 'student' } },
    };

    if (showArchived) {
      where = {
        ...where,
        profile: {
          isArchived: true,
          ...(hasProfileExtras ? profileExtras : {}),
        },
      };
    } else if (hasProfileExtras) {
      // Course/year filters only apply when a profile exists
      where = {
        ...where,
        profile: {
          isArchived: false,
          ...profileExtras,
        },
      };
    } else {
      // Active: not archived. `isArchived` is Boolean (never null) — do not query null on booleans.
      // Include users missing a profile row so they still appear for admin cleanup.
      where = {
        ...where,
        OR: [{ profile: { is: null } }, { profile: { isArchived: false } }],
      };
    }

    const students = await prisma.user.findMany({
      where,
      include: { profile: true },
      orderBy: [{ email: 'asc' }],
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
  } catch (e: unknown) {
    console.error('[GET /api/students]', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load students', detail: message }, { status: 500 });
  }
}
