/**
 * User-facing copy only — never forward raw server/Prisma/NextAuth strings to toasts or inline alerts.
 */

export const USER_MSG_GENERIC = 'Something went wrong. Please try again.';
export const USER_MSG_NETWORK = 'Network problem. Check your connection and try again.';
export const USER_MSG_VALIDATION = 'Please check your entries and try again.';
export const USER_MSG_FORBIDDEN = 'You do not have permission to do that.';
export const USER_MSG_UNAUTHORIZED = 'Please sign in to continue.';
export const USER_MSG_NOT_FOUND = 'We could not find that.';
export const USER_MSG_SERVER = 'The server had a problem. Please try again later.';

/** Exact API / internal phrases mapped to plain language (keys are lowercased). */
const EXACT_ERROR_MAP: Record<string, string> = {
  unauthorized: USER_MSG_UNAUTHORIZED,
  'not found': USER_MSG_NOT_FOUND,
  forbidden: USER_MSG_FORBIDDEN,
  'validation failed': USER_MSG_VALIDATION,
  'superadmin only': USER_MSG_FORBIDDEN,
  'no user id': USER_MSG_GENERIC,
  'missing id': USER_MSG_GENERIC,
  'missing file': 'Please choose a file to upload.',
  'not a student account': 'That account is not a student.',
  'student not found': USER_MSG_NOT_FOUND,
  'user not found': 'We could not find your account.',
  'signatory not found': 'That signatory could not be found. Choose another one or refresh the page.',
  'duplicate id': 'One or more entries are duplicated. Refresh the page and try again.',
  'unknown id': 'One or more entries could not be found. Refresh the page and try again.',
  'must include every office id': 'Include every office in the order and try again.',
  'duplicate ids in list': 'Duplicate entries in the list. Refresh the page and try again.',
  'ids must list each default signatory row exactly once':
    'The signatory order must include every default signatory exactly once. Refresh and try again.',
  'failed to reorder': 'Could not update the order. Try again.',
  'bootstrap_secret not set': USER_MSG_SERVER,
  'bootstrap already completed': 'Initial setup was already completed.',
  'nothing to update': 'Nothing was changed.',
  'already reviewed': 'This request was already reviewed.',
  'not an office requirement': 'That item is not an office requirement.',
  'invalid body': USER_MSG_VALIDATION,
  'invalid type': USER_MSG_VALIDATION,
  'invalid json body': 'The uploaded file could not be read. Check the format and try again.',
  'upload failed': 'Could not upload the file. Try again or use a smaller file.',
  'verify failed': 'Could not verify that requirement.',
  'submission failed': USER_MSG_GENERIC,
  'file upload failed': 'Could not upload the file. Try again or use a smaller file.',
  'failed to load': USER_MSG_GENERIC,
  failed: USER_MSG_GENERIC,
  'load failed': USER_MSG_GENERIC,
  'save failed': USER_MSG_GENERIC,
  'fetch failed': USER_MSG_NETWORK,
};

