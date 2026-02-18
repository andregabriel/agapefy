"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { SubscriptionUserType } from '@/constants/paywall';

interface SubscriptionStatus {
  userType: SubscriptionUserType;
  hasActiveSubscription: boolean;
  hasActiveTrial: boolean;
}

interface FetchStatusOptions {
  silent?: boolean;
  force?: boolean;
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
  const lastFetchAtRef = useRef(0);

  const fetchStatus = useCallback(async (options: FetchStatusOptions = {}) => {
    const { silent = false, force = false } = options;
    const now = Date.now();
    if (!force && now - lastFetchAtRef.current < 1500) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      if (!silent) {
        setLoading(true);
      }
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
      lastFetchAtRef.current = Date.now();
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
        if (!silent) {
          setLoading(false);
        }
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

    void fetchStatus({ force: true });
  }, [authLoading, userId, fetchStatus]);

  useEffect(() => {
    if (authLoading || !userId || typeof window === 'undefined') {
      return;
    }

    const refreshSilently = () => {
      void fetchStatus({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently();
      }
    };

    const intervalId = window.setInterval(refreshSilently, 60_000);
    window.addEventListener('focus', refreshSilently);
    window.addEventListener('pageshow', refreshSilently);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshSilently);
      window.removeEventListener('pageshow', refreshSilently);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authLoading, userId, fetchStatus]);

  const refetch = useCallback(() => {
    void fetchStatus({ force: true });
  }, [fetchStatus]);

  return {
    ...status,
    loading,
    error,
    refetch,
  };
}
