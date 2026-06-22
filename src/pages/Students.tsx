import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { safeActionErrorMessage } from '@/lib/userFacingError';
import { formatApiErrorBody, sanitizeUserFacingText } from '@/lib/userMessages';
import { useUserRole } from '@/hooks/useUserRole';
import { canCreateStudentAccounts, canManageArchivedRecords, canManageStudents } from '@/lib/permissionsMatrix';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Users,
  UserX,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { PROGRAM_COURSES, YEAR_LEVEL_OPTIONS } from '@/constants/academicOptions';
import { parseStudentsFromImportBuffer, STUDENT_IMPORT_ACCEPT, type ParsedStudentRow } from '@/lib/excelStudentImport';

const createSchema = z
  .object({
    email: z.string().trim().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string().min(1, 'Confirm the password'),
    full_name: z.string().trim().min(1, 'Full name is required'),
    student_id: z.string().trim().optional(),
    year_level: z.string().trim().optional(),
    course: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords must match',
        path: ['confirm_password'],
      });
    }
  });

const editSchema = z
  .object({
    full_name: z.string().trim().min(1, 'Full name is required'),
    student_id: z.string().trim().optional(),
    year_level: z.string().trim().optional(),
    course: z.string().trim().optional(),
    new_password: z.string().optional(),
    confirm_password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const np = (data.new_password ?? '').trim();
    const cp = (data.confirm_password ?? '').trim();
    if (!np && !cp) return;
    if (np.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must be at least 6 characters',
        path: ['new_password'],
      });
    }
    if (np !== cp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords must match',
        path: ['confirm_password'],
      });
    }
  });

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
  student_id: string | null;
  year_level: string | null;
  course: string | null;
  is_archived?: boolean;
}

