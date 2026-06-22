import { sanitizeUserFacingText, USER_MSG_NETWORK } from '@/lib/userMessages';

const LOW_SIGNAL = /^(load failed|failed|submission failed|request failed|fetch failed)$/i;

/**
 * Maps errors to short, safe messages for toasts (no stack traces, ORM text, or file paths).
 */
export function safeActionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const m = err.message.trim();
    if (!m) return fallback;
    const lower = m.toLowerCase();
    if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('load failed')) {
      return USER_MSG_NETWORK;
    }
    if (LOW_SIGNAL.test(m)) return fallback;
    return sanitizeUserFacingText(m, fallback);
  }
  return fallback;
}
