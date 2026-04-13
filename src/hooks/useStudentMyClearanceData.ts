import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { UiStepRow } from '@/components/clearance/my-clearance/myClearanceTypes';
import { toast } from 'sonner';

export function useStudentMyClearanceData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UiStepRow[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/student/my-clearance-data', { credentials: 'include' });
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      setAllowMultiple(!!json.allowMultiple);
      setDraftRequestId(json.draftRequestId ?? null);
      setCompletedRequestId(json.completedRequestId ?? null);
      setRows((json.rows ?? []) as UiStepRow[]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load clearance data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const readonlyCompleted = !!completedRequestId && !allowMultiple;

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    rows,
    allowMultiple,
    draftRequestId,
    completedRequestId,
    setDraftRequestId,
    reload,
    readonlyCompleted,
  };
}
