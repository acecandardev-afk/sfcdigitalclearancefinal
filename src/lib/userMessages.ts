/**
 * User-facing copy only — never forward raw server/Prisma/NextAuth strings to toasts.
 */

const GENERIC = 'Something went wrong. Please try again.';
const NETWORK = 'Network error. Check your connection and try again.';

/** Turn API JSON error payloads into a single line for toasts (validation, Prisma, custom). */
export function formatApiErrorBody(json: unknown): string {
  if (!json || typeof json !== 'object') return 'Request failed.';
  const o = json as Record<string, unknown>;

  const fromZodFlatten = (flat: unknown): string | null => {
    if (!flat || typeof flat !== 'object') return null;
    const f = flat as { fieldErrors?: Record<string, string[] | unknown>; formErrors?: string[] };
    const parts: string[] = [];
    if (Array.isArray(f.formErrors) && f.formErrors.length) parts.push(...f.formErrors);
    if (f.fieldErrors && typeof f.fieldErrors === 'object') {
      for (const [key, val] of Object.entries(f.fieldErrors)) {
        if (Array.isArray(val)) parts.push(`${key}: ${val.join(', ')}`);
      }
    }
    return parts.length ? parts.join(' ') : null;
  };

  if (typeof o.error === 'string') {
    const bits: string[] = [o.error];
    if (typeof o.detail === 'string') bits.push(o.detail);
    const issues = fromZodFlatten(o.issues);
    if (issues) bits.push(issues);
    return bits.join(' — ');
  }

  if (o.error && typeof o.error === 'object') {
    const z = fromZodFlatten(o.error);
    if (z) return z;
  }

  if (typeof o.detail === 'string') return o.detail;
  return 'Request failed.';
}

/** Map NextAuth `signIn` error codes/strings to safe messages. */
export function friendlySignInError(error: string | undefined): string {
  if (!error) return 'Unable to sign in. Please try again.';
  const e = error.toLowerCase().replace(/_/g, '');
  if (e.includes('credential') || e.includes('signin')) {
    return 'Invalid email or password.';
  }
  if (e.includes('configuration') || e.includes('secret')) {
    return 'Sign-in is temporarily unavailable. Please try again later.';
  }
  if (e.includes('accessdenied')) {
    return 'You do not have access. Contact your administrator.';
  }
  if (e.includes('session')) {
    return 'Your session expired. Please sign in again.';
  }
  return 'Unable to sign in. Please check your email and password.';
}

/** Parse JSON `{ error: ... }` from a failed fetch and return a safe message (never raw objects). */
export async function friendlyApiErrorMessage(res: Response, fallback = GENERIC): Promise<string> {
  const status = res.status;
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'We could not find that.';
  if (status >= 500) return 'The server had a problem. Please try again later.';
  if (status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) return NETWORK;

  try {
    const data = await res.clone().json();
    if (typeof data?.error === 'string' && data.error.length < 200) {
      const msg = data.error.toLowerCase();
      if (
        msg.includes('prisma') ||
        msg.includes('database') ||
        msg.includes('sql') ||
        msg.includes('unique constraint') ||
        msg.includes('foreign key') ||
        msg.includes('internal server')
      ) {
        return GENERIC;
      }
      if (
        msg.includes('unauthorized') ||
        msg.includes('forbidden') ||
        msg.includes('invalid') ||
        msg.includes('not found')
      ) {
        return data.error.length < 120 ? data.error : fallback;
      }
      return data.error.length < 120 ? data.error : fallback;
    }
  } catch {
    /* not JSON */
  }
  return fallback;
}

export function friendlyFetchError(err: unknown, fallback = GENERIC): string {
  if (err instanceof TypeError && String(err.message).toLowerCase().includes('fetch')) {
    return NETWORK;
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes('network') || m.includes('failed to fetch')) return NETWORK;
  }
  return fallback;
}
