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
  ClipboardCheck,
  Loader2,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
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

export default function MyClearancePage() {
  const { user } = useAuth();
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
        if (up.ok) {
          const j = await up.json();
          uploaded.push({
            blob_url: j.blob_url,
            file_name: j.file_name,
            content_type: j.content_type ?? null,
          });
        }
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
        throw new Error(typeof data.error === 'string' ? data.error : 'Submission failed');
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#1a3c5e] dark:text-blue-400" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="ec-my-clearance space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <ClipboardCheck className="mx-auto mb-4 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <h2 className="text-lg font-semibold text-[#1a3c5e] dark:text-blue-400">No clearance steps assigned</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Contact your administrator to assign signatories to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ec-my-clearance space-y-6 animate-ec-page-enter">
      <ClearanceConfettiBurst active={celebrate} />

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a3c5e] dark:text-blue-400">My Clearance</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Submit and track each office on your clearance path.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="border-[#1a3c5e]/25">
            <Link to="/dashboard/clearances/calendar">Calendar</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="border-[#1a3c5e]/25">
            <Link to="/dashboard/clearances/report">Report</Link>
          </Button>
          {allCleared && (
            <Button
              type="button"
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          )}
        </div>
      </div>

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
        <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-5 py-4 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-green-900/20 print:border-emerald-300">
          <div className="shrink-0 rounded-full bg-emerald-100 p-2 dark:bg-emerald-800">
            <PartyPopper className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              All clearances approved. You may print your summary for the Registrar.
            </p>
          </div>
        </div>
      )}

      {readonlyCompleted && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-200 print:hidden">
          This clearance is complete. To start another cycle, your administrator must allow multiple active requests in
          Settings.
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Overall progress</p>
            <p className="text-2xl font-bold tabular-nums text-[#1a3c5e] dark:text-blue-400">{progressPercent}%</p>
          </div>
          <MyClearanceFilterTabs filter={filter} onFilterChange={setFilter} stats={stats} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1a3c5e] to-emerald-500 transition-all duration-500 dark:from-blue-600"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {operationalRows.length > 0 && <MyClearanceStatusCards operational={operationalStats} />}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20 print:hidden">
        <div className="mt-0.5 shrink-0 rounded-full bg-blue-100 p-1 dark:bg-blue-900/40">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Complete each step in order where marked. Administrative sign-offs unlock after all operational offices are
          approved.
        </p>
      </div>

      {operationalRows.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-[#1a3c5e] to-blue-500 p-2 shadow-sm dark:from-blue-600 dark:to-blue-400">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1a3c5e] dark:text-blue-400">Operational offices</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">Step 1 — campus units</p>
              </div>
            </div>
            <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] text-gray-500 dark:bg-gray-800">
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'rounded-xl p-2 shadow-sm',
                  allOperationalApproved
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-500 dark:from-indigo-500 dark:to-purple-400'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                )}
              >
                {allOperationalApproved ? (
                  <Users className="h-5 w-5 text-white" />
                ) : (
                  <Lock className="h-5 w-5 text-white/80" />
                )}
              </div>
              <div>
                <h2
                  className={cn(
                    'text-lg font-semibold',
                    allOperationalApproved ? 'text-[#1a3c5e] dark:text-blue-400' : 'text-gray-400'
                  )}
                >
                  Administrative officials
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {allOperationalApproved
                    ? 'Sequential sign-off (one at a time)'
                    : 'Complete all operational offices first'}
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
