import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Search,
  ClipboardList,
  ChevronRight,
  Lock,
  History,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
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
import { Button } from '@/components/ui/button';
import type { UiStepRow, UiStepStatus } from './myClearanceTypes';

export type { UiStepRow, UiStepStatus };

interface Column {
  key: string;
  label: string;
}

interface ClearanceStepsTableProps {
  title?: string;
  rows: UiStepRow[];
  columns: Column[];
  mode: 'parallel' | 'sequential';
  disabled?: boolean;
  disabledMessage?: string;
  onRequestClick: (row: UiStepRow) => void;
  onResubmitClick: (row: UiStepRow) => void;
  /** History / timeline column */
  onHistoryClick?: (row: UiStepRow) => void;
  /** Parallel mode: prompt to submit multiple Request rows in sequence */
  onBatchSubmitIntent?: () => void;
  batchRequestCount?: number;
  /** When set, show a column to leave a visit / reschedule note (student). */
  stepNoteRequestId?: string | null;
  onStepNoteClick?: (row: UiStepRow) => void;
}

function RequestButton({ row, onClick }: { row: UiStepRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#1a3c5e]/25 bg-gradient-to-r from-[#1a3c5e] to-[#2a5f8f] px-2.5 py-2 text-xs font-medium text-white shadow-sm transition-all hover:from-[#15304d] hover:to-[#1a3c5e] hover:shadow-md sm:w-auto sm:gap-2 sm:px-3 sm:text-sm dark:from-blue-600 dark:to-blue-500 dark:hover:from-blue-700 dark:hover:to-blue-600"
    >
      <ClipboardList className="h-4 w-4" />
      <span>Request</span>
      <ChevronRight className="h-4 w-4 opacity-70" />
    </button>
  );
}

function NextRequestButton({ row, onClick }: { row: UiStepRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border-2 border-amber-400/60 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-2 text-xs font-medium text-amber-800 shadow-sm transition-all hover:border-amber-500 hover:shadow-md sm:w-auto sm:gap-2 sm:px-3 sm:text-sm dark:from-amber-900/30 dark:to-orange-900/20 dark:text-amber-200"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
        Next
      </span>
      <span>Request</span>
      <ChevronRight className="h-4 w-4 opacity-70" />
    </button>
  );
}

function QueuedBadge({ position }: { position: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      <Lock className="h-3.5 w-3.5" />
      <span className="text-xs">{position > 0 ? `Queue #${position}` : 'Locked'}</span>
    </span>
  );
}

function StatusCell({
  row,
  mode,
  nextSequentialId,
  queuePositionMap,
  onRequest,
  onResubmit,
}: {
  row: UiStepRow;
  mode: 'parallel' | 'sequential';
  nextSequentialId: string | null;
  queuePositionMap: Map<string, number>;
  onRequest: (r: UiStepRow) => void;
  onResubmit: (r: UiStepRow) => void;
}) {
  if (row.uiStatus === 'Rejected') {
    return (
      <button
        type="button"
        onClick={() => onResubmit(row)}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
      >
        Resubmit
      </button>
    );
  }
  if (row.uiStatus === 'Request') {
    if (mode === 'sequential') {
      if (row.id === nextSequentialId) {
        return <NextRequestButton row={row} onClick={() => onRequest(row)} />;
      }
      const pos = queuePositionMap.get(row.id);
      return <QueuedBadge position={pos ?? 0} />;
    }
    return <RequestButton row={row} onClick={() => onRequest(row)} />;
  }
  if (row.uiStatus === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        Pending review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
      <CheckCircle2 className="h-4 w-4" />
      Approved
    </span>
  );
}

