import { format } from 'date-fns';
import type { UiStepRow } from './myClearanceTypes';

export type TimelineEntry = {
  id: string;
  action: string;
  timestamp: string;
  detail?: string;
  /** ISO time for merging with activity log rows */
  sortAt: string;
};

function fmt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'MMM d, yyyy · h:mm a');
}

function isoOrNull(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function buildTimelineEntries(row: UiStepRow): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (row.uiStatus === 'Request' && !row.signatureId) {
    return [];
  }

  const submitted = fmt(row.signatureCreatedAt);
  const submittedIso = isoOrNull(row.signatureCreatedAt) ?? new Date(0).toISOString();
  if (submitted) {
    entries.push({
      id: 'submitted',
      action: 'Request submitted',
      timestamp: submitted,
      detail: row.remarks !== '—' ? row.remarks : undefined,
      sortAt: submittedIso,
    });
  }

  if (row.uiStatus === 'Pending') {
    entries.push({
      id: 'review',
      action: 'Under review',
      timestamp: submitted ? `Since ${submitted}` : '—',
      detail: 'Waiting for signatory action',
      sortAt: submittedIso,
    });
    return entries;
  }

  if (row.uiStatus === 'Approved') {
    const approvedAt = fmt(row.signatureSignedAt) ?? submitted ?? '—';
    const sortAt = isoOrNull(row.signatureSignedAt) ?? submittedIso;
    entries.push({
      id: 'approved',
      action: 'Approved',
      timestamp: approvedAt,
      detail: row.remarks !== '—' ? row.remarks : undefined,
      sortAt,
    });
    return entries;
  }

  if (row.uiStatus === 'Rejected') {
    const at = fmt(row.signatureSignedAt) ?? submitted ?? '—';
    const sortAt = isoOrNull(row.signatureSignedAt) ?? submittedIso;
    entries.push({
      id: 'rejected',
      action: 'Rejected',
      timestamp: at,
      detail: row.remarks !== '—' ? row.remarks : 'See remarks column',
      sortAt,
    });
    return entries;
  }

  return entries;
}

export type ClearanceActivityLogRow = { action: string; details: unknown; created_at: string };

/** Map activity_logs rows (for this office + clearance) into timeline entries. */
export function activityLogsToTimelineEntries(rows: ClearanceActivityLogRow[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const row of rows) {
    const d = new Date(row.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const ts = format(d, 'MMM d, yyyy · h:mm a');
    const det = row.details && typeof row.details === 'object' && row.details !== null ? row.details as Record<string, unknown> : {};
    const step = det.step;
    let action = row.action;
    let detail: string | undefined;
    if (row.action === 'sign_clearance') {
      action = 'Office approved';
      detail = typeof det.bulk === 'boolean' && det.bulk ? 'Recorded via bulk action' : undefined;
    } else if (row.action === 'reject_clearance') {
      action = 'Office rejected';
      detail = typeof det.bulk === 'boolean' && det.bulk ? 'Recorded via bulk action' : undefined;
    } else if (row.action === 'update_clearance') {
      if (step === 'resubmit_office') {
        action = 'You resubmitted to this office';
      } else if (step === 'submit_office') {
        action = 'You submitted to this office';
      } else {
        action = 'Request updated';
      }
    } else if (row.action === 'create_clearance') {
      action = 'Clearance request created';
    }
    out.push({
      id: `log-${row.created_at}-${row.action}-${out.length}`,
      action,
      timestamp: ts,
      detail,
      sortAt: d.toISOString(),
    });
  }
  return out;
}

export function mergeTimelineEntries(a: TimelineEntry[], b: TimelineEntry[]): TimelineEntry[] {
  return [...a, ...b].sort((x, y) => x.sortAt.localeCompare(y.sortAt));
}
