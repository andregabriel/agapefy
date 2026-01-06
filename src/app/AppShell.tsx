"use client";

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider, usePlayer } from '@/contexts/PlayerContext';
import { RoutineProvider } from '@/contexts/RoutineContext';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PaywallModal } from '@/components/modals/PaywallModal';
import { logger } from '@/lib/logger';

export default function AppShell({ children }: { children: React.ReactNode }) {
  // Colocamos os providers aqui no topo, e movemos a lógica que consome o AuthContext
  // para um componente filho, garantindo que useAuth seja sempre usado dentro do provider.
  return (
    <AuthProvider>
      <RoutineProvider>
        <PlayerProvider>
          <AppShellInner>{children}</AppShellInner>
        </PlayerProvider>
      </RoutineProvider>
    </AuthProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { state } = usePlayer();
  const [onboardingGateReadyForUser, setOnboardingGateReadyForUser] = useState<string | null>(null);
  const logPrefix = '[onboarding-gate]';
  const hasCurrentAudio = !!state.currentAudio;
  const userId = user?.id ?? null;
  const isLoginPage = pathname === '/login';
  const isBuscaPage = pathname === '/busca';
  const isBibliaPage = pathname === '/biblia';
  const isOnboardingPage = pathname?.startsWith('/onboarding');
  const shouldCheckOnboarding = !!userId && !loading && !isOnboardingPage;
  const shouldBlockRender = shouldCheckOnboarding && onboardingGateReadyForUser !== userId;
  const hideHeader = isLoginPage || isBuscaPage || isBibliaPage || shouldBlockRender; // mostrar Header no onboarding
  const hideBottomNav = isLoginPage || isOnboardingPage || shouldBlockRender;
  const hideMiniPlayer = isLoginPage || isOnboardingPage || shouldBlockRender;

  // Gate de onboarding: somente primeiro acesso enquanto houver passos pendentes
  useEffect(() => {
    let aborted = false;
    let keepBlocking = false;
    async function checkOnboarding() {
      if (loading) return; // aguardar auth
      if (!userId) {
        setOnboardingGateReadyForUser(null);
        return; // usuários não autenticados não são redirecionados
      }
      if (isOnboardingPage) {
        setOnboardingGateReadyForUser(null);
        return; // já no fluxo de onboarding
      }

      try {
        logger.debug(`${logPrefix} start`, { userId, pathname });

        // Verificar se é admin - admin não deve ser redirecionado para onboarding
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error(`${logPrefix} profile lookup error`, {
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
          });
        }
        
        if (aborted) return;
        
        if (profile?.role === 'admin') {
          // Admin não deve ver onboarding
          logger.debug(`${logPrefix} admin detected, skipping onboarding`, { userId });
          return;
        }

        const redirectKey = `onboardingRedirected_${userId}`;
        const alreadyRedirected =
          typeof window !== 'undefined' && sessionStorage.getItem(redirectKey) === '1';
        const res = await fetch('/api/onboarding/status', {
          headers: { 'x-user-id': userId },
        });
        if (!res.ok) {
          console.error(`${logPrefix} status fetch failed`, { status: res.status });
          return;
        }
        const json = await res.json();
        if (aborted) return;
        logger.debug(`${logPrefix} status response`, {
          pending: json?.pending,
          nextStep: json?.nextStep,
          steps: json?.steps,
          error: json?.error,
        });
        if (json?.error === 'missing_service_role') {
          // Não forçar onboarding se backend está sem service role
          return;
        }
        if (json?.pending && typeof json?.nextStep === 'number') {
          if (!alreadyRedirected) {
            keepBlocking = true;
            setOnboardingGateReadyForUser(null);
            router.replace(`/onboarding?step=${json.nextStep}`);
            try {
              sessionStorage.setItem(redirectKey, '1');
            } catch {
              // ignore
            }
            return;
          }
        }

        // Sem passos pendentes: verificar se o WhatsApp foi configurado; se não, enviar para o passo 7
        const { data, error: whatsappError } = await supabase
          .from('whatsapp_users')
          .select('phone_number')
          .eq('user_id', userId)
          .maybeSingle();

        if (whatsappError) {
          // Erros desse lookup não devem acionar o overlay de erro do Next,
          // então usamos apenas console.warn em vez de console.error.
          const msg = whatsappError.message || '';
          const code = (whatsappError as any).code || '';
          const isSchemaError =
            code === '42703' || // undefined_column
            code === '42883' || // undefined_function (alguns casos de cache)
            msg.toLowerCase().includes('schema cache') ||
            (msg.toLowerCase().includes('column') &&
              msg.toLowerCase().includes('does not exist'));

          const logPayload = {
            message: msg || undefined,
            details: (whatsappError as any).details,
            hint: (whatsappError as any).hint,
            code: code || undefined,
          };

          if (isSchemaError) {
            // Falta de coluna/tabela de WhatsApp em ambientes onde a migration ainda não rodou.
            // Ignoramos para o gate, apenas logando como aviso.
            console.warn(`${logPrefix} whatsapp lookup schema error (ignorado para gate)`, logPayload);
            return;
          }

          // Para outros erros inesperados, apenas avisamos e seguimos o fluxo normal
          // sem redirecionar nem bloquear renderização.
          console.warn(`${logPrefix} whatsapp lookup error (ignorado para gate)`, logPayload);
          return;
        }

        if (aborted) return;
        if (!data?.phone_number) {
          if (!alreadyRedirected) {
            keepBlocking = true;
            setOnboardingGateReadyForUser(null);
            router.replace('/onboarding?step=7');
            try {
              sessionStorage.setItem(redirectKey, '1');
            } catch {
              // ignore
            }
          }
        }
      } catch (error: any) {
        console.error(`${logPrefix} unexpected error`, {
          message: error?.message,
          stack: error?.stack,
        });
        const redirectKey = `onboardingRedirected_${userId}`;
        const alreadyRedirected =
          typeof window !== 'undefined' && redirectKey && sessionStorage.getItem(redirectKey) === '1';
        if (!alreadyRedirected && userId) {
          // não redirecionar em caso de erro para evitar loop
        }
      } finally {
        if (!aborted) {
          if (keepBlocking) {
            setOnboardingGateReadyForUser(null);
          } else {
            setOnboardingGateReadyForUser(userId);
          }
        }
      }
    }
    void checkOnboarding();
    return () => {
      aborted = true;
    };
  }, [userId, loading, pathname, router, isOnboardingPage]);

  return (
    <>
      <div className={hideHeader ? 'hidden' : ''}>
        <Header />
      </div>

      <main
        className={`flex-1 ${
          !hideBottomNav
            ? hasCurrentAudio && !hideMiniPlayer
              ? 'pb-44'
              : 'pb-24'
            : ''
        } ${!hideHeader ? 'pt-16' : ''}`}
      >
        {shouldBlockRender ? null : children}
      </main>

      {/* Mini player global - visível em (quase) qualquer página quando houver áudio atual */}
      {!hideMiniPlayer && hasCurrentAudio && <MiniPlayer />}

      <div className={hideBottomNav ? 'hidden' : ''}>
        <BottomNavigation />
      </div>

      <PaywallModal />
      <Toaster />
    </>
  );
}
