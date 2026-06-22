import { describe, expect, it } from 'vitest';
import { effectiveClearanceEnd } from '@/lib/effectiveClearanceDeadline';
import type { ClearancePeriod } from '@/lib/clearancePeriod';

const period: ClearancePeriod = {
  start: new Date('2026-01-01T12:00:00'),
  end: new Date('2026-01-31T12:00:00'),
};

describe('effectiveClearanceEnd', () => {
  it('allows when no period is configured', () => {
    expect(effectiveClearanceEnd(null, [], new Date('2026-06-01'))).toEqual({ allowed: true });
  });

  it('blocks before period start', () => {
    const r = effectiveClearanceEnd(period, [], new Date('2025-12-31'));
    expect(r).toMatchObject({ allowed: false, reason: expect.stringContaining('not opened') });
  });

  it('allows inside base period', () => {
    expect(effectiveClearanceEnd(period, [], new Date('2026-01-15'))).toEqual({ allowed: true });
  });

  it('honors approved extension past base end', () => {
    const ext = [{ extendsTo: new Date('2026-02-15T12:00:00'), status: 'approved' as const }];
    expect(effectiveClearanceEnd(period, ext, new Date('2026-02-10'))).toEqual({ allowed: true });
    const past = effectiveClearanceEnd(period, ext, new Date('2026-02-17'));
    expect(past).toMatchObject({ allowed: false });
  });

  it('ignores non-approved extensions', () => {
    const ext = [{ extendsTo: new Date('2026-02-15T12:00:00'), status: 'pending' as const }];
    const r = effectiveClearanceEnd(period, ext, new Date('2026-02-05'));
    expect(r).toMatchObject({ allowed: false });
  });
});
