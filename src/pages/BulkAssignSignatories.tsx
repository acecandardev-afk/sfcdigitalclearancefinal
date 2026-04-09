import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
import { Loader2, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

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

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
const COURSES = [
  'BSIS',
  'BSCS',
  'BSIT',
  'BSBA',
  'BSEd',
  'BSN',
  'BSHM',
  'BSTM',
  'AB Comm',
  'BS Psych',
  'BS Crim',
  'College of Computer Studies',
  'College of Business Administration',
  'College of Education',
  'College of Engineering',
  'College of Arts and Sciences',
  'College of Nursing',
  'College of Accountancy',
];

export default function BulkAssignSignatories() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    if (isSuperAdmin() && !roleLoading) {
      fetchStudents();
      fetchSignatories();
    }
  }, [roleLoading, isSuperAdmin, courseFilter, yearLevelFilter]);

  const fetchStudents = async () => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (roleError) throw roleError;
      const userIds = (roleData || []).map((r) => r.user_id);
      if (userIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('profiles')
        .select('id, full_name, email, student_id, year_level, course')
        .in('id', userIds)
        .or('is_archived.eq.false,is_archived.is.null')
        .order('full_name');

      if (courseFilter !== 'all') query = query.eq('course', courseFilter);
      if (yearLevelFilter !== 'all') query = query.eq('year_level', yearLevelFilter);

      const { data: profiles, error } = await query;
      if (error) throw error;
      setStudents((profiles as StudentProfile[]) || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const fetchSignatories = async () => {
    try {
      const { data, error } = await supabase
        .from('signatories')
        .select('id, name, position, department, signatory_group, authority_sequence_order')
        .eq('is_active', true)
        .order('signatory_group')
        .order('authority_sequence_order', { ascending: true, nullsFirst: true });

      if (error) throw error;
      setSignatories((data as Signatory[]) || []);
    } catch (error) {
      console.error('Error fetching signatories:', error);
      toast.error('Failed to load signatories');
    }
  };

  const handleBulkAssign = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one student');
      return;
    }
    if (signatories.length === 0) {
      toast.error('No signatories available. Run seed:signatories first.');
      return;
    }

    setAssigning(true);
    try {
      const standardSignatories = signatories.filter((s) => s.signatory_group === 'standard');
      const authoritySignatories = signatories
        .filter((s) => s.signatory_group === 'authority' && s.authority_sequence_order != null)
        .sort((a, b) => (a.authority_sequence_order ?? 0) - (b.authority_sequence_order ?? 0));

      const inserts: { student_id: string; signatory_id: string; signatory_group: string; sequence_order: number }[] = [];
      for (const studentId of selectedIds) {
        let seq = 1;
        for (const s of standardSignatories) {
          inserts.push({
            student_id: studentId,
            signatory_id: s.id,
            signatory_group: 'standard',
            sequence_order: seq++,
          });
        }
        for (const s of authoritySignatories) {
          inserts.push({
            student_id: studentId,
            signatory_id: s.id,
            signatory_group: 'authority',
            sequence_order: seq++,
          });
        }
      }

      // Delete existing assignments for selected students, then insert
      await supabase.from('student_signatory_assignments').delete().in('student_id', Array.from(selectedIds));
      const { error } = await supabase.from('student_signatory_assignments').insert(inserts);

      if (error) throw error;
      toast.success(`Assigned ${signatories.length} signatories to ${selectedIds.size} student(s)`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk assigning:', error);
      toast.error('Failed to assign signatories');
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
            <p className="text-muted-foreground mt-1">
              Filter students by course and year level, then assign signatories in one action.
            </p>
          </div>

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
                      {COURSES.map((c) => (
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
                      {YEAR_LEVELS.map((y) => (
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
