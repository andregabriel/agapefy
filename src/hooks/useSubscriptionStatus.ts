"use client";

import { useEffect, useState, useCallback } from 'react';
import type { SubscriptionUserType } from '@/constants/paywall';

interface SubscriptionStatus {
  userType: SubscriptionUserType;
  hasActiveSubscription: boolean;
  hasActiveTrial: boolean;
}

const DEFAULT_STATUS: SubscriptionStatus = {
  userType: 'anonymous',
  hasActiveSubscription: false,
  hasActiveTrial: false,
};

export function useSubscriptionStatus() {
  const [status, setStatus] = useState<SubscriptionStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/subscription/status', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as SubscriptionStatus;

      setStatus({
        userType: data.userType ?? 'anonymous',
        hasActiveSubscription: !!data.hasActiveSubscription,
        hasActiveTrial: !!data.hasActiveTrial,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('useSubscriptionStatus: erro ao buscar status', e);
      setError('Erro ao carregar status de assinatura');
      setStatus(DEFAULT_STATUS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    ...status,
    loading,
    error,
    refetch: fetchStatus,
  };
}


