import { useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { GraduationCap, Building2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { useClearanceType } from '@/lib/clearanceTypeContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Choose the active platform: student clearance vs institutional. Employees and admins only; students
 * without staff roles skip this screen — they belong on the student dashboard.
 */
export default function ClearanceSelect() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, isSignatory, isStudent, isEmployee, isFacultyAdmin, isHrAdmin, loading: roleLoading } = useUserRole();
  const { setClearanceModule, isHydrated } = useClearanceType();
  const loading = authLoading || roleLoading;
  const isStaff =
    isSuperAdmin() || isSignatory() || isEmployee() || isFacultyAdmin() || isHrAdmin();
  const isStudentOnly = isStudent() && !isStaff;

  useEffect(() => {
    if (loading || !isHydrated) return;
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [loading, isHydrated, user, navigate]);

  if (loading || !isHydrated || !user) {
    return null;
  }

  if (isStudentOnly) {
    return <Navigate to="/dashboard" replace />;
  }

  const goStudent = () => {
    setClearanceModule('student');
    navigate('/dashboard', { replace: true });
  };

  const goInst = () => {
    setClearanceModule('institutional');
    navigate('/dashboard/institutional', { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="w-full min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="w-full min-w-0 space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Select platform
            </h1>
            <p className="mt-2 text-muted-foreground text-sm sm:text-base">
              If you have both access types, you can change this here or from the sidebar. Student
              users only use the student system; employee institutional clearance is separate.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <button
              type="button"
              onClick={goStudent}
              className={cn(
                'text-left transition-all rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'hover:scale-[1.01]'
              )}
            >
              <Card className="h-full border-2 border-border hover:border-primary/50 shadow-sm">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <CardTitle>Student clearance</CardTitle>
                  <CardDescription>
                    {isStaff
                      ? 'Open the student system: your dashboard, to-sign queues, and admin tools (by role).'
                      : 'Your own clearance: requests, status, and student-facing pages.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center text-sm font-medium text-primary">
                    Continue <ArrowRight className="ml-1 h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={goInst}
              className={cn(
                'text-left transition-all rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'hover:scale-[1.01]'
              )}
            >
              <Card className="h-full border-2 border-border hover:border-primary/50 shadow-sm">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <CardTitle>Institutional clearance</CardTitle>
                  <CardDescription>
                    Institutional / employee-style clearance: department sign-offs, remarks,
                    and certification (subject to your role for approvals).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center text-sm font-medium text-primary">
                    Continue <ArrowRight className="ml-1 h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </button>
          </div>
          <div className="flex justify-center">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Go back
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
