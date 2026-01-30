import { useEffect, useState } from 'react';
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

  const hasRole = (role: AppRole) => roles.includes(role);
  const isStudent = () => hasRole('student');
  const isSignatory = () => hasRole('signatory');
  const isSuperAdmin = () => hasRole('superadmin');

  return { roles, loading, hasRole, isStudent, isSignatory, isSuperAdmin };
}
