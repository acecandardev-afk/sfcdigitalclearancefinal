import type { Prisma } from '@prisma/client';

export type WeeklyHours = {
  timezone?: string;
  windows: { dow: number; start: string; end: string }[];
};

function parseWeeklyHours(raw: Prisma.JsonValue | null | undefined): WeeklyHours | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const windows = o.windows;
  if (!Array.isArray(windows)) return null;
  const out: WeeklyHours['windows'] = [];
  for (const w of windows) {
    if (typeof w !== 'object' || w === null) continue;
    const r = w as Record<string, unknown>;
    const dow = typeof r.dow === 'number' ? r.dow : Number(r.dow);
    const start = typeof r.start === 'string' ? r.start : '';
    const end = typeof r.end === 'string' ? r.end : '';
    if (!Number.isFinite(dow) || dow < 0 || dow > 6 || !start || !end) continue;
    out.push({ dow, start, end });
  }
  if (!out.length) return null;
  return { timezone: typeof o.timezone === 'string' ? o.timezone : undefined, windows: out };
}

/** Parse "HH:mm" to minutes from midnight. */
function toMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * If `weeklyHoursJson` is configured, returns whether `at` falls inside any window for that weekday (local time).
 * If not configured, returns true (no enforcement).
 */
export function isSignatoryOpenNow(
  weeklyHoursJson: Prisma.JsonValue | null | undefined,
  at = new Date()
): boolean {
  const cfg = parseWeeklyHours(weeklyHoursJson);
  if (!cfg || !cfg.windows.length) return true;
  const dow = at.getDay();
  const nowMin = at.getHours() * 60 + at.getMinutes();
  for (const w of cfg.windows) {
    if (w.dow !== dow) continue;
    const s = toMinutes(w.start);
    const e = toMinutes(w.end);
    if (s == null || e == null) continue;
    if (s <= e) {
      if (nowMin >= s && nowMin <= e) return true;
    } else {
      if (nowMin >= s || nowMin <= e) return true;
    }
  }
  return false;
}

export function formatWeeklyHoursSummary(weeklyHoursJson: Prisma.JsonValue | null | undefined): string {
  const cfg = parseWeeklyHours(weeklyHoursJson);
  if (!cfg?.windows.length) return '—';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return cfg.windows
    .map((w) => `${days[w.dow] ?? w.dow} ${w.start}–${w.end}`)
    .join('; ');
}
