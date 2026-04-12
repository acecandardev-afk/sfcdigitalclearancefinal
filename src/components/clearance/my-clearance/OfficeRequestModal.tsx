import { useMemo, useRef, useState } from 'react';
import {
  X,
  Check,
  Upload,
  FileText,
  ImageIcon,
  Trash2,
  CircleCheck,
  CircleDashed,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OfficeRequirement {
  id: number;
  label: string;
  type: 'checkbox' | 'document';
}

interface OfficeRequestModalProps {
  officeName: string;
  requirements: OfficeRequirement[];
  onClose: () => void;
  onSubmit: (payload: { note: string; files: File[] }) => Promise<void>;
}

export function OfficeRequestModal({
  officeName,
  requirements,
  onClose,
  onSubmit,
}: OfficeRequestModalProps) {
  const reqs = Array.isArray(requirements) ? requirements : [];
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<number, File[]>>({});
  const [note, setNote] = useState('');
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const toggleCheck = (id: number) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFileUpload = (reqId: number, files: FileList | null) => {
    if (!files) return;
    setUploadedFiles((prev) => ({
      ...prev,
      [reqId]: [...(prev[reqId] || []), ...Array.from(files)],
    }));
  };

  const removeFile = (reqId: number, fileIndex: number) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [reqId]: (prev[reqId] || []).filter((_, i) => i !== fileIndex),
    }));
  };

  const handleDrop = (reqId: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    handleFileUpload(reqId, e.dataTransfer.files);
  };

  const completionStatus = useMemo(() => {
    const steps: { label: string; done: boolean }[] = [];
    reqs.forEach((r) => {
      if (r.type === 'checkbox') {
        steps.push({ label: r.label, done: !!checkedItems[r.id] });
      } else {
        steps.push({ label: r.label, done: (uploadedFiles[r.id] || []).length > 0 });
      }
    });
    steps.push({ label: 'Remarks / N/A field', done: note.trim().length > 0 });
    const completed = steps.filter((s) => s.done).length;
    return { steps, completed, total: steps.length };
  }, [checkedItems, uploadedFiles, note, reqs]);

  const isSubmitEnabled = completionStatus.completed === completionStatus.total;
  const progressPct =
    completionStatus.total > 0
      ? Math.round((completionStatus.completed / completionStatus.total) * 100)
      : 0;

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-3.5 h-3.5 text-blue-500" />;
    }
    return <FileText className="w-3.5 h-3.5 text-red-500" />;
  };

  const handleSubmitClick = async () => {
    if (!isSubmitEnabled) return;
    setIsSubmitting(true);
    try {
      const files: File[] = [];
      reqs.forEach((r) => {
        if (r.type === 'document') {
          files.push(...(uploadedFiles[r.id] || []));
        }
      });
      await onSubmit({ note: note.trim(), files });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex animate-ec-fade-in items-center justify-center bg-black/40 p-4 dark:bg-black/60"
    >
      <div
        className={cn(
          'flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900 animate-ec-modal-slide',
          isSubmitting && 'pointer-events-none opacity-60'
        )}
      >
        <div className="shrink-0 border-b border-gray-100 px-6 pb-4 pt-5 dark:border-gray-800">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#1a3c5e] dark:text-blue-400">Required to Submit</h2>
              <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">{officeName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isSubmitEnabled
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    : 'bg-gradient-to-r from-[#1a3c5e] to-[#2a5f8f] dark:from-blue-600 dark:to-blue-500'
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
              {completionStatus.completed}/{completionStatus.total} done
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {reqs.map((req, idx) => {
            const isDone =
              req.type === 'checkbox'
                ? !!checkedItems[req.id]
                : (uploadedFiles[req.id] || []).length > 0;

            return (
              <div
                key={req.id}
                className={cn(
                  'rounded-xl border p-3.5 transition-colors',
                  isDone
                    ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-900/10'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="relative h-4 w-4 shrink-0">
                    <CircleDashed
                      className={cn(
                        'absolute inset-0 h-4 w-4 text-gray-300 transition-opacity dark:text-gray-600',
                        isDone ? 'opacity-0' : 'opacity-100'
                      )}
                    />
                    <CircleCheck
                      className={cn(
                        'absolute inset-0 h-4 w-4 text-emerald-500 transition-opacity',
                        isDone ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Step {idx + 1} of {reqs.length}
                  </span>
                </div>

                {req.type === 'checkbox' ? (
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() => toggleCheck(req.id)}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                        checkedItems[req.id]
                          ? 'border-[#1a3c5e] bg-[#1a3c5e] dark:border-blue-600 dark:bg-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                    >
                      <Check className={cn('h-3.5 w-3.5 text-white', checkedItems[req.id] ? 'opacity-100' : 'opacity-0')} />
                    </div>
                    <span
                      className={cn(
                        'text-sm select-none',
                        checkedItems[req.id]
                          ? 'text-gray-400 line-through dark:text-gray-500'
                          : 'text-gray-700 dark:text-gray-300'
                      )}
                    >
                      {req.label}
                    </span>
                  </button>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#1a3c5e] dark:text-blue-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{req.label}</span>
                    </div>
                    {(uploadedFiles[req.id] || []).length > 0 && (
                      <div className="mb-2 space-y-1.5">
                        {(uploadedFiles[req.id] || []).map((file, fidx) => (
                          <div
                            key={fidx}
                            className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                          >
                            {getFileIcon(file)}
                            <span className="flex-1 truncate text-gray-600 dark:text-gray-300">{file.name}</span>
                            <span className="shrink-0 text-xs text-gray-300 dark:text-gray-600">
                              {(file.size / 1024).toFixed(0)} KB
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(req.id, fidx)}
                              className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverId(req.id);
                      }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(e) => handleDrop(req.id, e)}
                      className={cn(
                        'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-4 transition-colors',
                        dragOverId === req.id
                          ? 'border-[#1a3c5e] bg-blue-50/50 dark:border-blue-500 dark:bg-blue-900/10'
                          : 'border-gray-200 hover:border-[#1a3c5e]/40 dark:border-gray-700 dark:hover:border-blue-500/40'
                      )}
                    >
                      <input
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        multiple
                        onChange={(e) => handleFileUpload(req.id, e.target.files)}
                      />
                      <Upload
                        className={cn(
                          'h-5 w-5',
                          dragOverId === req.id ? 'text-[#1a3c5e] dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'
                        )}
                      />
                      <span className="text-center text-xs text-gray-400 dark:text-gray-500">
                        Drop files or <span className="text-[#1a3c5e] underline dark:text-blue-400">browse</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          <div
            className={cn(
              'rounded-xl border p-3.5',
              note.trim().length > 0
                ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-900/10'
                : 'border-gray-200 dark:border-gray-700'
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">Final step</span>
            </div>
            <label className="mb-2 block text-sm text-gray-500 dark:text-gray-400">
              If you have no violations, type{' '}
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-[#1a3c5e] dark:bg-blue-900/30 dark:text-blue-400">
                N/A
              </span>{' '}
              and submit.
            </label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-[#1a3c5e] focus:outline-none focus:ring-2 focus:ring-[#1a3c5e]/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
              rows={3}
              placeholder="Type N/A or describe your situation..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {!isSubmitEnabled && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Complete all {completionStatus.total - completionStatus.completed} remaining item(s) to enable
                submission.
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between rounded-b-2xl border-t border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/50">
          <span className="hidden text-xs text-gray-400 dark:text-gray-500 sm:block">
            {completionStatus.completed}/{completionStatus.total} requirements fulfilled
          </span>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={!isSubmitEnabled || isSubmitting}
              className={cn(
                'rounded-lg px-5 py-2.5 text-sm transition-all',
                isSubmitEnabled && !isSubmitting
                  ? 'cursor-pointer bg-[#1a3c5e] text-white hover:bg-[#15304d] hover:shadow-md dark:bg-blue-600 dark:hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Submitting...
                </span>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
