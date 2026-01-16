"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<SubscriptionStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
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
        if (res.status === 404) {
          // Endpoint ausente ou desabilitado: tratar como anônimo sem assinatura
          setStatus(DEFAULT_STATUS);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as SubscriptionStatus;

      if (requestIdRef.current !== requestId) {
        return;
      }

      setStatus({
        userType: data.userType ?? 'anonymous',
        hasActiveSubscription: !!data.hasActiveSubscription,
        hasActiveTrial: !!data.hasActiveTrial,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('useSubscriptionStatus: erro ao buscar status', e);
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError('Erro ao carregar status de assinatura');
      setStatus(DEFAULT_STATUS);
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      requestIdRef.current += 1;
      setLoading(true);
      return;
    }

    if (!userId) {
      requestIdRef.current += 1;
      setStatus(DEFAULT_STATUS);
      setError(null);
      setLoading(false);
      return;
    }

    fetchStatus();
  }, [authLoading, userId, fetchStatus]);

  return {
    ...status,
    loading,
    error,
    refetch: fetchStatus,
  };
}
