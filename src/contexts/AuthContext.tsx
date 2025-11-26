"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 AuthContext: Inicializando...');

    // Obter sessão inicial
    const getInitialSession = async () => {
      try {
        console.log('🔍 AuthContext: Buscando sessão inicial...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          const message = (error as any)?.message || '';
          // Silencia e corrige o caso comum de token inválido/ausente (ex.: usuário limpou cookies/localStorage)
          if (/invalid refresh token/i.test(message) || /refresh token not found/i.test(message)) {
            console.warn('⚠️ AuthContext: Token inválido/ausente detectado, limpando sessão local.');
            try {
              await supabase.auth.signOut();
            } catch {}
          } else {
            console.error('❌ AuthContext: Erro ao obter sessão:', error);
          }
        } else {
          // Evita logar dados pessoais como e-mail no console do navegador
          console.log('✅ AuthContext: Sessão inicial obtida:', !!session);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('💥 AuthContext: Erro ao inicializar sessão:', error);
      } finally {
        setLoading(false);
        console.log('🏁 AuthContext: Loading finalizado');
      }
    };

    getInitialSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Não logar e-mail do usuário no console do navegador
        console.log('🔄 AuthContext: Auth state changed:', event, !!session);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          console.log('✅ AuthContext: Usuário logado com sucesso!');
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('🚪 AuthContext: Usuário deslogado');
        }
      }
    );

    return () => {
      console.log('🧹 AuthContext: Limpando subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('🚪 AuthContext: Iniciando logout...');
      setLoading(true);
      await supabase.auth.signOut();
      console.log('✅ AuthContext: Logout realizado');
      window.location.href = '/';
    } catch (error) {
      console.error('❌ AuthContext: Erro ao fazer logout:', error);
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  console.log('📊 AuthContext: Estado atual - User:', !!user, 'Loading:', loading);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};