import { prisma } from '@/server/db';

type Jsonish = Record<string, unknown> | unknown[] | string | number | boolean | null;

/**
 * Append-only audit row (ActivityLog). Failures are logged; callers are not blocked.
 */
export async function writeAuditLog(input: {
  userId: string;
  action: string;
  details?: Jsonish;
  req?: Request | null;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        action: input.action.slice(0, 100),
        details: input.details === undefined ? undefined : (input.details as object),
        userAgent: input.req?.headers.get('user-agent') ?? undefined,
        ipAddress:
          input.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          input.req?.headers.get('x-real-ip') ??
          undefined,
      },
    });
  } catch (e) {
    console.error('[writeAuditLog]', e);
  }
}
