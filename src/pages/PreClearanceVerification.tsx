import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, UserCheck, CheckCircle2, CircleDashed } from 'lucide-react';
import { toast } from 'sonner';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { userErrorFromApi } from '@/lib/userMessages';
import type { StudentPreClearanceStatus } from '@/hooks/useStudentMyClearanceData';

type GateId = 'faculty' | 'cmo' | 'guidance';

type GateDefinition = {
  id: GateId;
  label: string;
  officeLabel: string;
  description: string;
};

type StudentRow = {
  id: string;
  email: string;
  full_name: string;
  student_id: string;
  course: string;
  year_level: string;
  preClearance: StudentPreClearanceStatus;
};

export default function PreClearanceVerification() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [allowedGates, setAllowedGates] = useState<GateId[]>([]);
  const [gateDefinitions, setGateDefinitions] = useState<GateDefinition[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marking, setMarking] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch('/api/admin/pre-clearance', { credentials: 'include' });
    if (!res.ok) {
      navigate('/dashboard', { replace: true });
      return false;
    }
    const json = await res.json();
    setAllowedGates((json.allowedGates ?? []) as GateId[]);
    setGateDefinitions((json.gateDefinitions ?? []) as GateDefinition[]);
    return true;
  }, [navigate]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadMeta();
      setLoading(false);
    })();
  }, [loadMeta]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setStudents([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/pre-clearance?search=${encodeURIComponent(trimmed)}`,
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error(await userErrorFromApi(await res.json().catch(() => ({})), 'Search failed.'));
        const json = await res.json();
        setStudents((json.students ?? []) as StudentRow[]);
        setAllowedGates((json.allowedGates ?? []) as GateId[]);
      } catch (e) {
        toast.error(safeActionErrorMessage(e, 'Could not search students.'));
      } finally {
        setSearching(false);
      }
    },
    []
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runSearch(search);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search, runSearch]);

  const markVerified = async (studentId: string, gate: GateId) => {
    const key = `${studentId}:${gate}`;
    setMarking(key);
    try {
      const res = await fetch('/api/admin/pre-clearance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, gate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(userErrorFromApi(json, 'Could not mark student verified.'));
      const updated = json.preClearance as StudentPreClearanceStatus;
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, preClearance: updated } : s))
      );
      toast.success('Student marked as physically verified.');
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not mark student verified.'));
    } finally {
      setMarking(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Physical verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark students in person at your office before they can request or submit clearance. Faculty, CMO, and
            Guidance each record their own verification.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your verification offices</CardTitle>
            <CardDescription>
              {allowedGates.length
                ? 'You can mark students for the offices listed below.'
                : 'You do not have permission to mark any office. Contact an administrator if this is wrong.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {gateDefinitions.map((g) => (
              <Badge
                key={g.id}
                variant={allowedGates.includes(g.id) ? 'default' : 'outline'}
                className="text-xs"
              >
                {g.officeLabel}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Find a student</CardTitle>
            <CardDescription>Search by name, student ID, or email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search students…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}

            {!searching && search.trim() && students.length === 0 && (
              <p className="text-sm text-muted-foreground">No students match that search.</p>
            )}

            <div className="space-y-3">
              {students.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.student_id} · {s.course} · {s.year_level}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                    {s.preClearance.allComplete ? (
                      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        All verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Clearance blocked</Badge>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {s.preClearance.gates.map((g) => {
                      const canMark = allowedGates.includes(g.gate as GateId);
                      const key = `${s.id}:${g.gate}`;
                      const busy = marking === key;
                      return (
                        <div
                          key={g.gate}
                          className="flex flex-col gap-2 rounded-md border border-border/80 bg-muted/30 p-3"
                        >
                          <div className="flex items-start gap-2">
                            {g.verified ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight">{g.officeLabel}</p>
                              {g.verified && g.verifiedAt ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {new Date(g.verifiedAt).toLocaleString()}
                                  {g.verifiedByName ? ` · ${g.verifiedByName}` : ''}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-xs text-muted-foreground">Not yet verified</p>
                              )}
                            </div>
                          </div>
                          {canMark && !g.verified && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-1"
                              disabled={busy}
                              onClick={() => void markVerified(s.id, g.gate as GateId)}
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                              Mark verified
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
