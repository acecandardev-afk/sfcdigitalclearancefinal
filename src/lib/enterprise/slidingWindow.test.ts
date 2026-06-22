import { describe, expect, it } from 'vitest';
import { pruneWindow, slidingWindowHit } from './slidingWindow';

describe('pruneWindow', () => {
  it('drops timestamps outside the window', () => {
    const now = 1_000_000;
    const out = pruneWindow([now - 100, now - 50, now - 10], now, 40);
    expect(out).toEqual([now - 10]);
  });
});

describe('slidingWindowHit', () => {
  it('allows under the limit', () => {
    const now = 10_000;
    const { allowed, next } = slidingWindowHit([], now, 3, 1000);
    expect(allowed).toBe(true);
    expect(next).toEqual([now]);
  });

  it('blocks at the limit', () => {
    const now = 100;
    const prev = [70, 80, 90];
    const { allowed, next } = slidingWindowHit(prev, now, 3, 50);
    expect(allowed).toBe(false);
    expect(next.length).toBe(3);
  });
});
