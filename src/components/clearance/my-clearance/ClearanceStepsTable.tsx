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
      className="inline-flex items-center gap-2 rounded-xl border border-[#1a3c5e]/25 bg-gradient-to-r from-[#1a3c5e] to-[#2a5f8f] px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-[#15304d] hover:to-[#1a3c5e] hover:shadow-md dark:from-blue-600 dark:to-blue-500 dark:hover:from-blue-700 dark:hover:to-blue-600"
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
      className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm transition-all hover:border-amber-500 hover:shadow-md dark:from-amber-900/30 dark:to-orange-900/20 dark:text-amber-200"
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
    return rows.filter(
      (r) =>
        r.office.toLowerCase().includes(q) ||
        r.officer.toLowerCase().includes(q) ||
        r.uiStatus.toLowerCase().includes(q)
    );
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

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900',
        disabled && 'select-none'
      )}
    >
      {disabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm dark:bg-gray-900/70">
          <p className="max-w-sm text-center text-sm text-gray-600 dark:text-gray-300">{disabledMessage}</p>
        </div>
      )}

      <div className="space-y-2 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-3 dark:border-gray-800 dark:from-gray-800/80 dark:to-gray-800/50">
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/50">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                  {c.label}
                </th>
              ))}
              {onHistoryClick && (
                <th className="w-[88px] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">History</th>
              )}
              {stepNoteRequestId && onStepNoteClick && (
                <th className="w-[88px] px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Note</th>
              )}
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-gray-100 transition-colors dark:border-gray-800',
                  row.uiStatus === 'Approved' && 'border-l-4 border-l-emerald-500',
                  row.uiStatus === 'Pending' && 'border-l-4 border-l-amber-400',
                  row.uiStatus === 'Rejected' && 'border-l-4 border-l-red-500',
                  row.uiStatus === 'Request' && 'border-l-4 border-l-[#1a3c5e] dark:border-l-blue-500',
                  'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'
                )}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.office}</td>
                <td className="max-w-[220px] px-4 py-3 text-gray-600 dark:text-gray-400">{row.officer}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      row.uiStatus === 'Approved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                      row.uiStatus === 'Pending' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
                      row.uiStatus === 'Rejected' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                      row.uiStatus === 'Request' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    )}
                  >
                    {row.uiStatus}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">{row.date}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.schedule}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-gray-500 dark:text-gray-500" title={row.remarks}>
                  {row.remarks}
                </td>
                {onHistoryClick && (
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  <StatusCell
                    row={row}
                    mode={mode}
                    nextSequentialId={nextSequentialId}
                    queuePositionMap={queuePositionMap}
                    onRequest={onRequest}
                    onResubmit={onResubmitClick}
                  />
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
              Submit a clearance request to <strong>{confirmRow?.office}</strong>? You will upload required items in the
              next step.
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
