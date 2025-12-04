import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import WhatsAppSetup from '../../whatsapp/WhatsAppSetup';

// Mock hooks and supabase client used by WhatsAppSetup
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' }, loading: false }),
}));

vi.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({ settings: {} }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Mock do next/navigation para evitar erro de "app router"
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe('WhatsAppSetup fallback from onboarding', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Simular localStorage com playlist salva pelo onboarding
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => (key === 'ag_onb_selected_playlist' ? 'playlist-onboarding' : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    } as any);

    // Mock da cadeia supabase.from(...).select(...)
    mockFrom.mockImplementation((table: string) => {
      // Não há linhas em whatsapp_user_challenges
      if (table === 'whatsapp_user_challenges') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        } as any;
      }

      // Tabela admin_forms para buscar step 2
      if (table === 'admin_forms') {
        return {
          select: () => {
            const chain: any = {};
            chain.eq = () => chain;
            chain.maybeSingle = async () => ({ data: { id: 'form-step-2' }, error: null });
            return chain;
          },
        } as any;
      }

      // Tabela admin_form_responses com answers.option = playlist-onboarding
      if (table === 'admin_form_responses') {
        return {
          select: () => {
            const chain: any = {};
            chain.eq = () => chain;
            chain.order = () => chain;
            chain.limit = () => chain;
            chain.maybeSingle = async () => ({
              data: { answers: { option: 'playlist-onboarding' } },
              error: null,
            });
            return chain;
          },
        } as any;
      }

      // Tabela playlists: usada pelo fallback para garantir presença no combobox
      if (table === 'playlists') {
        return {
          select: (fields: string) => {
            // Fallback por ID (sem is_challenge)
            if (fields.includes('id,title') && !fields.includes('is_challenge')) {
              const chain: any = {};
              chain.eq = (_col: string, value: string) => {
                chain.maybeSingle = async () => ({
                  data: { id: value, title: 'Desafio 40 dias para Recuperar o Casamento' },
                  error: null,
                });
                return chain;
              };
              return chain;
            }

            // Queries de challenge (ignoradas no teste)
            const chain: any = {};
            chain.eq = () => chain;
            chain.order = () => chain;
            chain.limit = async () => ({ data: [], error: null });
            chain.in = async () => ({ data: [], error: null });
            return chain;
          },
        } as any;
      }

      return { select: mockSelect } as any;
    });
  });

  it('deve preencher selectedChallengeId a partir da playlist salva no onboarding quando não há whatsapp_user_challenges', async () => {
    const { getByText } = render(
      <WhatsAppSetup variant="standalone" redirectIfNotLoggedIn={false} />
    );

    // O efeito fetchUserChallenges roda em background; aguardamos ele atualizar o estado
    await waitFor(() => {
      expect(
        getByText('Desafio 40 dias para Recuperar o Casamento')
      ).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

