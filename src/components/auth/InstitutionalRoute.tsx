import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useClearanceType } from '@/lib/clearanceTypeContext';

/**
 * Ensures the session is set to the institutional platform (separate page group).
 *
 * While `StaffModuleResolver` persists `institutional` from the URL, `clearanceModule` can
 * briefly stay `null`. Rendering `<Navigate>` in that window fights the resolver and can
 * trigger a navigation/state loop (React “maximum update depth”, Next action-queue).
 */
export default function InstitutionalRoute({ children }: { children: ReactNode }) {
  const { clearanceModule, isHydrated, needsModuleSelection } = useClearanceType();
  const { pathname } = useLocation();
  const onInstitutionalPath = pathname.startsWith('/dashboard/institutional');
  const pendingUrlSync = isHydrated && needsModuleSelection && onInstitutionalPath;

  if (!isHydrated) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (clearanceModule === 'institutional' || pendingUrlSync) {
    return <>{children}</>;
  }

  return <Navigate to="/dashboard/clearance-select" replace />;
}
