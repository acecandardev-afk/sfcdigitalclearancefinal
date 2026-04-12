import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type AppRole = 'student' | 'signatory' | 'superadmin';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching roles:', error);
        setRoles([]);
      } else {
        setRoles(data.map(r => r.role as AppRole));
      }
      setLoading(false);
    }

    fetchRoles();
  }, [user]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const isStudent = useCallback(() => roles.includes('student'), [roles]);
  const isSignatory = useCallback(() => roles.includes('signatory'), [roles]);
  const isSuperAdmin = useCallback(() => roles.includes('superadmin'), [roles]);

  return { roles, loading, hasRole, isStudent, isSignatory, isSuperAdmin };
}
