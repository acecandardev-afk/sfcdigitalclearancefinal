import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

type Persona = 'employee' | 'signatory';

interface InstitutionalPersonaRouteProps {
  persona: Persona;
  children: ReactNode;
}

/**
 * Enforces strict separation between employee and signatory spaces.
 * Superadmins are allowed to access both.
 */
export default function InstitutionalPersonaRoute({ persona, children }: InstitutionalPersonaRouteProps) {
  const { loading, isEmployee, isSignatory, isSuperAdmin, isHrAdmin } = useUserRole();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSuperAdmin()) return <>{children}</>;

  if (persona === 'employee') {
    if ((isEmployee() && !isSignatory()) || isHrAdmin()) return <>{children}</>;
    return <Navigate to="/dashboard/institutional/signatory" replace />;
  }

  if (isSignatory() || isHrAdmin()) return <>{children}</>;
  return <Navigate to="/dashboard/institutional" replace />;
}

