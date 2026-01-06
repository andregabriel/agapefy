import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import WhatsAppSetup from '../../whatsapp/WhatsAppSetup';

// Mocks necessários
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' }, loading: false }),
}));

jest.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({ settings: {} }),
}));

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

// Mock simplificado do Supabase
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// Mocks de componentes Radix que criam ruído em JSDOM
jest.mock('@radix-ui/react-select', () => {
  const Primitive = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const Portal = ({ children }: any) => <>{children}</>;
  return {
    Root: Primitive,
    Group: Primitive,
    Value: Primitive,
    Trigger: Primitive,
    ScrollUpButton: Primitive,
    ScrollDownButton: Primitive,
    Content: Primitive,
    Label: Primitive,
    Item: Primitive,
    ItemText: Primitive,
    ItemIndicator: Primitive,
    Separator: Primitive,
    Icon: Primitive,
    Viewport: Primitive,
    Portal,
  };
});

jest.mock('@radix-ui/react-switch', () => {
  const Root = ({ children, ...props }: any) => (
    <label>
      <input type="checkbox" {...props} />
      {children}
    </label>
  );
  const Thumb = (props: any) => <span {...props} />;
  const Switch = Root;
  return { Root, Thumb, Switch };
});

// Mock TimePicker para evitar dependências de popover
jest.mock('@/components/ui/time-picker', () => ({
  TimePicker: ({ value }: { value: string }) => <div data-testid="time-picker">{value}</div>,
}));

// Mock Command (combobox) para capturar o título renderizado
jest.mock('@/components/ui/command', () => {
  const Command = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const CommandInput = (props: any) => <input {...props} />;
  const CommandGroup = (props: any) => <div {...props} />;
  const CommandItem = ({ children, onSelect, ...props }: any) => (
    <div onClick={onSelect} {...props}>
      {children}
    </div>
  );
  const CommandEmpty = (props: any) => <div {...props} />;
  return { Command, CommandInput, CommandGroup, CommandItem, CommandEmpty };
});

describe('WhatsAppSetup – fallback de onboarding não preenche combobox (bug atual)', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Mock localStorage para retornar a playlist escolhida no onboarding
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => (key === 'ag_onb_selected_playlist' ? 'playlist-onboarding' : null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Supabase mock
    mockFrom.mockImplementation((table: string) => {
      // whatsapp_user_challenges vazio
      if (table === 'whatsapp_user_challenges') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        } as any;
      }

      // admin_forms -> retorna form step 2
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

      // admin_form_responses -> retorna answers.option = playlist-onboarding
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

      // playlists -> retorna vazio (simulando bug: lista não inclui a playlist do onboarding)
      if (table === 'playlists') {
        return {
          select: () => {
            const chain: any = {};
            chain.eq = () => chain;
            chain.order = () => chain;
            chain.limit = async () => ({ data: [], error: null });
            chain.in = async () => ({ data: [], error: null });
            chain.maybeSingle = async () => ({ data: null, error: null });
            return chain;
          },
        } as any;
      }

      return { select: jest.fn() } as any;
    });
  });

  it('deveria renderizar a playlist do onboarding já selecionada no combobox, mas falha (reprodução do bug)', async () => {
    render(<WhatsAppSetup variant="standalone" redirectIfNotLoggedIn={false} />);

    // Esperamos que o título da playlist esteja presente.
    // BUG esperado: com playlists vazias, o título não aparece.
    await waitFor(
      () => {
        expect(
          screen.getByText('Desafio 40 dias para Recuperar o Casamento')
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});














