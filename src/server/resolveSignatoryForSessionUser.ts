import type { PrismaClient } from '@prisma/client';

export type ResolvedSignatoryRow = {
  id: string;
  name: string;
  position: string;
  department: string;
};

/**
 * Links `Signatory.userId` when the row was matched by email only (legacy / manual data).
 * Prefer `userId` match first so institutional vs student rows stay unambiguous when emails differ.
 */
export async function resolveSignatoryForSessionUser(
  prisma: PrismaClient,
  userId: string
): Promise<ResolvedSignatoryRow | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email?.trim()) return null;

  const byUserId = await prisma.signatory.findFirst({
    where: { userId, isArchived: false },
    select: { id: true, name: true, position: true, department: true, userId: true, email: true },
  });
  if (byUserId) {
    return {
      id: byUserId.id,
      name: byUserId.name,
      position: byUserId.position,
      department: byUserId.department,
    };
  }

  const emailKey = user.email.trim();
  const byEmail = await prisma.signatory.findFirst({
    where: {
      isArchived: false,
      email: { equals: emailKey, mode: 'insensitive' },
      OR: [{ userId: null }, { userId }],
    },
    select: { id: true, name: true, position: true, department: true, userId: true, email: true },
  });

  if (!byEmail) return null;

  if (byEmail.userId != null && byEmail.userId !== userId) {
    return null;
  }

  if (byEmail.userId == null) {
    try {
      await prisma.signatory.update({
        where: { id: byEmail.id },
        data: { userId },
      });
    } catch {
      /* another concurrent link won userId unique — ignore */
    }
  }

  return {
    id: byEmail.id,
    name: byEmail.name,
    position: byEmail.position,
    department: byEmail.department,
  };
}
