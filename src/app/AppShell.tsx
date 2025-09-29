"use client";

import { AuthProvider } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isBuscaPage = pathname === '/busca';
  const isBibliaPage = pathname === '/biblia';
  const hideHeader = isLoginPage || isBuscaPage || isBibliaPage;
  const hideBottomNav = isLoginPage;

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


