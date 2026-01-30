import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import StudentDashboard from '@/components/dashboard/StudentDashboard';
import SignatoryDashboard from '@/components/dashboard/SignatoryDashboard';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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
