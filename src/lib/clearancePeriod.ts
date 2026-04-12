import {
  differenceInCalendarDays,
  endOfDay,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
} from 'date-fns';

export type ClearancePeriod = { start: Date; end: Date };

/** Parse `system_settings.clearance` value_json (period_start / period_end as YYYY-MM-DD). */
export function parseClearancePeriodFromSettings(valueJson: unknown): ClearancePeriod | null {
  if (!valueJson || typeof valueJson !== 'object') return null;
  const o = valueJson as Record<string, unknown>;
  const ps = o.period_start;
  const pe = o.period_end;
  if (ps == null || pe == null) return null;
  if (typeof ps !== 'string' || typeof pe !== 'string') return null;
  const startRaw = parseISO(ps.length === 10 ? `${ps}T12:00:00` : ps);
  const endRaw = parseISO(pe.length === 10 ? `${pe}T12:00:00` : pe);
  if (!isValid(startRaw) || !isValid(endRaw)) return null;
  const start = startOfDay(startRaw);
  const end = endOfDay(endRaw);
  if (isAfter(start, end)) return null;
  return { start, end };
}

export type ClearancePeriodMeta =
  | { configured: false }
  | {
      configured: true;
      daysUntilStart: number;
      daysUntilEnd: number;
      isActive: boolean;
      isUpcoming: boolean;
      isPast: boolean;
      isExpiring: boolean;
    };

export function clearancePeriodMeta(period: ClearancePeriod | null, today = new Date()): ClearancePeriodMeta {
  if (!period) {
    return { configured: false };
  }
  const day = startOfDay(today);
  const { start, end } = period;
  const isUpcoming = isBefore(day, start);
  const isPast = isAfter(day, end);
  const isActive = !isUpcoming && !isPast;
  const daysUntilStart = isUpcoming ? Math.max(0, differenceInCalendarDays(start, day)) : 0;
  const daysUntilEnd = isActive ? Math.max(0, differenceInCalendarDays(end, day)) : 0;
  const isExpiring = isActive && daysUntilEnd <= 7;
  return {
    configured: true,
    daysUntilStart,
    daysUntilEnd,
    isActive,
    isUpcoming,
    isPast,
    isExpiring,
  };
}
