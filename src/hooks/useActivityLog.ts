type Json = unknown;

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
    await fetch('/api/activity/log', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details }),
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

export function useActivityLog() {
  return { logActivity };
}
