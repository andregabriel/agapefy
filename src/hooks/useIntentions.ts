"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UserIntention {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export function useIntentions() {
  const { user } = useAuth();
  const [intentions, setIntentions] = useState<UserIntention[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar intenções do usuário - usando useCallback para evitar loop infinito
  const fetchIntentions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('🙏 Buscando intenções do usuário...');
      setLoading(true);

      const { data, error } = await supabase
        .from('user_intentions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar intenções:', error);
        return;
      }

      console.log('✅ Intenções encontradas:', data?.length || 0);
      setIntentions(data || []);
    } catch (error) {
      console.error('💥 Erro inesperado ao buscar intenções:', error);
    } finally {
      setLoading(false);
    }
  }, [user]); // Dependência apenas do user

  // Criar nova intenção
  const createIntention = async (title: string, description?: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('➕ Criando nova intenção:', title);

      const { data, error } = await supabase
        .from('user_intentions')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description?.trim() || null
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar intenção:', error);
        return false;
      }

      console.log('✅ Intenção criada:', data);
      
      // Atualizar lista local
      setIntentions(prev => [data, ...prev]);
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao criar intenção:', error);
      return false;
    }
  };

  // Atualizar intenção
  const updateIntention = async (id: string, title: string, description?: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('✏️ Atualizando intenção:', id);

      const { data, error } = await supabase
        .from('user_intentions')
        .update({
          title: title.trim(),
          description: description?.trim() || null
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar intenção:', error);
        return false;
      }

      console.log('✅ Intenção atualizada:', data);
      
      // Atualizar lista local
      setIntentions(prev => 
        prev.map(intention => 
          intention.id === id ? data : intention
        )
      );
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao atualizar intenção:', error);
      return false;
    }
  };

  // Deletar intenção
  const deleteIntention = async (id: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('🗑️ Deletando intenção:', id);

      const { error } = await supabase
        .from('user_intentions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Erro ao deletar intenção:', error);
        return false;
      }

      console.log('✅ Intenção deletada');
      
      // Remover da lista local
      setIntentions(prev => prev.filter(intention => intention.id !== id));
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao deletar intenção:', error);
      return false;
    }
  };

  // Formatar data relativa
  const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Hoje';
    } else if (diffInDays === 1) {
      return 'Ontem';
    } else if (diffInDays < 7) {
      return `Há ${diffInDays} dias`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `Há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'short',
        year: diffInDays > 365 ? 'numeric' : undefined
      });
    }
  };

  // Carregar intenções quando usuário mudar - agora com fetchIntentions memoizada
  useEffect(() => {
    fetchIntentions();
  }, [fetchIntentions]);

  return {
    intentions,
    loading,
    createIntention,
    updateIntention,
    deleteIntention,
    formatRelativeDate,
    refetch: fetchIntentions
  };
}