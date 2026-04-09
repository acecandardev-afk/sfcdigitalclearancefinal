import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Loader2,
  GraduationCap,
  Search,
  Pencil,
  Archive,
  ArchiveRestore,
  Users,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
  student_id: string | null;
  year_level: string | null;
  course: string | null;
  is_archived?: boolean;
}

const createSchema = z.object({
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().trim().min(1, 'Full name is required'),
  student_id: z.string().trim().optional(),
  year_level: z.string().trim().optional(),
  course: z.string().trim().optional(),
});

const editSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  student_id: z.string().trim().optional(),
  year_level: z.string().trim().optional(),
  course: z.string().trim().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
const COURSES = [
  'College of Computer Studies',
  'College of Business Administration',
  'College of Education',
  'College of Engineering',
  'College of Arts and Sciences',
  'College of Nursing',
  'College of Accountancy',
];

export default function Students() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [totalActiveCount, setTotalActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      student_id: '',
      year_level: '',
      course: '',
    },
  });

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: '',
      student_id: '',
      year_level: '',
      course: '',
    },
  });

  useEffect(() => {
    if (!roleLoading) {
      if (!isSuperAdmin()) {
        navigate('/dashboard');
      } else {
        fetchStudents();
      }
    }
  }, [roleLoading, isSuperAdmin, navigate, showArchived]);

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
        setTotalActiveCount(0);
        setArchivedCount(0);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('profiles')
        .select('id, full_name, email, student_id, year_level, course, is_archived')
        .in('id', userIds)
        .order('full_name');

      if (showArchived) {
        query = query.eq('is_archived', true);
      } else {
        query = query.or('is_archived.eq.false,is_archived.is.null');
      }

      const [profilesResult, activeRes, archivedRes] = await Promise.all([
        query,
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('id', userIds)
          .or('is_archived.eq.false,is_archived.is.null'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('id', userIds)
          .eq('is_archived', true),
      ]);

      const { data: profiles, error: profileError } = profilesResult;
      if (profileError) throw profileError;
      setStudents((profiles as StudentProfile[]) || []);
      setTotalActiveCount(activeRes.count ?? 0);
      setArchivedCount(archivedRes.count ?? 0);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    createForm.reset({
      email: '',
      password: '',
      full_name: '',
      student_id: '',
      year_level: '',
      course: '',
    });
    setCreateDialogOpen(true);
  };

  const openEditDialog = (student: StudentProfile) => {
    setEditingStudent(student);
    editForm.reset({
      full_name: student.full_name || '',
      student_id: student.student_id || '',
      year_level: student.year_level || '',
      course: student.course || '',
    });
    setEditDialogOpen(true);
  };

  const onCreateSubmit = async (data: CreateFormData) => {
    setFormLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('create-student-account', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          student_id: data.student_id || undefined,
          year_level: data.year_level || undefined,
          course: data.course || undefined,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      toast.success('Student account created. They can now sign in.');
      setCreateDialogOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error creating student:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setFormLoading(false);
    }
  };

  const onEditSubmit = async (data: EditFormData) => {
    if (!editingStudent) return;
    setFormLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          student_id: data.student_id || null,
          year_level: data.year_level || null,
          course: data.course || null,
        })
        .eq('id', editingStudent.id);

      if (error) throw error;
      toast.success('Student updated successfully');
      setEditDialogOpen(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error updating student:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleArchive = async (student: StudentProfile, archive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_archived: archive })
        .eq('id', student.id);

      if (error) throw error;
      toast.success(archive ? 'Student archived' : 'Student restored');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error archiving:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const bulkArchive = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_archived: true })
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      toast.success(`${selectedIds.size} student(s) archived`);
      setSelectedIds(new Set());
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error archiving:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to archive');
    }
  };

  const bulkRestore = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_archived: false })
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      toast.success(`${selectedIds.size} student(s) restored`);
      setSelectedIds(new Set());
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error restoring:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to restore');
    }
  };

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'all' || (s.course ?? '') === departmentFilter;
    const matchesYear = yearLevelFilter === 'all' || (s.year_level ?? '') === yearLevelFilter;
    return matchesSearch && matchesDept && matchesYear;
  });


  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
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

  const uniqueDepartments = [...new Set(students.map((s) => s.course).filter(Boolean))] as string[];
  const uniqueYearLevels = [...new Set(students.map((s) => s.year_level).filter(Boolean))] as string[];

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
      <div className="w-full p-6 lg:p-8 xl:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">Students</h1>
            <p className="text-muted-foreground mt-1">Create and manage student accounts. Students cannot self-register.</p>
          </div>
          <Button onClick={openCreateDialog} className="shrink-0 rounded-xl shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Student Account
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card className="border border-border/50 rounded-xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold tabular-nums">{totalActiveCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 rounded-xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <UserX className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Archived Students</p>
                  <p className="text-2xl font-bold tabular-nums">{archivedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 rounded-xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <GraduationCap className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Showing</p>
                  <p className="text-2xl font-bold tabular-nums">{filtered.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl border-border/60 focus-visible:ring-2"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[220px] rounded-xl">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {COURSES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
              {uniqueDepartments.filter((d) => !COURSES.includes(d)).map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearLevelFilter} onValueChange={setYearLevelFilter}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
              <SelectValue placeholder="Year Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Year Levels</SelectItem>
              {YEAR_LEVELS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
              {uniqueYearLevels.filter((yl) => !YEAR_LEVELS.includes(yl)).map((yl) => (
                <SelectItem key={yl} value={yl}>{yl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showArchived ? 'default' : 'outline'}
            className="rounded-xl shrink-0"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Show Active' : 'Show Archived'}
          </Button>
        </div>

        {/* Table / List */}
        <Card className="border border-border/50 rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  {showArchived ? 'Archived Students' : 'Student Accounts'} ({filtered.length})
                </CardTitle>
                <CardDescription>
                  {showArchived ? 'Restore archived students to make them active again' : 'Only the administrator can create student accounts'}
                </CardDescription>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  {showArchived ? (
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={bulkRestore}>
                      <ArchiveRestore className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={bulkArchive}>
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border/70 rounded-xl bg-muted/20">
                <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-base font-semibold">
                  {showArchived ? 'No archived students' : 'No students yet'}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {searchQuery || departmentFilter !== 'all' || yearLevelFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : showArchived
                    ? 'Archived students will appear here'
                    : 'Create a student account to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Header row with checkbox */}
                <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/30 border border-border/50">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm font-medium text-muted-foreground w-8">#</span>
                  <span className="flex-1 text-sm font-medium text-muted-foreground">Name</span>
                  <span className="hidden md:block flex-1 text-sm font-medium text-muted-foreground">Email / ID</span>
                  <span className="hidden lg:block w-32 text-sm font-medium text-muted-foreground">Department</span>
                  <span className="hidden lg:block w-24 text-sm font-medium text-muted-foreground">Year</span>
                  <span className="w-24 text-sm font-medium text-muted-foreground text-right">Actions</span>
                </div>
                {filtered.map((student, index) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-4 px-4 py-4 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border/80 transition-all duration-200"
                  >
                    <Checkbox
                      checked={selectedIds.has(student.id)}
                      onCheckedChange={() => toggleSelect(student.id)}
                    />
                    <span className="text-sm text-muted-foreground w-8 tabular-nums">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{student.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate md:hidden">{student.email || student.student_id || '—'}</p>
                    </div>
                    <div className="hidden md:block flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{student.email || '—'}</p>
                      {student.student_id && (
                        <p className="text-xs text-muted-foreground/80 truncate">{student.student_id}</p>
                      )}
                    </div>
                    <div className="hidden lg:block w-32">
                      <p className="text-sm text-muted-foreground truncate">{student.course || '—'}</p>
                    </div>
                    <div className="hidden lg:block w-24">
                      <p className="text-sm text-muted-foreground truncate">{student.year_level || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 w-24 justify-end shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg"
                        onClick={() => openEditDialog(student)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                        onClick={() => toggleArchive(student, !showArchived)}
                      >
                        {showArchived ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create student account</DialogTitle>
            <DialogDescription>
              The student will use the email and password you set to sign in. They cannot register on their own.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Dela Cruz" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="student@example.com" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="student_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl>
                      <Input placeholder="23-0456-A" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="year_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year level</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YEAR_LEVELS.map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course / Department</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COURSES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading} className="rounded-xl">
                  {formLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
            <DialogDescription>
              Update student information. Email cannot be changed here.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Dela Cruz" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="student_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl>
                      <Input placeholder="23-0456-A" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="year_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year level</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YEAR_LEVELS.map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course / Department</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COURSES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading} className="rounded-xl">
                  {formLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
