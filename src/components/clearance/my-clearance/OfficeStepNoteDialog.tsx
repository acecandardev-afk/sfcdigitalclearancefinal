import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface OfficeStepNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clearanceRequestId: string | null;
  signatoryId: string;
  officeName: string;
  disabled?: boolean;
}

export function OfficeStepNoteDialog({
  open,
  onOpenChange,
  clearanceRequestId,
  signatoryId,
  officeName,
  disabled,
}: OfficeStepNoteDialogProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !clearanceRequestId) {
      setNote('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/clearances/${encodeURIComponent(clearanceRequestId)}/step-notes/${encodeURIComponent(signatoryId)}`,
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error('load failed');
        const json = await res.json();
        if (cancelled) return;
        setNote(typeof json.note === 'string' ? json.note : '');
      } catch (e) {
        console.error(e);
        toast.error('Could not load your note');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clearanceRequestId, signatoryId]);

  const save = async () => {
    if (!clearanceRequestId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/clearances/${encodeURIComponent(clearanceRequestId)}/step-notes/${encodeURIComponent(signatoryId)}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: note.trim() }),
        }
      );
      if (!res.ok) throw new Error('save failed');
      toast.success('Note saved');
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Could not save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl border-border/60">
        <DialogHeader>
          <DialogTitle className="text-[#1a3c5e] dark:text-blue-400">Note for this office</DialogTitle>
          <DialogDescription>
            Share a preferred visit time or short message for{' '}
            <span className="font-medium text-foreground">{officeName}</span>. Signatories can read it when they open
            your request.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a3c5e]/50 dark:text-blue-400/50" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="office-step-note">Your message</Label>
            <Textarea
              id="office-step-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={disabled || saving}
              placeholder="e.g. I can visit Tuesday 9–11 AM, or please email me to reschedule."
              className="resize-none rounded-xl border-border/60"
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={disabled || saving || loading}
            className="rounded-xl bg-[#1a3c5e] hover:bg-[#15304d] dark:bg-blue-600"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
