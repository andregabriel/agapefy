"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === '/login';
  const isBuscaPage = pathname === '/busca';
  const isBibliaPage = pathname === '/biblia';
  const isOnboardingPage = pathname?.startsWith('/onboarding');
  const hideHeader = isLoginPage || isBuscaPage || isBibliaPage || isOnboardingPage;
  const hideBottomNav = isLoginPage || isOnboardingPage;

  // Gate de onboarding: somente primeiro acesso enquanto houver passos pendentes
  useEffect(() => {
    let aborted = false;
    async function checkOnboarding() {
      if (loading) return; // aguardar auth
      if (!user) return; // usuários não autenticados não são redirecionados
      if (pathname.startsWith('/onboarding')) return; // já no fluxo de onboarding

      try {
        const res = await fetch('/api/onboarding/status', {
          headers: { 'x-user-id': user.id }
        });
        if (!res.ok) return;
        const json = await res.json();
        if (aborted) return;
        if (json?.pending && typeof json?.nextStep === 'number') {
          router.replace(`/onboarding?step=${json.nextStep}`);
        }
      } catch {
        // Ignora erros silenciosamente para não afetar UX
      }
    }
    void checkOnboarding();
    return () => { aborted = true; };
  }, [user, loading, pathname, router]);

  return (
    <AuthProvider>
      <PlayerProvider>
        <div className={hideHeader ? 'hidden' : ''}>
          <Header />
        </div>

        <main className={`flex-1 ${!hideBottomNav ? 'pb-20' : ''} ${!hideHeader ? 'pt-16' : ''}`}>
          {children}
        </main>

        <div className={hideBottomNav ? 'hidden' : ''}>
          <BottomNavigation />
        </div>

        <Toaster />
      </PlayerProvider>
    </AuthProvider>
  );
}


