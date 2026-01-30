import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import SignatoryDashboard from '@/components/dashboard/SignatoryDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { roles, loading: rolesLoading, isSuperAdmin, isSignatory, isStudent } = useUserRole();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || rolesLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  // User with no roles (e.g. removed signatory/faculty) has no access
  if (roles.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <h2 className="text-xl font-semibold text-foreground">No access</h2>
          <p className="text-muted-foreground mt-2">
            Your account no longer has access to this system. Please contact an administrator.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={async () => {
              await signOut();
              navigate('/auth');
            }}
          >
            Sign out
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Render dashboard based on role priority: superadmin > signatory > student
  const renderDashboard = () => {
    if (isSuperAdmin()) {
      return <SuperAdminDashboard />;
    }
    if (isSignatory()) {
      return <SignatoryDashboard />;
    }
    return <StudentDashboard />;
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
