import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History } from 'lucide-react';
import type { TimelineEntry } from './myClearanceTimeline';

interface ClearanceTimelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeName: string;
  entries: TimelineEntry[];
}

export function ClearanceTimelineModal({
  open,
  onOpenChange,
  officeName,
  entries,
}: ClearanceTimelineModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-gray-100 bg-gradient-to-r from-[#1a3c5e]/5 to-blue-500/5 px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a3c5e]/10 dark:bg-blue-500/20">
              <History className="h-5 w-5 text-[#1a3c5e] dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-left text-lg">Clearance history</DialogTitle>
              <DialogDescription className="text-left text-xs text-muted-foreground">{officeName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[min(60vh,420px)]">
          <div className="space-y-0 px-6 py-4">
            {entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No history yet. Submit a request first.</p>
            ) : (
              entries.map((entry, i) => (
                <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-2">
                  {i < entries.length - 1 && (
                    <div className="absolute left-[7px] top-3 h-[calc(100%-4px)] w-px bg-gray-200 dark:bg-gray-700" />
                  )}
                  <div className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#1a3c5e] bg-white dark:border-blue-400 dark:bg-gray-900" />
                  <div className="min-w-0 flex-1 pt-0">
                    <p className="text-sm font-medium text-foreground">{entry.action}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.timestamp}</p>
                    {entry.detail && (
                      <p className="mt-2 rounded-lg border border-gray-100 bg-gray-50/80 p-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
                        {entry.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
