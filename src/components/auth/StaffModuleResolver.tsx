import { ReactNode, useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { useClearanceType } from '@/lib/clearanceTypeContext';
import {
  isStudentClearanceAdminCrossModulePath,
  isSignatoryStudentClearanceCrossModulePath,
  canUseInstitutionalAppRoles,
} from '@/lib/permissionsMatrix';

/**
 * Routes users to the module chooser when needed, and keeps student vs institutional paths aligned.
 */
export default function StaffModuleResolver({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { roles, isSuperAdmin, isSignatory, isEmployee, isFacultyAdmin, isHrAdmin, loading: roleLoading } =
    useUserRole();
  const { isHydrated, clearanceModule, needsModuleSelection, setClearanceModule } = useClearanceType();
  const location = useLocation();
  const navigate = useNavigate();
  const loading = authLoading || roleLoading;

  const isStaff = isSuperAdmin() || isSignatory() || isEmployee() || isFacultyAdmin() || isHrAdmin();

  useLayoutEffect(() => {
    if (loading || !isHydrated || !userId) return;
    if (!isStaff) return;
    const path = location.pathname;
    if (path === '/dashboard/clearance-select') return;
    if (!path.startsWith('/dashboard')) return;
    if (path.startsWith('/dashboard/institutional') && clearanceModule === 'institutional') return;
    if (path.startsWith('/dashboard/notifications')) return;
    if (needsModuleSelection) {
      // Auto-resolve module from route so print/report pages open directly
      if (path.startsWith('/dashboard/institutional')) {
        setClearanceModule('institutional');
        return;
      }
      if (path.startsWith('/dashboard/clearances')) {
        setClearanceModule('student');
        return;
      }
      if (isStudentClearanceAdminCrossModulePath(path, roles)) {
        setClearanceModule(canUseInstitutionalAppRoles(roles) ? 'institutional' : 'student');
        return;
      }
      const pending = sessionStorage.getItem('clearance_type');
      if (pending === 'student' || pending === 'institutional') {
        return;
      }
      if (path !== '/dashboard/clearance-select') {
        navigate('/dashboard/clearance-select', { replace: true });
      }
    }
  }, [
    loading,
    isHydrated,
    userId,
    isStaff,
    needsModuleSelection,
    location.pathname,
    navigate,
    clearanceModule,
    setClearanceModule,
    roles,
  ]);

  /** In institutional mode, only institutional (or account / chooser) routes are allowed */
  useEffect(() => {
    if (loading || !isHydrated || !userId) return;
    if (location.pathname === '/dashboard/clearance-select') return;
    if (clearanceModule !== 'institutional') return;
    const path = location.pathname;
    if (!path.startsWith('/dashboard')) return;
    const allowed =
      path.startsWith('/dashboard/institutional') ||
      path === '/dashboard/clearance-select' ||
      path === '/dashboard/account' ||
      path.startsWith('/dashboard/notifications') ||
      isStudentClearanceAdminCrossModulePath(path, roles) ||
      isSignatoryStudentClearanceCrossModulePath(path, roles);
    if (!allowed) {
      const target =
        isSignatory() || isSuperAdmin() || isHrAdmin()
          ? '/dashboard/institutional/signatory'
          : '/dashboard/institutional';
      if (path !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [
    loading,
    isHydrated,
    userId,
    clearanceModule,
    location.pathname,
    navigate,
    isSignatory,
    isSuperAdmin,
    isHrAdmin,
    roles,
  ]);

  /** In student mode, institutional URLs are not allowed */
  useEffect(() => {
    if (loading || !isHydrated || !userId) return;
    if (clearanceModule !== 'student') return;
    if (location.pathname.startsWith('/dashboard/institutional')) {
      navigate('/dashboard/clearance-select', { replace: true });
    }
  }, [loading, isHydrated, userId, clearanceModule, location.pathname, navigate]);

  if (userId && !isHydrated) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

export function useSwitchClearanceType() {
  const { clearModule } = useClearanceType();
  const navigate = useNavigate();
  return () => {
    clearModule();
    navigate('/dashboard/clearance-select', { replace: true });
  };
}
