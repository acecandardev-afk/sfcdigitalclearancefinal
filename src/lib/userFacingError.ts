import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Maps database errors to short, safe messages (no RLS/SQL details in the UI).
 */
export function postgrestErrorMessage(error: PostgrestError | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.';
  const code = error.code ?? '';
  const msg = (error.message || '').toLowerCase();

  if (code === 'PGRST116' || msg.includes('0 rows') || msg.includes('multiple (or no) rows returned')) {
    return 'We could not find that record.';
  }
  if (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security')
  ) {
    return 'You do not have permission to do that.';
  }
  if (code === '23505') return 'This record already exists.';
  if (code === '23503') return 'This action is not allowed because related data is missing.';
  if (msg.includes('jwt') || msg.includes('session')) return 'Your session expired. Please sign in again.';
  return 'Something went wrong. Please try again.';
}

export function safeActionErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return postgrestErrorMessage(err as PostgrestError);
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes('network') || m.includes('failed to fetch') || m.includes('load failed')) {
      return 'Network error. Check your connection and try again.';
    }
  }
  return fallback;
}
