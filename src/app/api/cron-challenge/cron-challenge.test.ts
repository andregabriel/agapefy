import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { inlineSend } from './route';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase-admin', () => ({
  getAdminSupabase: () => ({
    from: (...args: any[]) => mockFrom(...args),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

const originalFetch = global.fetch;

describe('cron-challenge inlineSend', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const fixedDate = new Date('2025-01-10T11:02:00.000Z');
    vi.setSystemTime(fixedDate);
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'ok',
    })) as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it('retorna zero enviados quando não há rows em whatsapp_user_challenges', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'whatsapp_user_challenges') {
        return {
          select: () =>
            Promise.resolve({
              data: [],
              error: null,
            }),
        } as any;
      }
      return {
        select: () =>
          Promise.resolve({
            data: [],
            error: null,
          }),
      } as any;
    });

    const result = await inlineSend(true, 10);
    expect(result.ok).toBe(true);
    expect(result.sent).toBe(0);
    expect(result.totalCandidates).toBe(0);
  });

  it('considera usuário elegível quando horário e flags batem', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'whatsapp_user_challenges') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                {
                  phone_number: '5511999999999',
                  playlist_id: 'playlist-1',
                  send_time: '08:00',
                  whatsapp_users: {
                    is_active: true,
                    receives_daily_prayer: true,
                    has_sent_first_message: true,
                  },
                },
              ],
              error: null,
            }),
        } as any;
      }

      if (table === 'playlist_audios') {
        return {
          select: () => ({
            in: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      playlist_id: 'playlist-1',
                      position: 1,
                      audio_id: 'audio-1',
                      audios: { title: 'Oração 1' },
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        } as any;
      }

      if (table === 'playlists') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    id: 'playlist-1',
                    title: 'Desafio de 30 dias para Superar Dificuldades Financeiras',
                  },
                ],
                error: null,
              }),
          }),
        } as any;
      }

      if (table === 'whatsapp_challenge_log') {
        const finalEqChain = {
          eq: () => ({
            limit: () =>
              Promise.resolve({
                data: [],
                error: null,
              }),
          }),
          lte: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: [],
                  error: null,
                }),
            }),
          }),
        };

        return {
          select: () => ({
            eq: () => ({
              eq: () => finalEqChain,
            }),
          }),
        } as any;
      }

      return {
        select: () =>
          Promise.resolve({
            data: [],
            error: null,
          }),
      } as any;
    });

    const result = await inlineSend(true, 10);
    expect(result.ok).toBe(true);
    expect(result.totalCandidates).toBe(1);
    expect(result.sent).toBe(0);
  });
});