/** Patterns that indicate stack traces, ORM, or other internals — never show these to users. */
const INTERNAL_MESSAGE =
  /prisma|postgres|mysql|sql\b|constraint|invocation in|p20\d{2}|unique constraint|foreign key|internal server|stack|at\s+\w+\.|node_modules|\/api\/|serialize|deserialize|invalid `|expected\s+\w+,\s+received|typeerror|referenceerror|syntaxerror|econnrefused|enotfound|etimedout|unknown argument|did you mean|webpack|npx prisma|migrate deploy|query engine|operation not permitted|eperm|nextauth|next\.js|superadmin session|fielderrors|formerrors|zodissue|unexpected token|json\.parse|isarchived|isactive|userrole|passwordhash|cuid\(\)|@prisma|batch_|signature not found|must be valid json|bootstrap_secret|no_signatory_row|database error/i;

const PATH_LIKE = /[/\\](?:src|app|dist|node_modules|\.next|prisma)[/\\]/i;
const CODE_LIKE = /`[^`]{2,}`/;
const SNAKE_FIELD = /\b[a-z]+_[a-z_]+\b:\s/i;

/** Map known backend phrases to user-friendly copy before other checks. */
export function normalizeKnownErrorPhrase(input: string): string {
  const t = input.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  const lower = t.toLowerCase();

  const exact = EXACT_ERROR_MAP[lower];
  if (exact) return exact;

  if (lower.startsWith('forbidden:')) {
    if (lower.includes('prepared by')) {
      return 'You do not have permission to edit the "Prepared by" section.';
    }
    if (lower.includes('hrmdo')) {
      return 'You do not have permission to edit HRMDO verification.';
    }
    if (lower.includes('president')) {
      return 'You do not have permission to edit President approval.';
    }
    return USER_MSG_FORBIDDEN;
  }

  if (/requester may only edit prepared by/i.test(t)) {
    return 'You can only edit the "Prepared by" section on your own request.';
  }

  if (/signatories do not request clearances/i.test(t)) {
    return 'Signatories use the signatory queue instead of creating requests here.';
  }

  if (/signatories cannot create clearance/i.test(t)) {
    return 'Signatories cannot create clearance requests.';
  }

  return t;
}

/**
 * Returns a safe string for toasts and inline alerts. Use `fallback` when the text looks technical or empty.
 */
export function sanitizeUserFacingText(input: string, fallback: string, maxLen = 220): string {
  const normalized = normalizeKnownErrorPhrase(input);
  const t = normalized.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 1800) return fallback;
  if (INTERNAL_MESSAGE.test(t)) return fallback;
  if (PATH_LIKE.test(t)) return fallback;
  if (CODE_LIKE.test(t)) return fallback;
  if (SNAKE_FIELD.test(t)) return fallback;
  if (/^failed\b/i.test(t) && t.length < 40) return fallback;
  if (t.length > maxLen) return `${t.slice(0, maxLen - 1)}…`;
  return t;
}

function hasValidationPayload(o: Record<string, unknown>): boolean {
  if (o.issues != null) return true;
  if (typeof o.error === 'string' && /validation failed/i.test(o.error)) return true;
  if (o.error && typeof o.error === 'object') return true;
  return false;
}

/** Turn API JSON error payloads into a single safe line for toasts (never raw validation trees or `detail`). */
export function formatApiErrorBody(json: unknown, fallback = USER_MSG_GENERIC): string {
  if (!json || typeof json !== 'object') return fallback;
  const o = json as Record<string, unknown>;

  if (hasValidationPayload(o)) {
    return USER_MSG_VALIDATION;
  }

  if (typeof o.error === 'string') {
    const mapped = normalizeKnownErrorPhrase(o.error);
    const main = sanitizeUserFacingText(mapped, '', 200);
    if (main) return main;
    return fallback;
  }

  if (typeof o.message === 'string') {
    const mapped = normalizeKnownErrorPhrase(o.message);
    const main = sanitizeUserFacingText(mapped, '', 200);
    if (main) return main;
  }

  if (o.error && typeof o.error === 'object') {
    return USER_MSG_VALIDATION;
  }

  return fallback;
}

/** Preferred helper when reading `{ error }` from an API JSON body. */
export function userErrorFromApi(json: unknown, fallback = USER_MSG_GENERIC): string {
  return formatApiErrorBody(json, fallback);
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
  return sanitizeUserFacingText(error, 'Unable to sign in. Please check your email and password.');
}

/** Parse JSON `{ error: ... }` from a failed fetch and return a safe message (never raw objects). */
export async function friendlyApiErrorMessage(res: Response, fallback = USER_MSG_GENERIC): Promise<string> {
  const status = res.status;
  if (status === 401) return USER_MSG_UNAUTHORIZED;
  if (status === 403) return USER_MSG_FORBIDDEN;
  if (status === 404) return USER_MSG_NOT_FOUND;
  if (status >= 500) return USER_MSG_SERVER;
  if (status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) return USER_MSG_NETWORK;

  try {
    const text = await res.clone().text();
    if (!text.trim()) return fallback;
    const data = JSON.parse(text) as unknown;
    return userErrorFromApi(data, fallback);
  } catch {
    /* not JSON */
  }
  return fallback;
}

export function friendlyFetchError(err: unknown, fallback = USER_MSG_GENERIC): string {
  if (err instanceof TypeError && String(err.message).toLowerCase().includes('fetch')) {
    return USER_MSG_NETWORK;
  }
  if (err instanceof SyntaxError) {
    return fallback;
  }
  if (err instanceof Error) {
    const msg = err.message.trim();
    const m = msg.toLowerCase();
    if (m.includes('network') || m.includes('failed to fetch')) return USER_MSG_NETWORK;
    if (m.includes('unexpected end of json') || m.includes('json input')) return fallback;
    return sanitizeUserFacingText(msg, fallback, 220);
  }
  return fallback;
}
