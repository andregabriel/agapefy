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

  const now = new Date();
  const normalized = rows.map((row) => ({
    status: (row.status || '').toLowerCase(),
    trial_days: row.trial_days ?? 0,
    trial_started_at: row.trial_started_at ? new Date(row.trial_started_at) : null,
    trial_finished_at: row.trial_finished_at ? new Date(row.trial_finished_at) : null,
    cancel_at_cycle_end: !!row.cancel_at_cycle_end,
  }));

  // Se o status já é pago/ativo, isso deve prevalecer sobre datas de trial.
  const activeStatuses = ['active', 'paid', 'authorized'];
  const hasActiveSubscription = normalized.some((row) => activeStatuses.includes(row.status));

  if (hasActiveSubscription) {
    return {
      userType: 'active_subscription',
      hasActiveSubscription: true,
      hasActiveTrial: false,
    };
  }

  // trialing é um status explícito de trial (quando o provedor envia assim)
  const hasExplicitTrialingStatus = normalized.some((row) => row.status === 'trialing');

  const hasActiveTrial =
    hasExplicitTrialingStatus ||
    normalized.some((row) => {
      if (!row.trial_days || row.trial_days <= 0) return false;
      if (row.trial_finished_at && row.trial_finished_at < now) return false;
      if (row.status === 'canceled' || row.status === 'cancelled' || row.status === 'expired') {
        return false;
      }
      return true;
    });

  if (hasActiveTrial) {
    return {
      userType: 'trial',
      hasActiveSubscription: false,
      hasActiveTrial: true,
    };
  }

  return {
    userType: 'no_subscription',
    hasActiveSubscription: false,
    hasActiveTrial: false,
  };
}



