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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
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
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !clearanceRequestId || !user?.id) {
      setNote('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('student_clearance_step_notes')
        .select('note')
        .eq('clearance_request_id', clearanceRequestId)
        .eq('signatory_id', signatoryId)
        .eq('student_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error('Could not load your note');
      } else {
        setNote((data?.note as string) ?? '');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clearanceRequestId, signatoryId, user?.id]);

  const save = async () => {
    if (!clearanceRequestId || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('student_clearance_step_notes').upsert(
        {
          clearance_request_id: clearanceRequestId,
          signatory_id: signatoryId,
          student_id: user.id,
          note: note.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clearance_request_id,signatory_id' }
      );
      if (error) throw error;
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Note for this office</DialogTitle>
          <DialogDescription>
            Share a preferred visit time or short message for <span className="font-medium text-foreground">{officeName}</span>.
            Signatories can read it when they open your request.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              className="resize-none"
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={disabled || saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
