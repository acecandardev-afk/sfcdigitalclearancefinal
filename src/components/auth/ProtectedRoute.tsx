import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserRole, type AppRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If set, user must have at least one of these roles */
  roles?: AppRole[];
}

/**
 * Requires authentication. Optionally restricts to specific roles.
 */
export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles: userRoles, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (authLoading || (user && roles?.length && roleLoading)) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (roles?.length) {
    const allowed = roles.some((r) => userRoles.includes(r));
    if (!allowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
