import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { AppRole } from '@/hooks/useUserRole';
import {
  canCreateOwnInstitutionalClearanceRequest,
  canRequestStudentClearance,
} from '@/lib/permissionsMatrix';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If set, user must have at least one of these roles */
  roles?: AppRole[];
  /** If true, only users who may file their own student clearance (excludes admin roles). */
  requireStudentClearanceRequester?: boolean;
  /** If true, only employees (non-admin) who may create their own institutional exit clearance. */
  requireInstitutionalEmployeeRequester?: boolean;
  /** If true, user must have the `signatory` role (used with broad role lists so admins-with-signatory-duty can access). */
  requireSignatoryRole?: boolean;
}

/**
 * Requires authentication. Optionally restricts to specific roles.
 */
export default function ProtectedRoute({
  children,
  roles,
  requireStudentClearanceRequester,
  requireInstitutionalEmployeeRequester,
  requireSignatoryRole,
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const userRoles = ((user as { roles?: string[] })?.roles ?? []) as string[];

  if (requireStudentClearanceRequester && !canRequestStudentClearance(userRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireInstitutionalEmployeeRequester && !canCreateOwnInstitutionalClearanceRequest(userRoles)) {
    const dest =
      userRoles.includes('superadmin') || userRoles.includes('hr_admin')
        ? '/dashboard/institutional/admin'
        : userRoles.includes('signatory')
          ? '/dashboard/institutional/signatory'
          : '/dashboard/institutional';
    return <Navigate to={dest} replace />;
  }

  if (roles?.length) {
    const allowed = roles.some((r) => userRoles.includes(r));
    if (!allowed) {
      const isOnlyStudent =
        userRoles.includes('student') &&
        !userRoles.includes('superadmin') &&
        !userRoles.includes('signatory') &&
        !userRoles.includes('employee') &&
        !userRoles.includes('faculty_admin') &&
        !userRoles.includes('hr_admin');
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requireSignatoryRole && !userRoles.includes('signatory')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
