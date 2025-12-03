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
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const logPrefix = '[onboarding-gate]';
  const hasCurrentAudio = !!state.currentAudio;
  const isLoginPage = pathname === '/login';
  const isBuscaPage = pathname === '/busca';
  const isBibliaPage = pathname === '/biblia';
  const isOnboardingPage = pathname?.startsWith('/onboarding');
  const hideHeader = isLoginPage || isBuscaPage || isBibliaPage; // mostrar Header no onboarding
  const hideBottomNav = isLoginPage || isOnboardingPage;
  const hideMiniPlayer = isLoginPage || isOnboardingPage;

  // Gate de onboarding: somente primeiro acesso enquanto houver passos pendentes
  useEffect(() => {
    let aborted = false;
    async function checkOnboarding() {
      if (loading) return; // aguardar auth
      if (!user) return; // usuários não autenticados não são redirecionados
      if (pathname.startsWith('/onboarding')) return; // já no fluxo de onboarding

      try {
        setCheckingOnboarding(true);
        console.info(`${logPrefix} start`, { userId: user.id, pathname });

        // Verificar se é admin - admin não deve ser redirecionado para onboarding
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
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
          console.info(`${logPrefix} admin detected, skipping onboarding`, { userId: user.id });
          return;
        }

        const redirectKey = `onboardingRedirected_${user.id}`;
        const alreadyRedirected =
          typeof window !== 'undefined' && sessionStorage.getItem(redirectKey) === '1';
        const res = await fetch('/api/onboarding/status', {
          headers: { 'x-user-id': user.id },
        });
        if (!res.ok) {
          console.error(`${logPrefix} status fetch failed`, { status: res.status });
          return;
        }
        const json = await res.json();
        if (aborted) return;
        console.info(`${logPrefix} status response`, {
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
            router.replace(`/onboarding?step=${json.nextStep}`);
            try {
              sessionStorage.setItem(redirectKey, '1');
            } catch {
              // ignore
            }
          }
          return;
        }

        // Sem passos pendentes: verificar se o WhatsApp foi configurado; se não, enviar para o passo 7
        const { data, error: whatsappError } = await supabase
          .from('whatsapp_users')
          .select('phone_number')
          .eq('user_id', user.id)
          .maybeSingle();
        if (whatsappError) {
          console.error(`${logPrefix} whatsapp lookup error`, {
            message: whatsappError.message,
            details: whatsappError.details,
            hint: whatsappError.hint,
          });
        }
        if (aborted) return;
        if (!data?.phone_number) {
          if (!alreadyRedirected) {
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
        const redirectKey = `onboardingRedirected_${user?.id}`;
        const alreadyRedirected =
          typeof window !== 'undefined' && redirectKey && sessionStorage.getItem(redirectKey) === '1';
        if (!alreadyRedirected && user?.id) {
          // não redirecionar em caso de erro para evitar loop
        }
      } finally {
        if (!aborted) {
          setCheckingOnboarding(false);
        }
      }
    }
    void checkOnboarding();
    return () => {
      aborted = true;
    };
  }, [user, loading, pathname, router]);

  return (
    <>
      <div className={hideHeader || (checkingOnboarding && !isOnboardingPage) ? 'hidden' : ''}>
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
        {checkingOnboarding && !isOnboardingPage ? null : children}
      </main>

      {/* Mini player global – visível em (quase) qualquer página quando houver áudio atual */}
      {!hideMiniPlayer && hasCurrentAudio && <MiniPlayer />}

      <div className={hideBottomNav ? 'hidden' : ''}>
        <BottomNavigation />
      </div>

      <PaywallModal />
      <Toaster />
    </>
  );
}
