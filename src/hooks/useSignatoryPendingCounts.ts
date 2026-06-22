import { useQuery } from '@tanstack/react-query';

export type SignatoryPendingCountsOptions = {
  fetchStudent: boolean;
  fetchInstitutional: boolean;
};

async function fetchStudentPendingCount(): Promise<number> {
  const res = await fetch('/api/signatory/pending-count', { credentials: 'include' });
  if (!res.ok) return 0;
  const j = (await res.json()) as { count?: number };
  return typeof j.count === 'number' ? j.count : 0;
}

async function fetchInstitutionalToSignCount(): Promise<number> {
  const res = await fetch('/api/institutional/signatory/queue-count', { credentials: 'include' });
  if (!res.ok) return 0;
  const j = (await res.json()) as { toSignCount?: number };
  return typeof j.toSignCount === 'number' ? j.toSignCount : 0;
}

/**
 * Cached nav badge counts (student + institutional signatory queues).
 * Shares React Query cache across sidebar instances; refetches on focus.
 */
export function useSignatoryPendingCounts(opts: SignatoryPendingCountsOptions) {
  const { fetchStudent, fetchInstitutional } = opts;

  const studentQ = useQuery({
    queryKey: ['signatory-pending-count'],
    queryFn: fetchStudentPendingCount,
    enabled: fetchStudent,
    staleTime: 25_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  const institutionalQ = useQuery({
    queryKey: ['institutional-signatory-queue-count'],
    queryFn: fetchInstitutionalToSignCount,
    enabled: fetchInstitutional,
    staleTime: 25_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  return {
    studentPending: fetchStudent ? (studentQ.data ?? null) : null,
    institutionalToSign: fetchInstitutional ? (institutionalQ.data ?? null) : null,
    refetch: async () => {
      await Promise.all([
        fetchStudent ? studentQ.refetch() : Promise.resolve(),
        fetchInstitutional ? institutionalQ.refetch() : Promise.resolve(),
      ]);
    },
  };
}
