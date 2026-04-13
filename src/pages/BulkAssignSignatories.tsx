import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Info, Loader2, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatApiErrorBody } from '@/lib/userMessages';
import { PROGRAM_COURSES, YEAR_LEVEL_OPTIONS } from '@/constants/academicOptions';

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
  student_id: string | null;
  year_level: string | null;
  course: string | null;
}

interface Signatory {
  id: string;
  name: string;
  position: string;
  department: string;
  signatory_group: 'standard' | 'authority';
  authority_sequence_order: number | null;
}

export default function BulkAssignSignatories() {
  const navigate = useNavigate();
  const { roles, loading: roleLoading } = useUserRole();
  const isSuperAdminUser = roles.includes('superadmin');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roleLoading && !isSuperAdminUser) {
      navigate('/dashboard');
    }
  }, [roleLoading, isSuperAdminUser, navigate]);

  const fetchStudents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (courseFilter !== 'all') params.set('course', courseFilter);
      if (yearLevelFilter !== 'all') params.set('year_level', yearLevelFilter);
      const qs = params.toString();
      const res = await fetch(`/api/students${qs ? `?${qs}` : ''}`, { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      setStudents((json.students as StudentProfile[]) || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [courseFilter, yearLevelFilter]);

  const fetchSignatories = useCallback(async () => {
    try {
      const res = await fetch('/api/signatories?active_only=true&order=bulk_assign', {
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      const raw = (json.signatories || []) as any[];
      const mapped: Signatory[] = raw.map((s) => ({
        id: String(s.id),
        name: String(s.name ?? ''),
        position: String(s.position ?? ''),
        department: String(s.department ?? ''),
        signatory_group: (s.signatoryGroup ?? s.signatory_group) as 'standard' | 'authority',
        authority_sequence_order:
          s.authoritySequenceOrder ?? s.authority_sequence_order ?? null,
      }));
      setSignatories(mapped);
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load signatories');
    }
  }, []);

  useEffect(() => {
    if (roleLoading || !isSuperAdminUser) return;
    setLoading(true);
    void Promise.all([fetchStudents(), fetchSignatories()]);
  }, [roleLoading, isSuperAdminUser, fetchStudents, fetchSignatories]);

  const handleBulkAssign = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one student');
      return;
    }
    if (signatories.length === 0) {
      toast.error('No active signatories loaded. Add signatories in Settings → Signatories, then refresh.');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch('/api/admin/bulk-assign-signatories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selectedIds) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiErrorBody(json));
      }
      const perStudent = Number(json.signatoriesPerStudent ?? signatories.length);
      const count = Number(json.studentsAssigned ?? selectedIds.size);
      const skipped = Number(json.skippedNonStudents ?? 0);
      let msg = `Assigned ${perStudent} signatory step(s) to ${count} student(s).`;
      if (skipped > 0) {
        msg += ` (${skipped} selected row(s) skipped — not student accounts.)`;
      }
      toast.success(msg);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk assigning:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign signatories');
    } finally {
      setAssigning(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (roleLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-primary" />
              Bulk Assign Signatories
            </h1>
            <p className="text-muted-foreground mt-1 max-w-3xl">
              Set which offices sign each student&apos;s clearance when they file a request. Use this page to apply the
              same signatory lineup to many students at once (for example, everyone in a course or year level).
            </p>
          </div>

          <Card className="border border-primary/20 bg-primary/5 rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Info className="h-5 w-5 text-primary shrink-0" />
                How this page works
              </CardTitle>
              <CardDescription className="text-foreground/80">
                Quick guide for administrators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                <span className="font-medium text-foreground">What it does.</span> Each student can have a{' '}
                <span className="font-medium text-foreground">personal signatory list</span> (order of offices that must
                sign their clearance). Bulk assign writes that list for everyone you select, using{' '}
                <span className="font-medium text-foreground">all active signatories</span> in the system—standard offices
                first, then authority offices in sequence—so new clearance requests follow the correct path.
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-0.5">
                <li>Optional: use <span className="font-medium text-foreground">Course</span> and{' '}
                  <span className="font-medium text-foreground">Year level</span> to narrow the student list.</li>
                <li>
                  Select one or more students with the checkboxes (use the header checkbox to select everyone listed).
                </li>
                <li>
                  Click <span className="font-medium text-foreground">Assign to … student(s)</span>. Previous personal
                  assignments for those students are replaced with the current full signatory set.</li>
              </ol>
              <p className="text-xs border-t border-border/60 pt-3 mt-1">
                Signatories are managed under <span className="font-medium text-foreground">Signatories</span> in the
                dashboard. Only students with the student role can receive assignments; the success message will say if
                any selected rows were skipped.
              </p>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="border border-border/50 rounded-xl shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Filter Students</CardTitle>
              <CardDescription>Select course and year level to narrow the list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="All Courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Courses</SelectItem>
                      {PROGRAM_COURSES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year Level</Label>
                  <Select value={yearLevelFilter} onValueChange={setYearLevelFilter}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="All Year Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Year Levels</SelectItem>
                      {YEAR_LEVEL_OPTIONS.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signatory set info */}
          <Card className="border border-border/50 rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Signatory Set to Assign</CardTitle>
              <CardDescription>
                All active signatories (Standard Group + Authority Group) will be assigned to selected students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {signatories.slice(0, 5).map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                  >
                    {s.department}
                  </span>
                ))}
                {signatories.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{signatories.length - 5} more</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Student list */}
          <Card className="border border-border/50 rounded-xl shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Students ({students.length})
                  </CardTitle>
                  <CardDescription>Check the students to assign signatories to</CardDescription>
                </div>
                {selectedIds.size > 0 && (
                  <Button
                    onClick={handleBulkAssign}
                    disabled={assigning}
                    className="rounded-xl"
                  >
                    {assigning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Assign to {selectedIds.size} student(s)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/70 rounded-xl bg-muted/20">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No students match the current filters</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/30 border border-border/50">
                    <Checkbox
                      checked={selectedIds.size === students.length && students.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="flex-1 text-sm font-medium text-muted-foreground">Name</span>
                    <span className="text-sm font-medium text-muted-foreground">Course / Year</span>
                  </div>
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border/50 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={() => toggleSelect(student.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.email || student.student_id || '—'}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {student.course || '—'} • {student.year_level || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
