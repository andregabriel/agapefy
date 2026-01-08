import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { classifyUserTypeFromSubscriptions, type AssinaturaRow } from './classifyUserTypeFromSubscriptions';

describe('classifyUserTypeFromSubscriptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-07T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns no_subscription when there are no rows', () => {
    expect(classifyUserTypeFromSubscriptions([])).toEqual({
      userType: 'no_subscription',
      hasActiveSubscription: false,
      hasActiveTrial: false,
    });
  });

  it('prefers active_subscription when status is active/paid even if trial fields exist', () => {
    const rows: AssinaturaRow[] = [
      {
        status: 'paid',
        trial_days: 30,
        trial_started_at: '2026-01-01T00:00:00.000Z',
        trial_finished_at: '2026-02-01T00:00:00.000Z',
        cancel_at_cycle_end: false,
      },
    ];

    expect(classifyUserTypeFromSubscriptions(rows)).toEqual({
      userType: 'active_subscription',
      hasActiveSubscription: true,
      hasActiveTrial: false,
    });
  });

  it('returns trial when status is trialing', () => {
    const rows: AssinaturaRow[] = [
      {
        status: 'trialing',
        trial_days: 30,
        trial_started_at: '2026-01-01T00:00:00.000Z',
        trial_finished_at: '2026-02-01T00:00:00.000Z',
        cancel_at_cycle_end: false,
      },
    ];

    expect(classifyUserTypeFromSubscriptions(rows)).toEqual({
      userType: 'trial',
      hasActiveSubscription: false,
      hasActiveTrial: true,
    });
  });

  it('returns no_subscription when trial is finished and status is not active', () => {
    const rows: AssinaturaRow[] = [
      {
        status: 'expired',
        trial_days: 30,
        trial_started_at: '2025-11-01T00:00:00.000Z',
        trial_finished_at: '2025-12-01T00:00:00.000Z',
        cancel_at_cycle_end: true,
      },
    ];

    expect(classifyUserTypeFromSubscriptions(rows)).toEqual({
      userType: 'no_subscription',
      hasActiveSubscription: false,
      hasActiveTrial: false,
    });
  });
});



