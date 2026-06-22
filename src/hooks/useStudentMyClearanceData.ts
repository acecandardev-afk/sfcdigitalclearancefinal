import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { UiStepRow } from '@/components/clearance/my-clearance/myClearanceTypes';
import { toast } from 'sonner';

export type PreClearanceGateStatus = {
  gate: string;
  label: string;
  officeLabel: string;
  description: string;
  verified: boolean;
  verifiedAt: string | null;
  verifiedByName: string | null;
};

export type StudentPreClearanceStatus = {
  gates: PreClearanceGateStatus[];
  allComplete: boolean;
  missingGates: string[];
};

type ReloadMode = 'full' | 'background';

export function useStudentMyClearanceData() {
  const { user, loading: authLoading } = useAuth();
  const loadErrorToastShown = useRef(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UiStepRow[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(null);
  const [submissionAllowed, setSubmissionAllowed] = useState(true);
  const [submissionBlockReason, setSubmissionBlockReason] = useState<string | null>(null);
  const [preClearance, setPreClearance] = useState<StudentPreClearanceStatus | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  const reload = useCallback(
    async (mode: ReloadMode = 'full') => {
      if (!user?.id) return;
      const showSpinner = mode === 'full';
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch('/api/student/my-clearance-data', { credentials: 'include' });
        if (!res.ok) throw new Error('load failed');
        const json = await res.json();
        setAllowMultiple(!!json.allowMultiple);
        setDraftRequestId(json.draftRequestId ?? null);
        setCompletedRequestId(json.completedRequestId ?? null);
        setRows((json.rows ?? []) as UiStepRow[]);
        setSubmissionAllowed(json.submissionAllowed !== false);
        setSubmissionBlockReason((json.submissionBlockReason as string | null) ?? null);
        setPreClearance((json.preClearance as StudentPreClearanceStatus | null) ?? null);
        setVerifyToken((json.verifyToken as string | null) ?? null);
        loadErrorToastShown.current = false;
      } catch (e) {
        console.error(e);
        if (mode === 'full' && !loadErrorToastShown.current) {
          loadErrorToastShown.current = true;
          toast.error('Could not load your clearance. Refresh the page or try again shortly.');
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    void reload('full');

    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void reload('background');
    }, 12000);
    return () => clearInterval(tick);
  }, [authLoading, user?.id, reload]);

  const readonlyCompleted = !!completedRequestId && !allowMultiple;

  return {
    loading,
    rows,
    allowMultiple,
    draftRequestId,
    completedRequestId,
    setDraftRequestId,
    reload: () => reload('full'),
    readonlyCompleted,
    submissionAllowed,
    submissionBlockReason,
    preClearance,
    verifyToken,
  };
}