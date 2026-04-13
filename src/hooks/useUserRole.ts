import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

export type AppRole = 'student' | 'signatory' | 'superadmin';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    const list = ((user as any)?.roles ?? []) as AppRole[];
    setRoles((prev) => {
      if (prev.length === list.length && prev.every((r, i) => r === list[i])) return prev;
      return list;
    });
    setLoading(false);
  }, [authLoading, user]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const isStudent = useCallback(() => roles.includes('student'), [roles]);
  const isSignatory = useCallback(() => roles.includes('signatory'), [roles]);
  const isSuperAdmin = useCallback(() => roles.includes('superadmin'), [roles]);

  return { roles, loading, hasRole, isStudent, isSignatory, isSuperAdmin };
}
