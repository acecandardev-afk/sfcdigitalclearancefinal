import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

export type AppRole =
  | 'student'
  | 'employee'
  | 'signatory'
  | 'superadmin'
  | 'faculty_admin'
  | 'hr_admin';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const rolesFromUser = ((user as { roles?: string[] } | null)?.roles ?? []) as string[];
  const rolesKey = rolesFromUser.join('|');

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    const list = rolesFromUser;
    setRoles((prev) => {
      if (prev.length === list.length && prev.every((r, i) => r === list[i])) return prev;
      return list;
    });
    setLoading(false);
  }, [authLoading, userId, rolesKey, rolesFromUser]);

  const hasRole = useCallback((role: string) => roles.includes(role), [roles]);
  const isStudent = useCallback(() => roles.includes('student'), [roles]);
  const isEmployee = useCallback(() => roles.includes('employee'), [roles]);
  const isSignatory = useCallback(() => roles.includes('signatory'), [roles]);
  const isSuperAdmin = useCallback(() => roles.includes('superadmin'), [roles]);
  const isFacultyAdmin = useCallback(() => roles.includes('faculty_admin'), [roles]);
  const isHrAdmin = useCallback(() => roles.includes('hr_admin'), [roles]);

  return {
    roles,
    loading,
    hasRole,
    isStudent,
    isEmployee,
    isSignatory,
    isSuperAdmin,
    isFacultyAdmin,
    isHrAdmin,
  };
}
