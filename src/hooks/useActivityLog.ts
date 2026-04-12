import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'signup'
  | 'create_clearance'
  | 'update_clearance'
  | 'sign_clearance'
  | 'reject_clearance'
  | 'upload_file'
  | 'create_signatory'
  | 'update_signatory'
  | 'delete_signatory'
  | 'update_user_roles'
  | 'view_dashboard'
  | 'view_clearance';

/** Common keys in `details` for clearance timelines: clearance_request_id, signatory_id, step, bulk */

interface LogActivityParams {
  action: ActivityAction;
  details?: Json;
}

export async function logActivity({ action, details = {} as Json }: LogActivityParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log activity: No authenticated user');
      return;
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert([{
        user_id: user.id,
        action,
        details,
        user_agent: navigator.userAgent,
      }]);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

export function useActivityLog() {
  return { logActivity };
}
