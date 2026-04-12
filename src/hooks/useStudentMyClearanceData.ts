import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  parseRequirements,
  type UiStepRow,
} from '@/components/clearance/my-clearance/myClearanceTypes';
import { toast } from 'sonner';

type SignatoryRow = {
  id: string;
  name: string;
  position: string;
  department: string;
  display_schedule: string | null;
  request_requirements: unknown;
  signatory_group: string | null;
  authority_sequence_order: number | null;
  is_active: boolean | null;
};

type AssignmentRow = {
  sequence_order: number;
  signatory_group: string;
  signatories: SignatoryRow | null;
};

function mapDbStatusToUi(
  status: string | null | undefined,
  hasSignature: boolean
): UiStepRow['uiStatus'] {
  if (!hasSignature) return 'Request';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

export function useStudentMyClearanceData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UiStepRow[]>([]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(null);

  const isMissingSchemaError = (err: unknown) => {
    const msg = String((err as { message?: unknown } | null)?.message ?? '').toLowerCase();
    return (
      msg.includes('does not exist') ||
      msg.includes('relation') ||
      msg.includes('column') ||
      msg.includes('schema cache')
    );
  };

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // The generated Supabase types in this repo may not include newer tables/relationships.
      // Use a loosely typed client to avoid compile-time SelectQueryError types.
      const sb: typeof supabase & { from: (table: string) => any } = supabase as any;

      const { data: security } = await sb
        .from('system_settings')
        .select('value_json')
        .eq('key', 'security')
        .maybeSingle();
      const mult =
        (security?.value_json as { allow_multiple_clearances?: boolean } | null)?.allow_multiple_clearances ?? false;
      setAllowMultiple(!!mult);

      const { data: draft } = await supabase
        .from('clearance_requests')
        .select('id')
        .eq('student_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let completedId: string | null = null;
      if (!draft?.id && !mult) {
        const { data: last } = await supabase
          .from('clearance_requests')
          .select('id, status')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (last?.status === 'approved') completedId = last.id;
      }

      setDraftRequestId(draft?.id ?? null);
      setCompletedRequestId(completedId);

      const requestIdForSigs = draft?.id ?? completedId;
      const sigMap = new Map<
        string,
        {
          id: string;
          status: string | null;
          remarks: string | null;
          signed_at: string | null;
          notes: string | null;
          created_at: string | null;
        }
      >();

      if (requestIdForSigs) {
        const { data: sigs, error: sigErr } = await sb
          .from('clearance_signatures')
          .select('id, signatory_id, status, remarks, signed_at, notes, created_at')
          .eq('clearance_request_id', requestIdForSigs);
        if (sigErr) throw sigErr;
        (sigs || []).forEach((s) => sigMap.set(s.signatory_id, s));
      }

      let assigns: AssignmentRow[] = [];

      const { data: personal, error: aErr } = await sb
        .from('student_signatory_assignments')
        .select(
          `sequence_order, signatory_group, signatories (
            id, name, position, department, display_schedule, request_requirements,
            signatory_group, authority_sequence_order, is_active
          )`
        )
        .eq('student_id', user.id)
        .order('sequence_order', { ascending: true });

      if (aErr) {
        if (!isMissingSchemaError(aErr)) throw aErr;
        assigns = [];
      } else {
        assigns = (personal || []) as unknown as AssignmentRow[];
      }

      if (!assigns.length) {
        const { data: defs, error: dErr } = await sb
          .from('clearance_default_signatories')
          .select(
            `sequence_order, signatories (
              id, name, position, department, display_schedule, request_requirements,
              signatory_group, authority_sequence_order, is_active
            )`
          )
          .order('sequence_order', { ascending: true });

        if (dErr) {
          if (!isMissingSchemaError(dErr)) throw dErr;

          const { data: defsFallback, error: dFallbackErr } = await sb
            .from('clearance_default_signatories')
            .select(
              `sequence_order, signatories (
                id, name, position, department, signatory_group, authority_sequence_order, is_active
              )`
            )
            .order('sequence_order', { ascending: true });
          if (dFallbackErr) throw dFallbackErr;

          assigns = ((defsFallback || []) as unknown[]).map((row) => {
            const r = row as {
              sequence_order: number;
              signatories: Partial<SignatoryRow> | null;
            };
            return {
              sequence_order: r.sequence_order,
              signatory_group: (r.signatories?.signatory_group as string) || 'standard',
              signatories: {
                id: String(r.signatories?.id ?? ''),
                name: String(r.signatories?.name ?? ''),
                position: String(r.signatories?.position ?? ''),
                department: String(r.signatories?.department ?? ''),
                display_schedule: null,
                request_requirements: null,
                signatory_group: (r.signatories?.signatory_group as string) ?? 'standard',
                authority_sequence_order: (r.signatories?.authority_sequence_order as number | null) ?? null,
                is_active: (r.signatories?.is_active as boolean | null) ?? true,
              } as SignatoryRow,
            } as AssignmentRow;
          });
        } else {
          assigns = (defs || []) as unknown as AssignmentRow[];
        }
      }

      const built: UiStepRow[] = [];
      for (const a of assigns) {
        const s = a.signatories;
        if (!s || s.is_active === false) continue;
        const group = (s.signatory_group || a.signatory_group || 'standard') as 'standard' | 'authority';
        const sig = sigMap.get(s.id);
        const uiStatus = mapDbStatusToUi(sig?.status, !!sig);
        built.push({
          id: s.id,
          signatoryId: s.id,
          sequenceOrder: a.sequence_order,
          office: s.department || s.name,
          officer: `${s.name} — ${s.position}`,
          uiStatus: sig ? uiStatus : 'Request',
          date: sig?.signed_at
            ? new Date(sig.signed_at).toLocaleDateString()
            : sig?.created_at
              ? new Date(sig.created_at).toLocaleDateString()
              : '—',
          schedule: s.display_schedule || '—',
          remarks: sig?.remarks || sig?.notes || '—',
          requirements: parseRequirements(s.request_requirements),
          signatureId: sig?.id ?? null,
          signatoryGroup: group,
          authoritySequenceOrder: s.authority_sequence_order,
          signatureCreatedAt: sig?.created_at ?? null,
          signatureSignedAt: sig?.signed_at ?? null,
        });
      }

      setRows(built);
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
