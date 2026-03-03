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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, GraduationCap, Search } from 'lucide-react';
import { toast } from 'sonner';

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
  student_id: string | null;
  year_level: string | null;
  course: string | null;
}

const studentSchema = z.object({
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().trim().min(1, 'Full name is required'),
  student_id: z.string().trim().optional(),
  year_level: z.string().trim().optional(),
  course: z.string().trim().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      email: '',
      password: '',
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
  }, [roleLoading, isSuperAdmin, navigate]);

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

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, student_id, year_level, course')
        .in('id', userIds)
        .order('full_name');

      if (profileError) throw profileError;
      setStudents((profiles as StudentProfile[]) || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = () => {
    form.reset({
      email: '',
      password: '',
      full_name: '',
      student_id: '',
      year_level: '',
      course: '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: StudentFormData) => {
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
      setDialogOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      console.error('Error creating student:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setFormLoading(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Students</h1>
            <p className="text-muted-foreground">Create and manage student accounts. Students cannot self-register.</p>
          </div>
          <Button variant="hero" onClick={openDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Student Account
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or student ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Student accounts ({filtered.length})
            </CardTitle>
            <CardDescription>
              Only the administrator can create student accounts. Students sign in with the credentials you provide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No students yet</h3>
                <p className="text-muted-foreground mt-2">
                  {searchQuery ? 'Try a different search' : 'Create a student account to get started'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.email || '—'}</p>
                        {(student.student_id || student.course) && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {[student.student_id, student.year_level, student.course].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Create student account</DialogTitle>
            <DialogDescription>
              The student will use the email and password you set to sign in. They cannot register on their own.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Dela Cruz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="student@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="student_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl>
                      <Input placeholder="23-0456-A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year level</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
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
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course / Department</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading}>
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
    </DashboardLayout>
  );
}
