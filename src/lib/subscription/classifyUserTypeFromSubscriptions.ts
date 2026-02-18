import type { SubscriptionUserType } from '@/constants/paywall';

export interface AssinaturaRow {
  status: string | null;
  trial_days: number | null;
  trial_started_at: string | null;
  trial_finished_at: string | null;
  cancel_at_cycle_end: boolean | null;
}

export function classifyUserTypeFromSubscriptions(rows: AssinaturaRow[]): {
  userType: SubscriptionUserType;
  hasActiveSubscription: boolean;
  hasActiveTrial: boolean;
} {
  if (!rows || rows.length === 0) {
    return {
      userType: 'no_subscription',
      hasActiveSubscription: false,
      hasActiveTrial: false,
    };
  }

  const normalized = rows.map((row) => ({
    status: (row.status || '').trim().toLowerCase(),
    trial_days: row.trial_days ?? 0,
    trial_started_at: row.trial_started_at ? new Date(row.trial_started_at) : null,
    trial_finished_at: row.trial_finished_at ? new Date(row.trial_finished_at) : null,
    cancel_at_cycle_end: !!row.cancel_at_cycle_end,
  }));

  // MVP: apenas status "active" concede acesso total.
  // Trial não concede acesso nessa fase.
  const activeStatuses = ['active'];
  const hasActiveSubscription = normalized.some((row) => activeStatuses.includes(row.status));

  if (hasActiveSubscription) {
    return {
      userType: 'active_subscription',
      hasActiveSubscription: true,
      hasActiveTrial: false,
    };
  }

  return {
    userType: 'no_subscription',
    hasActiveSubscription: false,
    hasActiveTrial: false,
  };
}


