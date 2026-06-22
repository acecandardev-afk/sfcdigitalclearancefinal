import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { canManageArchivedRecords } from '@/lib/permissionsMatrix';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArchiveRestore, Loader2, Search, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { formatApiErrorBody } from '@/lib/userMessages';

type ArchivedStudent = {
  id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  course: string | null;
  year_level: string | null;
  archived_at: string | null;
};

type ArchivedSignatory = {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  archived_at: string | null;
};

type RestoreTarget =
  | { kind: 'student'; item: ArchivedStudent }
  | { kind: 'signatory'; item: ArchivedSignatory };

export default function ArchivedRecordsPage() {
  const navigate = useNavigate();
  const { roles, loading: roleLoading } = useUserRole();
  const allowed = useMemo(() => canManageArchivedRecords(roles), [roles]);

  const [tab, setTab] = useState<'students' | 'signatories'>('students');
  const [students, setStudents] = useState<ArchivedStudent[]>([]);
  const [signatories, setSignatories] = useState<ArchivedSignatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/archived?type=all', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      setStudents((json.students ?? []) as ArchivedStudent[]);
      setSignatories((json.signatories ?? []) as ArchivedSignatory[]);
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not load archived records'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roleLoading) {
      if (!allowed) navigate('/dashboard');
      else void load();
    }
  }, [roleLoading, allowed, navigate, load]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.student_id ?? '').toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const filteredSignatories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return signatories;
    return signatories.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [signatories, searchQuery]);

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const url =
        restoreTarget.kind === 'student'
          ? `/api/students/${restoreTarget.item.id}/archive`
          : `/api/signatories/${restoreTarget.item.id}/archive`;
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      toast.success(
        restoreTarget.kind === 'student'
          ? 'Student restored to the active list'
          : 'Signatory restored to the active list'
      );
      setRestoreTarget(null);
      await load();
    } catch (e) {
      toast.error(safeActionErrorMessage(e, 'Could not restore this record'));
    } finally {
      setRestoring(false);
    }
  };

  const formatArchivedAt = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return format(new Date(iso), 'MMM d, yyyy p');
    } catch {
      return '—';
    }
  };

  if (!allowed && !roleLoading) return null;

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 p-6 lg:p-8 xl:px-10 space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">Archived records</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Students and signatories that were archived instead of deleted. Restoring returns them to their original
            lists.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived records…"
            className="pl-10 rounded-xl"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'students' | 'signatories')}>
          <TabsList>
            <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
            <TabsTrigger value="signatories">Signatories ({signatories.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="mt-4">
            <Card className="rounded-xl border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Archived students
                </CardTitle>
                <CardDescription>Restore to return them to the Students page.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No archived students.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredStudents.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.full_name || s.email}</p>
                          <p className="text-sm text-muted-foreground truncate">{s.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Archived {formatArchivedAt(s.archived_at)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl shrink-0"
                          onClick={() => setRestoreTarget({ kind: 'student', item: s })}
                        >
                          <ArchiveRestore className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signatories" className="mt-4">
            <Card className="rounded-xl border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserCheck className="h-5 w-5" />
                  Archived signatories
                </CardTitle>
                <CardDescription>Restore to return them to the Signatories page with prior links intact.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredSignatories.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No archived signatories.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredSignatories.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {s.position} · {s.department}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Archived {formatArchivedAt(s.archived_at)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl shrink-0"
                          onClick={() => setRestoreTarget({ kind: 'signatory', item: s })}
                        >
                          <ArchiveRestore className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this record?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreTarget?.kind === 'student' ? (
                <>
                  <strong>{restoreTarget.item.full_name || restoreTarget.item.email}</strong> will appear again on the
                  Students page and can sign in.
                </>
              ) : restoreTarget?.kind === 'signatory' ? (
                <>
                  <strong>{restoreTarget.item.name}</strong> will appear again on the Signatories page with the same
                  office assignments and clearance history.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRestore()} disabled={restoring}>
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
