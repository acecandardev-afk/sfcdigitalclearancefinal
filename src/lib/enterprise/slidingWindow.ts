/**
 * Pure sliding-window counter for rate limiting (testable without timers).
 */
export function pruneWindow(timestamps: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export function slidingWindowHit(
  timestamps: number[],
  now: number,
  limit: number,
  windowMs: number,
): { allowed: boolean; next: number[] } {
  const kept = pruneWindow(timestamps, now, windowMs);
  if (kept.length >= limit) {
    return { allowed: false, next: kept };
  }
  return { allowed: true, next: [...kept, now] };
}