export function ClearanceStepsTable({
  rows,
  columns,
  mode,
  disabled = false,
  disabledMessage = 'Complete the previous section first.',
  onRequestClick,
  onResubmitClick,
  onHistoryClick,
  onBatchSubmitIntent,
  batchRequestCount = 0,
  stepNoteRequestId,
  onStepNoteClick,
}: ClearanceStepsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmRow, setConfirmRow] = useState<UiStepRow | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showBatch = mode === 'parallel' && !disabled && batchRequestCount >= 2 && !!onBatchSubmitIntent;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (mod && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        if (showBatch) {
          e.preventDefault();
          onBatchSubmitIntent?.();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showBatch, onBatchSubmitIntent]);

  const nextSequentialId = useMemo(() => {
    if (mode !== 'sequential') return null;
    const rejected = rows.find((r) => r.uiStatus === 'Rejected');
    if (rejected) return rejected.id;
    const firstReq = rows.find((r) => r.uiStatus === 'Request');
    return firstReq?.id ?? null;
  }, [rows, mode]);

  const queuePositionMap = useMemo(() => {
    const map = new Map<string, number>();
    if (mode !== 'sequential') return map;
    let pos = 0;
    for (const r of rows) {
      if (r.uiStatus === 'Request' || r.uiStatus === 'Rejected') {
        pos++;
        if (pos > 1) map.set(r.id, pos);
      }
    }
    return map;
  }, [rows, mode]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => {
      const dept = (r.department ?? '').toLowerCase();
      return (
        r.office.toLowerCase().includes(q) ||
        r.officer.toLowerCase().includes(q) ||
        dept.includes(q) ||
        r.uiStatus.toLowerCase().includes(q)
      );
    });
  }, [rows, searchQuery]);

  const onRequest = useCallback(
    (r: UiStepRow) => {
      setConfirmRow(r);
    },
    []
  );

  const handleConfirm = () => {
    if (confirmRow) {
      onRequestClick(confirmRow);
      setConfirmRow(null);
    }
  };

  /** Fixed column % so long officer titles use width instead of ultra-narrow wrapping. */
  const colPct = useMemo(() => {
    const hasH = !!onHistoryClick;
    const hasN = !!(stepNoteRequestId && onStepNoteClick);
    const office = 9;
    const officer = 33;
    const status = 7;
    const date = 6;
    const schedule = 8;
    const remarks = 10;
    const baseSum = office + officer + status + date + schedule + remarks;
    const optional = (hasH ? 6 : 0) + (hasN ? 6 : 0);
    const action = Math.max(11, 100 - baseSum - optional);
    return { office, officer, status, date, schedule, remarks, history: hasH ? 6 : 0, note: hasN ? 6 : 0, action };
  }, [onHistoryClick, stepNoteRequestId, onStepNoteClick]);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-sm border border-[#1a3c5e]/18 bg-[hsl(42_40%_99.5%)] shadow-[0_1px_0_hsl(42_20%_88%)] dark:border-border dark:bg-card/90',
        disabled && 'select-none'
      )}
    >
      {disabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm dark:bg-gray-900/70">
          <p className="max-w-sm text-center text-sm text-gray-600 dark:text-gray-300">{disabledMessage}</p>
        </div>
      )}

      <div className="space-y-2 border-b border-[#1a3c5e]/10 bg-gradient-to-r from-[hsl(42_28%_97%)] to-[hsl(210_20%_96%)] px-4 py-3 dark:border-border dark:from-muted/40 dark:to-muted/20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Search offices… (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-gray-200 bg-white pl-9 dark:border-gray-700 dark:bg-gray-900"
              aria-label="Search clearance steps"
            />
          </div>
          {showBatch && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-[#1a3c5e]/30 text-[#1a3c5e] hover:bg-[#1a3c5e]/5 dark:border-blue-500/40 dark:text-blue-300"
              onClick={() => onBatchSubmitIntent?.()}
            >
              <Layers className="mr-2 h-4 w-4" />
              Submit all ({batchRequestCount})
              <span className="ml-2 hidden text-[10px] font-normal text-muted-foreground sm:inline">
                Ctrl+Shift+S
              </span>
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[min(100%,68rem)] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col style={{ width: `${colPct.office}%` }} />
            <col style={{ width: `${colPct.officer}%` }} />
            <col style={{ width: `${colPct.status}%` }} />
            <col style={{ width: `${colPct.date}%` }} />
            <col style={{ width: `${colPct.schedule}%` }} />
            <col style={{ width: `${colPct.remarks}%` }} />
            {onHistoryClick && <col style={{ width: `${colPct.history}%` }} />}
            {stepNoteRequestId && onStepNoteClick && <col style={{ width: `${colPct.note}%` }} />}
            <col style={{ width: `${colPct.action}%` }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[#1a3c5e]/15 bg-[hsl(210_25%_94%)] dark:border-border dark:bg-muted/50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="align-top px-3 py-3 font-clearance text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#1a3c5e]/85 dark:text-foreground/90 sm:px-4"
                >
                  {c.label}
                </th>
              ))}
              {onHistoryClick && (
                <th className="align-top px-3 py-3 font-clearance text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#1a3c5e]/85 dark:text-foreground/90 sm:px-4">
                  History
                </th>
              )}
              {stepNoteRequestId && onStepNoteClick && (
                <th className="align-top px-3 py-3 font-clearance text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#1a3c5e]/85 dark:text-foreground/90 sm:px-4">
                  Note
                </th>
              )}
              <th className="align-top px-3 py-3 font-clearance text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#1a3c5e]/85 dark:text-foreground/90 sm:px-4">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-[#1a3c5e]/10 transition-colors dark:border-border/60',
                  row.uiStatus === 'Approved' && 'border-l-[3px] border-l-emerald-600 bg-emerald-50/35 dark:border-l-emerald-500 dark:bg-emerald-950/15',
                  row.uiStatus === 'Pending' && 'border-l-[3px] border-l-amber-500 bg-amber-50/30 dark:border-l-amber-500 dark:bg-amber-950/10',
                  row.uiStatus === 'Rejected' && 'border-l-[3px] border-l-red-500 bg-red-50/25 dark:border-l-red-500 dark:bg-red-950/15',
                  row.uiStatus === 'Request' &&
                    'border-l-[3px] border-l-[#1a3c5e] bg-blue-50/25 dark:border-l-blue-500 dark:bg-blue-950/10',
                  'hover:bg-[hsl(42_35%_98%)] dark:hover:bg-muted/30'
                )}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <td className="align-top px-3 py-3 font-medium text-[#152a45] dark:text-foreground sm:px-4">
                  {row.office}
                </td>
                <td className="align-top px-3 py-3 text-sm leading-snug text-muted-foreground break-words sm:px-4">
                  {row.officer}
                </td>
                <td className="align-top px-3 py-3 sm:px-4">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      row.uiStatus === 'Approved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                      row.uiStatus === 'Pending' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
                      row.uiStatus === 'Rejected' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                      row.uiStatus === 'Request' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    )}
                  >
                    {row.uiStatus}
                  </span>
                </td>
                <td className="whitespace-nowrap align-top px-3 py-3 text-muted-foreground sm:px-4">{row.date}</td>
                <td className="align-top px-3 py-3 text-sm text-muted-foreground sm:px-4">{row.schedule}</td>
                <td
                  className="align-top px-3 py-3 text-sm text-muted-foreground line-clamp-3 sm:px-4"
                  title={row.remarks}
                >
                  {row.remarks}
                </td>
                {onHistoryClick && (
                  <td className="align-top px-2 py-3 sm:px-3">
                    <button
                      type="button"
                      onClick={() => onHistoryClick(row)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      aria-label={`History for ${row.office}`}
                    >
                      <History className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                )}
                {stepNoteRequestId && onStepNoteClick && (
                  <td className="align-top px-2 py-3 sm:px-3">
                    <button
                      type="button"
                      onClick={() => onStepNoteClick(row)}
                      disabled={disabled}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      aria-label={`Note for ${row.office}`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                )}
                <td className="align-top px-2 py-3 sm:px-3">
                  <div className="flex min-w-0 flex-col items-stretch gap-1">
                    <StatusCell
                      row={row}
                      mode={mode}
                      nextSequentialId={nextSequentialId}
                      queuePositionMap={queuePositionMap}
                      onRequest={onRequest}
                      onResubmit={onResubmitClick}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRows.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">No rows match your search.</div>
      )}

      <AlertDialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm request</AlertDialogTitle>
            <AlertDialogDescription>
              Submit a clearance request to{' '}
              <strong>
                {confirmRow?.officer && confirmRow.officer !== '—'
                  ? confirmRow.officer
                  : confirmRow?.office && confirmRow.office !== 'N/A'
                    ? confirmRow.office
                    : 'the assigned officer'}
              </strong>
              ? You will upload required items in the next step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
