/**
 * Maps errors to short, safe messages for toasts (no internal details).
 */
export function safeActionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const m = err.message;
    if (m && m !== 'Submission failed' && m !== 'load failed' && m !== 'failed') {
      return m;
    }
    const lower = m.toLowerCase();
    if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('load failed')) {
      return 'Network error. Check your connection and try again.';
    }
  }
  return fallback;
}
