"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Verificar role do usuário
  useEffect(() => {
    const checkUserRole = async () => {
      console.log('🔐 AdminLayout: Verificando acesso admin...');
      
      // Se não há usuário logado, redirecionar para login
      if (!authLoading && !user) {
        console.log('❌ AdminLayout: Usuário não logado, redirecionando para login');
        router.push('/login');
        return;
      }

      // Se ainda está carregando auth, aguardar
      if (authLoading || !user) {
        console.log('⏳ AdminLayout: Aguardando autenticação...');
        return;
      }

      try {
        setRoleLoading(true);
        console.log('🔍 AdminLayout: Buscando role do usuário:', user.email);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('❌ AdminLayout: Erro ao buscar perfil:', error);
          setAccessDenied(true);
          return;
        }

        const role = profile?.role || 'user';
        console.log('✅ AdminLayout: Role encontrado:', role);
        setUserRole(role);

        // Se não é admin, negar acesso
        if (role !== 'admin') {
          console.log('🚫 AdminLayout: Usuário não é admin, negando acesso');
          setAccessDenied(true);
          // Redirecionar após um breve delay para mostrar mensagem
          setTimeout(() => {
            router.push('/');
          }, 2000);
        }
      } catch (error) {
        console.error('💥 AdminLayout: Erro ao verificar role:', error);
        setAccessDenied(true);
      } finally {
        setRoleLoading(false);
      }
    };

    checkUserRole();
  }, [user, authLoading, router]);

  // Loading state
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">Verificando permissões...</p>
          <p className="text-sm text-gray-400 mt-2">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (accessDenied || userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
          <p className="text-gray-300 mb-6">
            Você não tem permissão para acessar esta área. 
            Apenas administradores podem visualizar o painel admin.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => router.push('/')}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Voltar para Home
            </button>
            
            <button
              onClick={() => router.back()}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Voltar à página anterior
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            Redirecionando automaticamente em alguns segundos...
          </p>
        </div>
      </div>
    );
  }

  // Se chegou até aqui, é admin - renderizar conteúdo
  console.log('✅ AdminLayout: Acesso liberado para admin');
  return <>{children}</>;
}