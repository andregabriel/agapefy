import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSubscriptionStatus } from './useSubscriptionStatus';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('useSubscriptionStatus', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch as any;
    vi.restoreAllMocks();
  });

  it('refetches when user changes and resets on logout', async () => {
    const authState = { user: { id: 'u1' }, loading: false };
    mockUseAuth.mockImplementation(() => authState);

    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userType: 'no_subscription',
          hasActiveSubscription: false,
          hasActiveTrial: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userType: 'active_subscription',
          hasActiveSubscription: true,
          hasActiveTrial: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userType: 'active_subscription',
          hasActiveSubscription: true,
          hasActiveTrial: false,
        }),
      });

    const { result, rerender } = renderHook(() => useSubscriptionStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const initialCalls = (globalThis.fetch as any).mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    authState.user = { id: 'u2' };
    rerender();

    await waitFor(() => {
      expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(initialCalls);
    });
    const afterUserChangeCalls = (globalThis.fetch as any).mock.calls.length;

    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => {
      expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(afterUserChangeCalls);
    });
    const afterRefetchCalls = (globalThis.fetch as any).mock.calls.length;

    authState.user = null;
    rerender();

    await waitFor(() => {
      expect(result.current.userType).toBe('anonymous');
      expect(result.current.loading).toBe(false);
    });
    expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThanOrEqual(afterRefetchCalls);
  });
});
