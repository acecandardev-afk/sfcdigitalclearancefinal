import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/server/db';

function requireSuperadmin(session: any) {
  const roles = (session?.user?.roles ?? []) as string[];
  return Boolean(session?.user && roles.includes('superadmin'));
}

export async function GET() {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signatories = await prisma.signatory.findMany({
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({ signatories });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  email: z.string().email().max(255),
  is_active: z.boolean().optional(),
  signatory_group: z.enum(['standard', 'authority']).optional(),
  authority_sequence_order: z.number().int().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!requireSuperadmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const s = parsed.data;
  const signatory = await prisma.signatory.create({
    data: {
      name: s.name,
      position: s.position,
      department: s.department,
      email: s.email.toLowerCase(),
      isActive: s.is_active ?? true,
      signatoryGroup: (s.signatory_group ?? 'standard') as any,
      authoritySequenceOrder: s.authority_sequence_order ?? null,
    },
  });

  return NextResponse.json({ signatory }, { status: 201 });
}
