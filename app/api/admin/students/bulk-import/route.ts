import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/getAppSession';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { Prisma, Role } from '@prisma/client';
import { canCreateStudentAccounts } from '@/lib/permissionsMatrix';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 500;

function generateInitialPassword() {
  return randomBytes(9).toString('base64url');
}

function emptyStrToUndef(val: unknown): unknown {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    const t = val.trim();
    return t === '' ? undefined : t;
  }
  return val;
}

function deriveEmail(studentId: string, rowIndex: number): string {
  const base =
    studentId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() ||
    `student${rowIndex}`;
  return `${base}@student.import`;
}

const RowSchema = z.preprocess(
  (row) => {
    if (!row || typeof row !== 'object') return row;
    const r = row as Record<string, unknown>;
    return {
      email: typeof r.email === 'string' ? r.email.trim().toLowerCase() : emptyStrToUndef(r.email),
      full_name: typeof r.full_name === 'string' ? r.full_name.trim() : r.full_name,
      student_id: emptyStrToUndef(r.student_id),
      year_level: emptyStrToUndef(r.year_level),
      course: emptyStrToUndef(r.course),
    };
  },
  z.object({
    email: z.string().email().optional(),
    full_name: z.string().min(1).max(200),
    student_id: z.string().min(1).max(100),
    year_level: z.string().min(1).max(50),
    course: z.string().min(1).max(200),
  })
);

const BodySchema = z.object({
  students: z.array(z.unknown()).min(1).max(MAX_ROWS),
});

type RowPayload = z.infer<typeof RowSchema>;

async function createOneStudent(
  row: RowPayload,
  passwordHash: string,
  rowIndex: number
): Promise<{ ok: true; id: string; email: string } | { ok: false; email: string; error: string }> {
  const email = row.email && row.email.length > 0 ? row.email : deriveEmail(row.student_id, rowIndex);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            email,
            fullName: row.full_name,
            studentId: row.student_id.trim(),
            yearLevel: row.year_level.trim(),
            course: row.course.trim(),
          },
        },
        roles: {
          create: [{ role: Role.student }],
        },
      },
    });
    return { ok: true, id: user.id, email };
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return {
        ok: false,
        email,
        error: 'This email or student ID is already registered.',
      };
    }
    return { ok: false, email, error: 'Could not add this student. Try again or check for duplicates.' };
  }
}

export async function POST(req: Request) {
  const session = await getAppSession();
  const roles = ((session?.user as { roles?: string[] })?.roles ?? []) as string[];

  if (!session?.user || !canCreateStudentAccounts(roles)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'The uploaded file could not be read. Check the format and try again.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check your entries and try again.' },
      { status: 400 }
    );
  }

  const initialPassword = generateInitialPassword();
  const passwordHash = await bcrypt.hash(initialPassword, 10);
  const results: Array<{ email: string; ok: boolean; id?: string; error?: string }> = [];

  for (let i = 0; i < parsed.data.students.length; i++) {
    const rowParsed = RowSchema.safeParse(parsed.data.students[i]);
    if (!rowParsed.success) {
      results.push({
        email: `row-${i + 1}`,
        ok: false,
        error: 'This row is missing name, student ID, year, or course.',
      });
      continue;
    }

    const out = await createOneStudent(rowParsed.data, passwordHash, i + 1);
    if (out.ok === true) {
      results.push({ email: out.email, ok: true, id: out.id });
    } else {
      results.push({ email: out.email, ok: false, error: out.error });
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: 'No valid student rows were found in the upload.' },
      { status: 400 }
    );
  }

  const created = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    defaultPassword: initialPassword,
    created,
    failed,
    total: results.length,
    results,
    message:
      failed === 0
        ? `All ${created} student account(s) were created. Initial password for this import is "${initialPassword}".`
        : `${created} created, ${failed} failed. Created students should sign in with the initial password "${initialPassword}" unless a row failed.`,
  });
}
