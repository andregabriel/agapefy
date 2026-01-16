import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const mockUseAuth = vi.fn();
const mockUseAppSettings = vi.fn();
const mockUseSubscriptionStatus = vi.fn();
const mockUseUserActivity = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => mockUseAppSettings(),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockUseSubscriptionStatus(),
}));

vi.mock('@/hooks/useUserActivity', () => ({
  useUserActivity: () => mockUseUserActivity(),
}));

// Importar após mocks
import { PlayerProvider, usePlayer, __navigation } from './PlayerContext';

function TestHarness() {
  const { playQueue } = usePlayer();
  return (
    <button
      onClick={() =>
        playQueue(
          [
            {
              id: 'a1',
              title: 'Audio 1',
              audio_url: 'https://example.com/a1.mp3',
              description: null,
              duration: 10,
              cover_url: null,
              category: null as any,
            } as any,
          ],
          0,
        )
      }
    >
      play
    </button>
  );
}

describe('PlayerContext permissions', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Stub básico do Audio para JSDOM
    (globalThis as any).Audio = class {
      public src = '';
      public duration = 10;
      public paused = true;
      public currentTime = 0;
      public volume = 1;
      addEventListener() {}
      removeEventListener() {}
      load() {}
      pause() {
        this.paused = true;
      }
      play() {
        this.paused = false;
        return Promise.resolve();
      }
    };

    mockUseUserActivity.mockReturnValue({ logActivity: vi.fn() });
    globalThis.fetch = vi.fn() as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch as any;
    vi.restoreAllMocks();
  });

  it('anonymous: clicking play redirects to /login (always)', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseSubscriptionStatus.mockReturnValue({
      userType: 'anonymous',
      hasActiveSubscription: false,
      hasActiveTrial: false,
    });
    mockUseAppSettings.mockReturnValue({
      settings: { paywall_permissions: null },
      loading: false,
      updateSetting: vi.fn(),
    });

    const assignSpy = vi.spyOn(__navigation, 'assign').mockImplementation(() => {});

    const { getByText } = render(
      <PlayerProvider>
        <TestHarness />
      </PlayerProvider>,
    );

    fireEvent.click(getByText('play'));

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalled();
      expect(String(assignSpy.mock.calls[0]?.[0] || '')).toContain('/login');
    });
  });

  it('no_subscription: when backend says not allowed, it opens paywall', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockUseSubscriptionStatus.mockReturnValue({
      userType: 'no_subscription',
      hasActiveSubscription: false,
      hasActiveTrial: false,
    });
    mockUseAppSettings.mockReturnValue({
      settings: {
        paywall_permissions: JSON.stringify({
          anonymous: { limit_enabled: true, max_free_audios_per_day: 0 },
          no_subscription: { limit_enabled: true, max_free_audios_per_day: 1 },
          active_subscription: { full_access_enabled: true },
          trial: { full_access_enabled: true },
        }),
      },
      loading: false,
      updateSetting: vi.fn(),
    });

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false, count: 1, max: 1 }),
      status: 200,
    });

    const paywallHandler = vi.fn();
    window.addEventListener('agapefy:paywall-open', paywallHandler as any);

    const { getByText } = render(
      <PlayerProvider>
        <TestHarness />
      </PlayerProvider>,
    );

    fireEvent.click(getByText('play'));

    await waitFor(() => {
      expect(paywallHandler).toHaveBeenCalled();
    });
  });

  it('active_subscription: full access bypasses /api/free-plays/check', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockUseSubscriptionStatus.mockReturnValue({
      userType: 'active_subscription',
      hasActiveSubscription: true,
      hasActiveTrial: false,
    });
    mockUseAppSettings.mockReturnValue({
      settings: {
        paywall_permissions: JSON.stringify({
          anonymous: { limit_enabled: true, max_free_audios_per_day: 0 },
          no_subscription: { limit_enabled: true, max_free_audios_per_day: 1 },
          active_subscription: { full_access_enabled: true },
          trial: { full_access_enabled: true },
        }),
      },
      loading: false,
      updateSetting: vi.fn(),
    });

    const paywallHandler = vi.fn();
    window.addEventListener('agapefy:paywall-open', paywallHandler as any);

    const { getByText } = render(
      <PlayerProvider>
        <TestHarness />
      </PlayerProvider>,
    );

    fireEvent.click(getByText('play'));

    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(paywallHandler).not.toHaveBeenCalled();
    });
  });

  it('active_subscription: when full access disabled, it uses free-plays and can open paywall', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockUseSubscriptionStatus.mockReturnValue({
      userType: 'active_subscription',
      hasActiveSubscription: true,
      hasActiveTrial: false,
    });
    mockUseAppSettings.mockReturnValue({
      settings: {
        paywall_permissions: JSON.stringify({
          anonymous: { limit_enabled: true, max_free_audios_per_day: 0 },
          no_subscription: { limit_enabled: true, max_free_audios_per_day: 1 },
          active_subscription: { full_access_enabled: false },
          trial: { full_access_enabled: true },
        }),
      },
      loading: false,
      updateSetting: vi.fn(),
    });

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false, count: 1, max: 1 }),
      status: 200,
    });

    const paywallHandler = vi.fn();
    window.addEventListener('agapefy:paywall-open', paywallHandler as any);

    const { getByText } = render(
      <PlayerProvider>
        <TestHarness />
      </PlayerProvider>,
    );

    fireEvent.click(getByText('play'));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(paywallHandler).toHaveBeenCalled();
    });
  });
});

