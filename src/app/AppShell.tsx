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

  return (
    <AuthProvider>
      <PlayerProvider>
        {!isLoginPage && !isBuscaPage && !isBibliaPage && <Header />}

        <main className={`flex-1 ${!isLoginPage ? 'pb-20' : ''} ${!isLoginPage && !isBuscaPage && !isBibliaPage ? 'pt-16' : ''}`}>
          {children}
        </main>

        {!isLoginPage && <BottomNavigation />}

        <Toaster />
      </PlayerProvider>
    </AuthProvider>
  );
}


