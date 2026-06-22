import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getAppSession } from '@/lib/getAppSession';
import { prisma } from '@/server/db';
import { canManageStudents } from '@/lib/permissionsMatrix';
import { apiErrorResponse, apiMsg } from '@/server/apiUserError';

/** Session uses headers — must not be statically analyzed at build time. */
export const dynamic = 'force-dynamic';

function requireStudentAdmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && canManageStudents(roles));
}

export async function GET(req: Request) {
  try {
    const session = await getAppSession();
    if (!requireStudentAdmin(session)) {
      return apiErrorResponse(apiMsg.forbidden, 403);
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

    return NextResponse.json({
      students: mapped,
      archivedCount: await prisma.user.count({
        where: {
          roles: { some: { role: 'student' } },
          profile: { isArchived: true },
        },
      }),
    });
  } catch (e: unknown) {
    console.error('[GET /api/students]', e);
    return NextResponse.json(
      { error: 'Could not load the student list right now. Please try again shortly.' },
      { status: 500 }
    );
  }
}