export default function Students() {
  const navigate = useNavigate();
  const { roles, loading: roleLoading } = useUserRole();
  const allowStudentsPage = useMemo(() => canManageStudents(roles), [roles]);
  const allowArchivedPage = useMemo(() => canManageArchivedRecords(roles), [roles]);
  const allowCreateStudent = useMemo(() => canCreateStudentAccounts(roles), [roles]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [totalActiveCount, setTotalActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveConfirmStudent, setArchiveConfirmStudent] = useState<StudentProfile | null>(null);
  const [bulkArchiveConfirmOpen, setBulkArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<ParsedStudentRow[]>([]);
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkImportSummary, setBulkImportSummary] = useState<{
    created: number;
    failed: number;
    defaultPassword?: string;
    results: Array<{ email: string; ok: boolean; error?: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: '',
      password: '',
      confirm_password: '',
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
      new_password: '',
      confirm_password: '',
    },
  });

  useEffect(() => {
    if (!roleLoading) {
      if (!allowStudentsPage) {
        navigate('/dashboard');
      } else {
        fetchStudents();
      }
    }
  }, [roleLoading, allowStudentsPage, navigate]);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students', {
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      const list = ((json.students || []) as any[]).map((s) => ({
        id: String(s.id),
        full_name: String(s.full_name ?? ''),
        email: (s.email ?? null) as string | null,
        student_id: (s.student_id ?? null) as string | null,
        year_level: (s.year_level ?? null) as string | null,
        course: (s.course ?? null) as string | null,
        is_archived: Boolean(s.is_archived ?? false),
      }));
      setStudents(list);
      setTotalActiveCount(list.length);
      setArchivedCount(Number(json.archivedCount ?? 0));
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error(safeActionErrorMessage(error, 'Could not load the student list. Try refreshing the page.'));
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    createForm.reset({
      email: '',
      password: '',
      confirm_password: '',
      full_name: '',
      student_id: '',
      year_level: '',
      course: '',
    });
    setCreateDialogOpen(true);
  };

  const downloadStudentImportTemplate = () => {
    const headers = ['Full name', 'Student ID', 'Year level', 'Course', 'Email (optional)'];
    const sample = ['Sample Student', '2024-001', '1st Year', 'BSCS', 'student@example.edu'];
    const csv = [headers, sample]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openBulkImportDialog = () => {
    setBulkRows([]);
    setBulkParseError(null);
    setBulkFileName(null);
    setBulkImportSummary(null);
    setBulkDialogOpen(true);
  };

  const onBulkFileSelected = async (file: File | null) => {
    setBulkParseError(null);
    setBulkImportSummary(null);
    if (!file) return;
    setBulkFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseStudentsFromImportBuffer(buf, file.name);
      if (parsed.ok === false) {
        setBulkRows([]);
        setBulkParseError(parsed.message);
        return;
      }
      if (parsed.rows.length > 500) {
        setBulkRows([]);
        setBulkParseError('A maximum of 500 rows can be imported at once. Split your file and try again.');
        return;
      }
      setBulkRows(parsed.rows);
      if (parsed.skippedRows > 0) {
        toast.info(
          `${parsed.skippedRows} row(s) were skipped because they were missing name, ID, year, or course.`
        );
      }
    } catch {
      setBulkRows([]);
      setBulkParseError('Could not read the file.');
    }
  };

  const onBulkImportSubmit = async () => {
    if (bulkRows.length === 0) return;
    setFormLoading(true);
    try {
      const students = bulkRows.map((r) => ({
        email: r.email,
        full_name: r.full_name,
        student_id: r.student_id,
        year_level: r.year_level,
        course: r.course,
      }));
      const res = await fetch('/api/admin/students/bulk-import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      setBulkImportSummary({
        created: Number(json.created ?? 0),
        failed: Number(json.failed ?? 0),
        defaultPassword: typeof json.defaultPassword === 'string' ? json.defaultPassword : 'password',
        results: Array.isArray(json.results) ? json.results : [],
      });
      const msg =
        typeof json.message === 'string'
          ? json.message
          : `${json.created ?? 0} created, ${json.failed ?? 0} failed`;
      if ((json.failed ?? 0) === 0) {
        toast.success(msg);
      } else {
        toast.warning(msg);
      }
      fetchStudents();
    } catch (err: unknown) {
      toast.error(safeActionErrorMessage(err, 'Bulk import failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const openEditDialog = (student: StudentProfile) => {
    setEditingStudent(student);
    editForm.reset({
      full_name: student.full_name || '',
      student_id: student.student_id || '',
      year_level: student.year_level || '',
      course: student.course || '',
      new_password: '',
      confirm_password: '',
    });
    setEditDialogOpen(true);
  };

  const onCreateSubmit = async (data: CreateFormData) => {
    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: 'student',
          student_id: data.student_id || undefined,
          year_level: data.year_level || undefined,
          course: data.course || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));

      toast.success('Student account created. They can now sign in.');
      setCreateDialogOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error creating student:', err);
      toast.error(safeActionErrorMessage(err, 'Failed to create student'));
    } finally {
      setFormLoading(false);
    }
  };

  const onEditSubmit = async (data: EditFormData) => {
    if (!editingStudent) return;
    setFormLoading(true);
    try {
      const np = (data.new_password ?? '').trim();
      const body: Record<string, unknown> = {
        full_name: data.full_name,
        student_id: data.student_id || null,
        year_level: data.year_level || null,
        course: data.course || null,
      };
      if (np) body.new_password = np;
      const res = await fetch(`/api/students/${editingStudent.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      toast.success(np ? 'Student updated and password changed' : 'Student updated successfully');
      setEditDialogOpen(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error updating student:', err);
      toast.error(safeActionErrorMessage(err, 'Failed to update student'));
    } finally {
      setFormLoading(false);
    }
  };

  const performArchive = async (ids: string[]) => {
    setArchiving(true);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/students/${id}/archive`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archive: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(formatApiErrorBody(json, 'Could not archive this student.'));
      }
      toast.success(ids.length === 1 ? 'Student archived' : `${ids.length} student(s) archived`);
      setSelectedIds(new Set());
      setArchiveConfirmStudent(null);
      setBulkArchiveConfirmOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error archiving:', err);
      toast.error(safeActionErrorMessage(err, 'Could not archive this student.'));
    } finally {
      setArchiving(false);
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
            <p className="text-muted-foreground mt-1">
              Create accounts one by one (you set passwords), or bulk-import from CSV or Excel (initial password{' '}
              <span className="font-mono">password</span> for every new account).
            </p>
          </div>
          {allowCreateStudent ? (
            <div className="flex flex-wrap gap-2 justify-end shrink-0">
              {allowArchivedPage ? (
                <Button variant="outline" asChild className="rounded-xl shadow-sm">
                  <Link to="/dashboard/archived">View archived</Link>
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={openBulkImportDialog} className="rounded-xl shadow-sm">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import from file
              </Button>
              <Button onClick={openCreateDialog} className="rounded-xl shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Student Account
              </Button>
            </div>
          ) : null}
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
              {PROGRAM_COURSES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
              {uniqueDepartments.filter((d) => !(PROGRAM_COURSES as readonly string[]).includes(d)).map((d) => (
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
              {YEAR_LEVEL_OPTIONS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
              {uniqueYearLevels
                .filter((yl) => !(YEAR_LEVEL_OPTIONS as readonly string[]).includes(yl))
                .map((yl) => (
                <SelectItem key={yl} value={yl}>{yl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table / List */}
        <Card className="border border-border/50 rounded-xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Student Accounts ({filtered.length})
                </CardTitle>
                <CardDescription>
                  Superadmin or faculty admin can add students individually or via CSV/Excel. Archiving requires confirmation;
                  restore archived records from the Archived page.
                </CardDescription>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setBulkArchiveConfirmOpen(true)}
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    Archive
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border/70 rounded-xl bg-muted/20">
                <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-base font-semibold">No students yet</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {searchQuery || departmentFilter !== 'all' || yearLevelFilter !== 'all'
                    ? 'Try adjusting your filters'
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
                        onClick={() => setArchiveConfirmStudent(student)}
                      >
                        <Archive className="h-4 w-4" />
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
              Enter every field for this student, including a sign-in password and confirmation. Students cannot
              self-register.
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
                      <PasswordInput autoComplete="new-password" placeholder="••••••••" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password *</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" placeholder="Repeat password" {...field} className="rounded-xl" />
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
                        {YEAR_LEVEL_OPTIONS.map((y) => (
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
                        {PROGRAM_COURSES.map((c) => (
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
              Update student information. Email cannot be changed here. Optionally set a new sign-in password.
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
                        {YEAR_LEVEL_OPTIONS.map((y) => (
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
                        {PROGRAM_COURSES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        placeholder="Leave blank to keep current password"
                        {...field}
                        className="rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        placeholder="Repeat new password"
                        {...field}
                        className="rounded-xl"
                      />
                    </FormControl>
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

      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(open) => {
          setBulkDialogOpen(open);
          if (!open) {
            setBulkRows([]);
            setBulkParseError(null);
            setBulkFileName(null);
            setBulkImportSummary(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import students from file</DialogTitle>
            <DialogDescription>
              Use a CSV or Excel file (.csv, .xlsx, .xls). Row 1 must include headers for{' '}
              <strong>Name</strong>, <strong>Student ID</strong>, <strong>Year</strong>, and <strong>Course</strong> —
              column order does not matter and extra columns are fine. Email is optional (generated from student ID when
              missing). A random initial password is shown after each import. Maximum 500 data rows per file.
            </DialogDescription>
          </DialogHeader>
          <input
            ref={fileInputRef}
            type="file"
            accept={STUDENT_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onBulkFileSelected(f);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={downloadStudentImportTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download template
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Choose CSV or Excel file
            </Button>
          </div>
          {bulkFileName ? (
            <p className="text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{bulkFileName}</span>
            </p>
          ) : null}
          {bulkParseError ? (
            <p className="text-sm text-destructive font-medium">{bulkParseError}</p>
          ) : null}
          {bulkRows.length > 0 && !bulkParseError ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Preview: <span className="tabular-nums">{bulkRows.length}</span> student(s) ready to import
              </p>
              <div className="max-h-[200px] overflow-auto rounded-xl border border-border/80">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-semibold">#</th>
                      <th className="text-left p-2 font-semibold">Email</th>
                      <th className="text-left p-2 font-semibold">Name</th>
                      <th className="text-left p-2 font-semibold hidden sm:table-cell">ID</th>
                      <th className="text-left p-2 font-semibold hidden sm:table-cell">Course</th>
                      <th className="text-left p-2 font-semibold hidden md:table-cell">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 50).map((r, i) => (
                      <tr key={`${r.email}-${r.rowNumber}`} className="border-t border-border/60">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 break-all">{r.email}</td>
                        <td className="p-2">{r.full_name}</td>
                        <td className="p-2 hidden sm:table-cell">{r.student_id}</td>
                        <td className="p-2 hidden sm:table-cell">{r.course}</td>
                        <td className="p-2 hidden md:table-cell">{r.year_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {bulkRows.length > 50 ? (
                <p className="text-xs text-muted-foreground">Showing first 50 rows; all {bulkRows.length} will be imported.</p>
              ) : null}
            </div>
          ) : null}
          {bulkImportSummary ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
              <p className="text-sm font-semibold">
                Import finished:{' '}
                <span className="text-emerald-600">{bulkImportSummary.created} created</span>
                {bulkImportSummary.failed > 0 ? (
                  <>
                    {', '}
                    <span className="text-destructive">{bulkImportSummary.failed} failed</span>
                  </>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                Initial password used:{' '}
                <span className="font-mono font-medium text-foreground">{bulkImportSummary.defaultPassword}</span>
              </p>
              {bulkImportSummary.results.some((row) => !row.ok) ? (
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {bulkImportSummary.results
                    .filter((row) => !row.ok)
                    .map((row) => (
                      <li key={row.email}>
                        <span className="font-mono">{row.email}</span>
                        {' — '}
                        <span className="text-destructive">
                          {sanitizeUserFacingText(row.error ?? '', 'Could not add this student.')}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setBulkDialogOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={bulkRows.length === 0 || !!bulkParseError || formLoading || !!bulkImportSummary}
              onClick={() => void onBulkImportSubmit()}
            >
              {formLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                <>Import {bulkRows.length > 0 ? `${bulkRows.length} students` : 'students'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveConfirmStudent} onOpenChange={(open) => !open && setArchiveConfirmStudent(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this student?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveConfirmStudent?.full_name || archiveConfirmStudent?.email}</strong> will be hidden from
              the active list and cannot sign in until restored from the Archived page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={() => archiveConfirmStudent && void performArchive([archiveConfirmStudent.id])}
            >
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkArchiveConfirmOpen} onOpenChange={setBulkArchiveConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.size} student(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected students will be hidden from the active list and cannot sign in until restored from the Archived
              page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={() => void performArchive(Array.from(selectedIds))}
            >
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
