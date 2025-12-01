"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Importar o componente da home atual
import HomePage from './home/page';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [shouldShowHome, setShouldShowHome] = useState(false);
  const [guestMode, setGuestMode] = useState<boolean | null>(null);
  const [clientLoaded, setClientLoaded] = useState(false);

  // Verificar modo convidado apenas no cliente
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedGuestMode = localStorage.getItem('guestMode');

      // Novo comportamento: se o usuário acabou de chegar e ainda não tem
      // nenhuma preferência salva, tratamos como convidado por padrão,
      // exatamente como se ele tivesse clicado no "X" da tela de login.
      let isGuest = storedGuestMode === 'true';
      if (storedGuestMode === null) {
        isGuest = true;
        localStorage.setItem('guestMode', 'true');
      }

      console.log('🎭 Verificando modo convidado:', isGuest, 'storedGuestMode:', storedGuestMode);
      setGuestMode(isGuest);
    } catch (error) {
      console.warn('⚠️ Não foi possível acessar o localStorage, ativando modo convidado por segurança.', error);
      setGuestMode(true);
    } finally {
      // Garante que o cliente está marcado como carregado mesmo em caso de erro
      setClientLoaded(true);
    }
  }, []);

  useEffect(() => {
    const handleRedirection = async () => {
      // Aguardar o loading do auth E verificação do cliente terminar
      if (loading || !clientLoaded) return;

      console.log('🔄 Verificando redirecionamento - User:', !!user, 'GuestMode:', guestMode);

      // Se não há usuário logado
      if (!user) {
        // Se está em modo convidado, mostrar home
        if (guestMode) {
          console.log('🎭 Modo convidado ativo, mostrando home');
          setShouldShowHome(true);
          return;
        }
        
        // Se não é convidado, redirecionar para login
        console.log('🔐 Usuário não logado e não é convidado, redirecionando para /login');
        router.replace('/login');
        return;
      }

      // Se há usuário logado, verificar se é admin
      try {
        console.log('👤 Usuário logado, verificando perfil...');
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin') {
          console.log('🔑 Admin detectado, mostrando home normalmente');
          setIsAdmin(true);
          setShouldShowHome(true);
        } else {
          console.log('👤 Usuário comum logado, mostrando home');
          setIsAdmin(false);
          setShouldShowHome(true);
        }
      } catch (error) {
        console.error('❌ Erro ao verificar perfil:', error);
        // Em caso de erro, assumir usuário comum
        setIsAdmin(false);
        setShouldShowHome(true);
      }
    };

    handleRedirection();
  }, [user, loading, router, guestMode, clientLoaded]);

  // Loading state - aguardar auth E verificação do cliente
  if (loading || !clientLoaded || (user && isAdmin === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se deve mostrar a home (usuário comum logado OU admin OU modo convidado)
  if (shouldShowHome && ((user && (isAdmin === false || isAdmin === true)) || (!user && guestMode))) {
    return <HomePage />;
  }

  // Fallback - não deveria chegar aqui, mas por segurança
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="text-center text-white">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecionando...</p>
      </div>
    </div>
  );
}
