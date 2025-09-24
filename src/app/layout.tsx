"use client";

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { Toaster } from '@/components/ui/sonner';
import { Header } from '@/components/Header';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isBuscaPage = pathname === '/busca';
  const isBibliaPage = pathname === '/biblia';

  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        <AuthProvider>
          <PlayerProvider>
            {/* Header - não mostrar na página de login, busca ou biblia */}
            {!isLoginPage && !isBuscaPage && !isBibliaPage && <Header />}
            
            {/* Main content */}
            <main className={`flex-1 ${!isLoginPage ? 'pb-20' : ''} ${!isLoginPage && !isBuscaPage && !isBibliaPage ? 'pt-16' : ''}`}>
              {children}
            </main>
            
            {/* Bottom Navigation - não mostrar na página de login */}
            {!isLoginPage && <BottomNavigation />}
            
            <Toaster />
          </PlayerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutContent>{children}</LayoutContent>;
}