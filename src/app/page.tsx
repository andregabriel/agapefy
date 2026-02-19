"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

// Importar o componente da home atual
import HomePage from './home/page';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [clientLoaded, setClientLoaded] = useState(false);

  // Evita mismatch de hidratação: só renderizamos conteúdo real após o mount do cliente.
  useEffect(() => {
    setClientLoaded(true);
  }, []);

  useEffect(() => {
    if (user && !loading) {
      router.replace('/hoje');
    }
  }, [user, loading, router]);

  // Loading state - aguardamos apenas o mount do cliente para evitar mismatch de hidratação.
  if (!clientLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Visitante (sem login): sempre pode ver a Home.
  if (!user) {
    return <HomePage />;
  }

  // Usuário logado: enquanto o auth finaliza, mantemos o loading (evita flicker).
  if (loading) {
    logger.debug('🔄 Usuário logado, aguardando auth finalizar...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Usuário logado: Home normalmente.
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="text-center text-white">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Carregando...</p>
      </div>
    </div>
  );
}
