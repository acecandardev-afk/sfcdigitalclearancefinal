import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Users,
  Lock,
  CheckCircle2,
  ArrowDown,
  PartyPopper,
  Printer,
  Info,
  Loader2,
  CalendarClock,
  AlertTriangle,
  ScrollText,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { clearancePeriodMeta } from '@/lib/clearancePeriod';
import { useClearancePeriodSettings } from '@/hooks/useClearancePeriodSettings';
import { useStudentMyClearanceData } from '@/hooks/useStudentMyClearanceData';
import { OfficeRequestModal } from './OfficeRequestModal';
import { ClearanceStepsTable } from './ClearanceStepsTable';
import { ClearanceTimelineModal } from './ClearanceTimelineModal';
import { ClearanceConfettiBurst } from './ClearanceConfettiBurst';
import { MyClearanceFilterTabs, type MyClearanceFilter } from './MyClearanceFilterTabs';
import { MyClearanceStatusCards } from './MyClearanceStatusCards';
import {
  activityLogsToTimelineEntries,
  buildTimelineEntries,
  mergeTimelineEntries,
  type TimelineEntry,
} from './myClearanceTimeline';
import { OfficeStepNoteDialog } from './OfficeStepNoteDialog';
import { logActivity } from '@/hooks/useActivityLog';
import { DEFAULT_REQUIREMENTS, type UiStepRow, type UiStepStatus } from './myClearanceTypes';
import { toast } from 'sonner';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { formatApiErrorBody } from '@/lib/userMessages';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const OFFICE_COLUMNS = [
  { key: 'office', label: 'Office / Unit' },
  { key: 'officer', label: 'Assigned officer' },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'remarks', label: 'Remarks' },
];

const ADMIN_COLUMNS = [
  { key: 'office', label: 'Official' },
  { key: 'officer', label: 'Position' },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'remarks', label: 'Remarks' },
];

function formatClearanceRef(id: string | null) {
  if (!id) return '—';
  return id.length > 18 ? `${id.slice(0, 14)}…` : id;
}

