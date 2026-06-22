import { prisma } from '@/server/db';
import { activeItemId } from '@/lib/institutionalSequential';
import { sendTransactionalEmail } from '@/server/email/emailAdapter';

export async function notifyUser(userId: string, title: string, message: string) {
  await prisma.notification.create({
    data: { userId, title, message },
  });
  if (process.env.SEND_NOTIFICATION_EMAIL === '1') {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (u?.email) {
      void sendTransactionalEmail({
        to: u.email,
        subject: title,
        html: `<p>${escapeHtml(message)}</p>`,
      });
    }
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
/** After a Section II row is updated — tell requester on reject; tell next assignee when step advances. */
export async function notifyAfterInstitutionalItemPatch(params: {
  clearanceId: string;
  itemId: string;
  newStatus: string;
  departmentLabel: string;
  clearancesRequesterId: string;
}) {
  const { clearanceId, itemId, newStatus, departmentLabel, clearancesRequesterId } = params;

  if (newStatus === 'rejected') {
    await notifyUser(
      clearancesRequesterId,
      'Institutional clearance — line not cleared',
      `${departmentLabel} marked this line as not cleared. Open your clearance to review remarks.`
    );
    return;
  }

  if (newStatus !== 'approved' && newStatus !== 'waived') return;

  const items = await prisma.institutionalClearanceItem.findMany({
    where: { institutionalClearanceId: clearanceId },
    orderBy: { sortOrder: 'asc' },
    include: { signatory: { select: { userId: true, name: true } } },
  });

  const nextId = activeItemId(
    items.map((i) => ({ id: i.id, sortOrder: i.sortOrder, status: i.status }))
  );
  if (!nextId) {
    await notifyUser(
      clearancesRequesterId,
      'Institutional clearance — all offices signed',
      'All clearance lines are complete. Complete Section III (certification) and final clearance as needed.'
    );
    return;
  }
  const next = items.find((i) => i.id === nextId);
  if (!next?.signatoryId || !next.signatory?.userId) return;
  await notifyUser(
    next.signatory.userId,
    'Institutional clearance — your sign-off',
    `It is your turn to sign: ${next.departmentLabel} for a pending employee clearance.`
  );
}

/** When a new clearance is submitted (pending), alert the first assignee in line (if mapped to a user). */
export async function notifyFirstInstitutionalAssignee(clearanceId: string) {
  const items = await prisma.institutionalClearanceItem.findMany({
    where: { institutionalClearanceId: clearanceId },
    orderBy: { sortOrder: 'asc' },
    include: { signatory: { select: { userId: true } } },
  });
  const first = items[0];
  if (!first?.signatoryId || !first.signatory?.userId) return;
  await notifyUser(
    first.signatory.userId,
    'Institutional clearance — action required',
    `A new employee clearance is ready for your office: ${first.departmentLabel}.`
  );
}

export async function notifyRequesterInstitutionalCompleted(requesterId: string) {
  await notifyUser(
    requesterId,
    'Institutional clearance — record completed',
    'Your institutional clearance has been marked complete.'
  );
}
