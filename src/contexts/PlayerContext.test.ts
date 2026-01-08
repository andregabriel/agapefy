import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { checkAndIncrementFreePlayLocal } from './PlayerContext';

describe('checkAndIncrementFreePlayLocal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-07T12:00:00.000Z'));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('blocks when maxFreePerDay is 0 (zero plays)', () => {
    const res = checkAndIncrementFreePlayLocal('anon', 0);
    expect(res.allowed).toBe(false);
    expect(res.count).toBe(0);
  });

  it('increments until reaching max, then blocks', () => {
    const r1 = checkAndIncrementFreePlayLocal('u1', 2);
    expect(r1.allowed).toBe(true);
    expect(r1.count).toBe(1);

    const r2 = checkAndIncrementFreePlayLocal('u1', 2);
    expect(r2.allowed).toBe(true);
    expect(r2.count).toBe(2);

    const r3 = checkAndIncrementFreePlayLocal('u1', 2);
    expect(r3.allowed).toBe(false);
    expect(r3.count).toBe(2);
  });
});