export default function MyClearancePage() {
  const { user } = useAuth();
  const { data: session } = useSession();
  const {
    loading,
    rows,
    allowMultiple,
    draftRequestId,
    completedRequestId,
    setDraftRequestId,
    reload,
    readonlyCompleted,
  } = useStudentMyClearanceData();
  const { period: clearancePeriod, loading: clearancePeriodLoading } = useClearancePeriodSettings();

  const [modalRow, setModalRow] = useState<UiStepRow | null>(null);
  const [filter, setFilter] = useState<MyClearanceFilter>('all');
  const [timelineRow, setTimelineRow] = useState<UiStepRow | null>(null);
  const [batchSignatoryIds, setBatchSignatoryIds] = useState<string[]>([]);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const prevAllCleared = useRef(false);
  const [mergedTimeline, setMergedTimeline] = useState<TimelineEntry[]>([]);
  const [noteRow, setNoteRow] = useState<UiStepRow | null>(null);

  const activeRequestId = draftRequestId ?? completedRequestId;
  const studentDisplayName =
    session?.user?.name?.trim() ||
    (session?.user as { email?: string } | undefined)?.email?.trim() ||
    user?.email ||
    'Student';

  const TODAY = new Date();
  const periodMeta = clearancePeriodMeta(clearancePeriod, TODAY);

  useEffect(() => {
    const allCleared = rows.length > 0 && rows.every((r) => r.uiStatus === 'Approved');
    if (allCleared && !prevAllCleared.current) {
      setCelebrate(true);
      const t = window.setTimeout(() => setCelebrate(false), 2800);
      prevAllCleared.current = true;
      return () => window.clearTimeout(t);
    }
    if (!allCleared) prevAllCleared.current = false;
  }, [rows]);

  useEffect(() => {
    if (modalRow || loading) return;
    if (!batchSignatoryIds.length) return;
    const nextId = batchSignatoryIds[0];
    const row = rows.find((r) => r.signatoryId === nextId && r.uiStatus === 'Request');
    if (row) setModalRow(row);
  }, [modalRow, loading, batchSignatoryIds, rows]);

  useEffect(() => {
    if (!timelineRow) {
      setMergedTimeline([]);
      return;
    }
    const base = buildTimelineEntries(timelineRow);
    const rid = draftRequestId ?? completedRequestId;
    if (!rid || !user?.id) {
      setMergedTimeline(base);
      return;
    }
    let cancelled = false;
    void (async () => {
      const qs = new URLSearchParams({
        clearanceRequestId: rid,
        signatoryId: timelineRow.signatoryId,
      });
      const res = await fetch(`/api/activity/timeline?${qs}`, { credentials: 'include' });
      if (cancelled) return;
      if (!res.ok) {
        setMergedTimeline(base);
        return;
      }
      const json = await res.json();
      const logs = activityLogsToTimelineEntries(json.logs ?? []);
      setMergedTimeline(mergeTimelineEntries(base, logs));
    })();
    return () => {
      cancelled = true;
    };
  }, [timelineRow, draftRequestId, completedRequestId, user?.id]);

  const operationalRows = useMemo(
    () => rows.filter((r) => r.signatoryGroup === 'standard'),
    [rows]
  );
  const adminRows = useMemo(() => rows.filter((r) => r.signatoryGroup === 'authority'), [rows]);

  const allOperationalApproved =
    operationalRows.length > 0 && operationalRows.every((r) => r.uiStatus === 'Approved');
  const allCleared = rows.length > 0 && rows.every((r) => r.uiStatus === 'Approved');

  const operationalStats = useMemo(() => {
    const approved = operationalRows.filter((r) => r.uiStatus === 'Approved').length;
    const total = operationalRows.length;
    const pending = operationalRows.filter((r) => r.uiStatus === 'Pending').length;
    const remaining = operationalRows.filter((r) => r.uiStatus === 'Request').length;
    return {
      approved,
      total,
      pending,
      remaining,
      percent: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }, [operationalRows]);

  const stats = useMemo(() => {
    return {
      all: rows.length,
      request: rows.filter((r) => r.uiStatus === 'Request').length,
      pending: rows.filter((r) => r.uiStatus === 'Pending').length,
      approved: rows.filter((r) => r.uiStatus === 'Approved').length,
    };
  }, [rows]);

  const progressPercent = rows.length ? Math.round((stats.approved / rows.length) * 100) : 0;

  const filterRows = useCallback(
    (list: UiStepRow[]) => {
      if (filter === 'all') return list;
      const map: Record<MyClearanceFilter, UiStepStatus | ''> = {
        all: '',
        request: 'Request',
        pending: 'Pending',
        approved: 'Approved',
      };
      const want = map[filter];
      return list.filter((r) => r.uiStatus === want);
    },
    [filter]
  );

  const operationalRequestCount = operationalRows.filter((r) => r.uiStatus === 'Request').length;

  const confirmBatchSubmit = () => {
    const ids = operationalRows.filter((r) => r.uiStatus === 'Request').map((r) => r.signatoryId);
    if (ids.length < 2) {
      toast.message('At least two offices must still be in Remaining status.');
      setBatchConfirmOpen(false);
      return;
    }
    setBatchSignatoryIds(ids);
    const first = rows.find((r) => r.signatoryId === ids[0]);
    if (first) setModalRow(first);
    setBatchConfirmOpen(false);
  };

  const abandonBatch = () => {
    setModalRow(null);
    setBatchSignatoryIds([]);
  };

  const submitModal = async ({ note, files }: { note: string; files: File[] }) => {
    if (!user?.id || !modalRow) return;
    const inBatch = batchSignatoryIds.includes(modalRow.signatoryId);
    try {
      const uploaded: { blob_url: string; file_name: string; content_type: string | null }[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'clearance-files');
        const up = await fetch('/api/blob/upload', { method: 'POST', body: fd, credentials: 'include' });
        const raw = await up.json().catch(() => ({}));
        if (!up.ok) {
          throw new Error(formatApiErrorBody(raw) || 'File upload failed');
        }
        const j = raw as { blob_url?: string; file_name?: string; content_type?: string | null };
        if (!j.blob_url || typeof j.blob_url !== 'string') {
          throw new Error('Upload did not return a file URL. Check blob storage configuration.');
        }
        uploaded.push({
          blob_url: j.blob_url,
          file_name: j.file_name ?? file.name,
          content_type: j.content_type ?? null,
        });
      }

      const hadRequest = !!draftRequestId;
      const res = await fetch('/api/student/clearance-office-submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearanceRequestId: draftRequestId,
          readonlyCompleted,
          signatoryId: modalRow.signatoryId,
          sequenceOrder: modalRow.sequenceOrder,
          signatoryGroup: modalRow.signatoryGroup,
          authoritySequenceOrder: modalRow.authoritySequenceOrder,
          signatureId: modalRow.signatureId,
          note,
          files: uploaded,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiErrorBody(data) || 'Submission failed');
      }

      if (!hadRequest && data.requestId) {
        setDraftRequestId(data.requestId);
        void logActivity({
          action: 'create_clearance',
          details: { clearance_request_id: data.requestId },
        });
      }
      void logActivity({
        action: 'update_clearance',
        details: {
          clearance_request_id: data.requestId,
          signatory_id: modalRow.signatoryId,
          step: modalRow.signatureId ? 'resubmit_office' : 'submit_office',
        },
      });

      toast.success(modalRow.signatureId ? 'Resubmitted for review' : 'Request submitted');
      const submittedSignatoryId = modalRow.signatoryId;
      setModalRow(null);
      if (inBatch) {
        setBatchSignatoryIds((ids) => ids.filter((id) => id !== submittedSignatoryId));
      }
      await reload();
    } catch (e) {
      console.error(e);
      toast.error(safeActionErrorMessage(e, 'Submission failed'));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#1a3c5e] dark:text-blue-400" />
        <p className="font-clearance text-sm text-muted-foreground">Preparing your clearance form…</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="ec-my-clearance w-full">
        <div className="ec-clearance-paper ec-clearance-grid overflow-hidden text-center">
          <div className="border-b border-[#1a3c5e]/10 bg-[hsl(42_30%_97%)] px-8 py-10 dark:border-border dark:bg-card/80">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#1a3c5e]/20 bg-white shadow-inner dark:border-blue-500/30 dark:bg-background">
              <ScrollText className="h-8 w-8 text-[#1a3c5e]/70 dark:text-blue-400/90" />
            </div>
            <h2 className="font-clearance mt-5 text-2xl font-semibold tracking-tight text-[#152a45] dark:text-foreground">
              No clearance program assigned
            </h2>
            <p className="mt-3 max-w-md mx-auto text-sm leading-relaxed text-muted-foreground">
              Your account is not yet linked to an official clearance checklist. Please contact the Registrar or your
              program office to assign signatories.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ec-my-clearance w-full space-y-6 animate-ec-page-enter">
      <ClearanceConfettiBurst active={celebrate} />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1a3c5e]/10 pb-5 print:hidden dark:border-border">
        <div>
          <p className="font-clearance text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Digital clearance
          </p>
          <h1 className="mt-1 font-clearance text-2xl font-semibold tracking-tight text-[#152a45] dark:text-foreground">
            My clearance
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Your official exit clearance form below. Use Calendar or Report for planning; print when every office is
            approved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="border-[#1a3c5e]/25 bg-background/80 backdrop-blur-sm">
            <Link to="/dashboard/clearances/calendar">Calendar</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="border-[#1a3c5e]/25 bg-background/80 backdrop-blur-sm">
            <Link to="/dashboard/clearances/report">Report</Link>
          </Button>
          {allCleared && (
            <Button
              type="button"
              onClick={() => window.print()}
              className="bg-emerald-700 shadow-sm hover:bg-emerald-800"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print summary
            </Button>
          )}
        </div>
      </div>

      <div className="w-full">
        <div className="ec-clearance-paper ec-clearance-grid overflow-hidden print:shadow-none">
          <header className="relative border-b-2 border-[#1a3c5e]/12 bg-gradient-to-b from-[hsl(42_35%_99%)] to-[hsl(42_28%_96%)] px-6 py-8 text-center sm:px-10 dark:border-border dark:from-card dark:to-card/95 print:border-b print:bg-white">
            <div className="pointer-events-none absolute right-4 top-4 opacity-[0.06] dark:opacity-[0.08] print:hidden">
              <ScrollText className="h-24 w-24 text-[#1a3c5e] dark:text-blue-500/40" aria-hidden />
            </div>
            <p className="font-clearance text-[0.65rem] font-semibold uppercase tracking-[0.38em] text-[#1a3c5e]/75 dark:text-blue-300/85">
              Office of the Registrar
            </p>
            <h2 className="font-clearance mt-3 text-[1.7rem] font-semibold leading-tight tracking-tight text-[#142a44] dark:text-foreground sm:text-[2rem] print:text-2xl">
              Student Exit Clearance
            </h2>
            <p className="mt-2 font-clearance text-sm italic text-muted-foreground">
              Official checklist — sign-offs are recorded in order of required offices
            </p>
            <dl className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 border-y border-[#1a3c5e]/10 py-4 text-xs sm:grid-cols-3 dark:border-border print:border-y print:border-foreground/20">
              <div className="sm:text-center">
                <dt className="font-clearance font-medium uppercase tracking-[0.2em] text-muted-foreground">Student</dt>
                <dd className="mt-1.5 text-sm font-medium text-foreground">{studentDisplayName}</dd>
              </div>
              <div className="sm:text-center">
                <dt className="font-clearance font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Reference no.
                </dt>
                <dd className="mt-1.5 font-mono text-sm text-foreground">{formatClearanceRef(activeRequestId)}</dd>
              </div>
              <div className="sm:text-center">
                <dt className="font-clearance font-medium uppercase tracking-[0.2em] text-muted-foreground">Date</dt>
                <dd className="mt-1.5 tabular-nums text-sm text-foreground">
                  {TODAY.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </dd>
              </div>
            </dl>
          </header>

          <div className="space-y-6 px-4 py-6 sm:px-7 sm:py-7 md:px-10 md:py-9">
      <div
        className={cn(
          'flex items-center gap-4 rounded-xl border px-5 py-4 print:hidden',
          clearancePeriodLoading && 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50',
          !clearancePeriodLoading &&
            !periodMeta.configured &&
            'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50',
          !clearancePeriodLoading &&
            periodMeta.configured &&
            periodMeta.isActive &&
            periodMeta.isExpiring &&
            'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/15',
          !clearancePeriodLoading &&
            periodMeta.configured &&
            periodMeta.isActive &&
            !periodMeta.isExpiring &&
            'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
          !clearancePeriodLoading && periodMeta.configured && periodMeta.isUpcoming && 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/15',
          !clearancePeriodLoading &&
            periodMeta.configured &&
            periodMeta.isPast &&
            'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
        )}
      >
        <div
          className={cn(
            'shrink-0 rounded-full p-2',
            !clearancePeriodLoading &&
              periodMeta.configured &&
              periodMeta.isActive &&
              periodMeta.isExpiring &&
              'bg-red-100 dark:bg-red-900/40',
            !clearancePeriodLoading &&
              periodMeta.configured &&
              periodMeta.isActive &&
              !periodMeta.isExpiring &&
              'bg-emerald-100 dark:bg-emerald-800',
            !clearancePeriodLoading && periodMeta.configured && periodMeta.isUpcoming && 'bg-amber-100 dark:bg-amber-900/40',
            (clearancePeriodLoading ||
              !periodMeta.configured ||
              (periodMeta.configured && periodMeta.isPast)) &&
              'bg-gray-100 dark:bg-gray-800'
          )}
        >
          {!clearancePeriodLoading && periodMeta.configured && periodMeta.isActive && periodMeta.isExpiring ? (
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          ) : (
            <CalendarClock
              className={cn(
                'h-5 w-5',
                !clearancePeriodLoading &&
                  periodMeta.configured &&
                  periodMeta.isActive &&
                  'text-emerald-600 dark:text-emerald-400',
                !clearancePeriodLoading && periodMeta.configured && periodMeta.isUpcoming && 'text-amber-600 dark:text-amber-400',
                (clearancePeriodLoading ||
                  !periodMeta.configured ||
                  (periodMeta.configured && periodMeta.isPast)) &&
                  'text-gray-400'
              )}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm',
              clearancePeriodLoading && 'text-gray-600 dark:text-gray-400',
              !clearancePeriodLoading &&
                !periodMeta.configured &&
                'text-gray-600 dark:text-gray-400',
              !clearancePeriodLoading &&
                periodMeta.configured &&
                periodMeta.isActive &&
                periodMeta.isExpiring &&
                'text-red-800 dark:text-red-300',
              !clearancePeriodLoading &&
                periodMeta.configured &&
                periodMeta.isActive &&
                !periodMeta.isExpiring &&
                'text-emerald-800 dark:text-emerald-300',
              !clearancePeriodLoading && periodMeta.configured && periodMeta.isUpcoming && 'text-amber-800 dark:text-amber-300',
              !clearancePeriodLoading && periodMeta.configured && periodMeta.isPast && 'text-gray-600 dark:text-gray-400'
            )}
          >
            {clearancePeriodLoading
              ? 'Loading official clearance dates…'
              : !periodMeta.configured
                ? 'No official clearance window is configured yet. Your administrator sets this in System Settings.'
                : periodMeta.isActive && periodMeta.isExpiring
                  ? `Clearance period ending soon — ${periodMeta.daysUntilEnd} day(s) left`
                  : periodMeta.isActive
                    ? `Clearance period is active · ${periodMeta.daysUntilEnd} day(s) remaining`
                    : periodMeta.isUpcoming
                      ? `Clearance opens in ${periodMeta.daysUntilStart} day(s)`
                      : 'The configured clearance period has ended.'}
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {clearancePeriod && !clearancePeriodLoading
              ? `Configured window: ${clearancePeriod.start.toLocaleDateString()} – ${clearancePeriod.end.toLocaleDateString()}`
              : !clearancePeriodLoading
                ? 'Dates are defined by your institution in System Settings.'
                : ''}
          </p>
        </div>
      </div>

      {allCleared && (
        <div className="flex items-center gap-4 rounded-sm border-2 border-emerald-600/25 bg-gradient-to-r from-emerald-50/95 to-[hsl(42_40%_98%)] px-5 py-4 shadow-sm dark:border-emerald-700/40 dark:from-emerald-950/40 dark:to-card print:border-emerald-800">
          <div className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 p-2.5 dark:border-emerald-800 dark:bg-emerald-900/50">
            <PartyPopper className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-clearance text-sm font-medium text-emerald-900 dark:text-emerald-200">
              Clearance complete
            </p>
            <p className="mt-0.5 text-sm text-emerald-800/90 dark:text-emerald-300/95">
              All required offices have approved your request. Print this summary for the Registrar and your records.
            </p>
          </div>
        </div>
      )}

      {readonlyCompleted && (
        <div className="rounded-sm border border-blue-200/80 bg-blue-50/90 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100 print:hidden">
          <span className="font-medium">Cycle closed.</span> To begin another clearance, your administrator must allow
          multiple active requests in System Settings.
        </div>
      )}

      <div className="space-y-4 rounded-sm border border-[#1a3c5e]/15 bg-[hsl(42_40%_99%)] p-5 shadow-sm dark:border-border dark:bg-card/80 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="shrink-0">
            <p className="font-clearance text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Overall progress
            </p>
            <p className="mt-1 font-clearance text-3xl font-semibold tabular-nums tracking-tight text-[#152a45] dark:text-foreground">
              {progressPercent}%
            </p>
          </div>
          <div className="min-w-0 flex-1 lg:flex lg:justify-end">
            <MyClearanceFilterTabs filter={filter} onFilterChange={setFilter} stats={stats} />
          </div>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full border border-[#1a3c5e]/10 bg-[hsl(42_25%_92%)] dark:border-border dark:bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1a3c5e] via-[#1e4970] to-emerald-600 transition-all duration-500 dark:from-blue-700 dark:via-blue-600 dark:to-emerald-600"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {operationalRows.length > 0 && <MyClearanceStatusCards operational={operationalStats} />}
      </div>

      <div className="flex items-start gap-3 rounded-sm border border-[#1a3c5e]/12 bg-[hsl(210_35%_97%)] px-5 py-4 dark:border-blue-900/40 dark:bg-blue-950/25 print:hidden">
        <div className="mt-0.5 shrink-0 rounded-full border border-blue-200/80 bg-white p-1.5 dark:border-blue-800 dark:bg-blue-900/50">
          <Info className="h-4 w-4 text-[#1a3c5e] dark:text-blue-400" />
        </div>
        <p className="text-sm leading-relaxed text-foreground/85">
          <span className="font-medium text-foreground">Instructions.</span> Complete operational offices as listed.
          Administrative signatures become available only after every operational step is approved.
        </p>
      </div>

      {operationalRows.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#1a3c5e]/10 pb-3 dark:border-border">
            <div className="flex items-center gap-3">
              <div className="rounded-sm border border-[#1a3c5e]/20 bg-gradient-to-br from-[#1a3c5e] to-[#234a72] p-2.5 shadow-sm dark:from-blue-700 dark:to-blue-600">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-clearance text-lg font-semibold tracking-tight text-[#152a45] dark:text-foreground">
                  Part I — Operational offices
                </h2>
                <p className="text-xs text-muted-foreground">Campus units (may be completed in parallel where shown)</p>
              </div>
            </div>
            <span className="rounded-sm border border-[#1a3c5e]/15 bg-[hsl(42_30%_97%)] px-2.5 py-1 font-mono text-[10px] tabular-nums text-muted-foreground dark:border-border dark:bg-muted/50">
              {operationalRows.filter((r) => r.uiStatus === 'Approved').length}/{operationalRows.length} cleared
            </span>
          </div>
          <ClearanceStepsTable
            rows={filterRows(operationalRows)}
            columns={OFFICE_COLUMNS}
            mode="parallel"
            disabled={readonlyCompleted}
            disabledMessage="This clearance cycle is closed."
            onRequestClick={(r) => !readonlyCompleted && setModalRow(r)}
            onResubmitClick={(r) => !readonlyCompleted && setModalRow(r)}
            onHistoryClick={(r) => setTimelineRow(r)}
            onBatchSubmitIntent={() => setBatchConfirmOpen(true)}
            batchRequestCount={operationalRequestCount}
            stepNoteRequestId={activeRequestId}
            onStepNoteClick={(r) => setNoteRow(r)}
          />
        </section>
      )}

      <div className="flex items-center justify-center gap-3 py-1 print:hidden">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1.5',
            allOperationalApproved
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
              : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
          )}
        >
          {allOperationalApproved ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Lock className="h-3.5 w-3.5 text-gray-400" />
          )}
          <ArrowDown className={cn('h-3.5 w-3.5', allOperationalApproved ? 'text-emerald-500' : 'text-gray-400')} />
          <span className="text-[10px] text-gray-600 dark:text-gray-400">
            {allOperationalApproved ? 'Step 2 unlocked' : `${operationalStats.approved}/${operationalStats.total} operational`}
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />
      </div>

      {adminRows.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#1a3c5e]/10 pb-3 dark:border-border">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'rounded-sm border p-2.5 shadow-sm',
                  allOperationalApproved
                    ? 'border-indigo-300/50 bg-gradient-to-br from-indigo-600 to-violet-600 dark:border-indigo-500/30 dark:from-indigo-600 dark:to-violet-600'
                    : 'border-gray-300/60 bg-gradient-to-br from-gray-400 to-gray-500 dark:border-gray-600'
                )}
              >
                {allOperationalApproved ? (
                  <Users className="h-5 w-5 text-white" />
                ) : (
                  <Lock className="h-5 w-5 text-white/85" />
                )}
              </div>
              <div>
                <h2
                  className={cn(
                    'font-clearance text-lg font-semibold tracking-tight',
                    allOperationalApproved ? 'text-[#152a45] dark:text-foreground' : 'text-muted-foreground'
                  )}
                >
                  Part II — Administrative officials
                </h2>
                <p className="text-xs text-muted-foreground">
                  {allOperationalApproved
                    ? 'Sequential sign-off required (one office at a time)'
                    : 'Locked until all Part I offices are approved'}
                </p>
              </div>
            </div>
          </div>
          {!allOperationalApproved && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/15 print:hidden">
              <Lock className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Locked until every operational office is approved ({operationalStats.approved}/{operationalStats.total}).
              </p>
            </div>
          )}
          <ClearanceStepsTable
            rows={filterRows(adminRows)}
            columns={ADMIN_COLUMNS}
            mode="sequential"
            disabled={!allOperationalApproved || readonlyCompleted}
            disabledMessage="Complete all operational offices first."
            onRequestClick={(r) => !readonlyCompleted && setModalRow(r)}
            onResubmitClick={(r) => !readonlyCompleted && setModalRow(r)}
            onHistoryClick={(r) => setTimelineRow(r)}
            stepNoteRequestId={activeRequestId}
            onStepNoteClick={(r) => setNoteRow(r)}
          />
        </section>
      )}

          </div>
        </div>
      </div>

      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit all operational requests?</AlertDialogTitle>
            <AlertDialogDescription>
              You will complete the upload checklist for each office one after another ({operationalRequestCount}{' '}
              remaining). You can cancel anytime; progress already submitted is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBatchSubmit}>Start</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {modalRow && (
        <OfficeRequestModal
          key={modalRow.signatoryId}
          officeName={modalRow.office}
          requirements={modalRow.requirements?.length ? modalRow.requirements : DEFAULT_REQUIREMENTS}
          onClose={abandonBatch}
          onSubmit={submitModal}
        />
      )}

      <ClearanceTimelineModal
        open={!!timelineRow}
        onOpenChange={(o) => !o && setTimelineRow(null)}
        officeName={timelineRow?.office ?? ''}
        entries={mergedTimeline}
      />

      <OfficeStepNoteDialog
        open={!!noteRow}
        onOpenChange={(o) => !o && setNoteRow(null)}
        clearanceRequestId={activeRequestId}
        signatoryId={noteRow?.signatoryId ?? ''}
        officeName={noteRow?.office ?? ''}
        disabled={readonlyCompleted}
      />
    </div>
  );
}
