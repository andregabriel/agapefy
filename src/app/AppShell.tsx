"use client";

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { RoutineProvider } from '@/contexts/RoutineContext';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
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
  const isLoginPage = pathname === '/login';
  const isBuscaPage = pathname === '/busca';
  const isBibliaPage = pathname === '/biblia';
  const isOnboardingPage = pathname?.startsWith('/onboarding');
  const hideHeader = isLoginPage || isBuscaPage || isBibliaPage; // mostrar Header no onboarding
  const hideBottomNav = isLoginPage || isOnboardingPage;

  // Gate de onboarding: somente primeiro acesso enquanto houver passos pendentes
  useEffect(() => {
    let aborted = false;
    async function checkOnboarding() {
      if (loading) return; // aguardar auth
      if (!user) return; // usuários não autenticados não são redirecionados
      if (pathname.startsWith('/onboarding')) return; // já no fluxo de onboarding

      try {
        const alreadyRedirected =
          typeof window !== 'undefined' && sessionStorage.getItem('onboardingRedirected') === '1';
        const res = await fetch('/api/onboarding/status', {
          headers: { 'x-user-id': user.id },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (aborted) return;
        if (json?.pending && typeof json?.nextStep === 'number') {
          if (!alreadyRedirected) {
            router.replace(`/onboarding?step=${json.nextStep}`);
            try {
              sessionStorage.setItem('onboardingRedirected', '1');
            } catch {
              // ignore
            }
          }
          return;
        }

        // Sem passos pendentes: verificar se o WhatsApp foi configurado; se não, enviar para o passo 7
        const { data } = await supabase
          .from('whatsapp_users')
          .select('phone_number')
          .eq('user_id', user.id)
          .maybeSingle();
        if (aborted) return;
        if (!data?.phone_number) {
          if (!alreadyRedirected) {
            router.replace('/onboarding?step=7');
            try {
              sessionStorage.setItem('onboardingRedirected', '1');
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Ignora erros silenciosamente para não afetar UX
      }
    }
    void checkOnboarding();
    return () => {
      aborted = true;
    };
  }, [user, loading, pathname, router]);

  return (
    <>
      <div className={hideHeader ? 'hidden' : ''}>
        <Header />
      </div>

      <main className={`flex-1 ${!hideBottomNav ? 'pb-20' : ''} ${!hideHeader ? 'pt-16' : ''}`}>
        {children}
      </main>

      <div className={hideBottomNav ? 'hidden' : ''}>
        <BottomNavigation />
      </div>

      <PaywallModal />
      <Toaster />
    </>
  );
}

