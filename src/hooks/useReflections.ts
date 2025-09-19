"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UserReflection {
  id: string;
  user_id: string;
  title: string;
  content?: string | null;
  created_at: string;
  updated_at: string;
}

export function useReflections() {
  const { user } = useAuth();
  const [reflections, setReflections] = useState<UserReflection[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar reflexões do usuário - usando useCallback para evitar loop infinito
  const fetchReflections = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('📝 Buscando reflexões do usuário...');
      setLoading(true);

      const { data, error } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar reflexões:', error);
        return;
      }

      console.log('✅ Reflexões encontradas:', data?.length || 0);
      setReflections(data || []);
    } catch (error) {
      console.error('💥 Erro inesperado ao buscar reflexões:', error);
    } finally {
      setLoading(false);
    }
  }, [user]); // Dependência apenas do user

  // Criar nova reflexão
  const createReflection = async (title: string, content?: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('➕ Criando nova reflexão:', title);

      const { data, error } = await supabase
        .from('user_reflections')
        .insert({
          user_id: user.id,
          title: title.trim(),
          content: content?.trim() || null
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar reflexão:', error);
        return false;
      }

      console.log('✅ Reflexão criada:', data);
      
      // Atualizar lista local
      setReflections(prev => [data, ...prev]);
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao criar reflexão:', error);
      return false;
    }
  };

  // Atualizar reflexão
  const updateReflection = async (id: string, title: string, content?: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('✏️ Atualizando reflexão:', id);

      const { data, error } = await supabase
        .from('user_reflections')
        .update({
          title: title.trim(),
          content: content?.trim() || null
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar reflexão:', error);
        return false;
      }

      console.log('✅ Reflexão atualizada:', data);
      
      // Atualizar lista local
      setReflections(prev => 
        prev.map(reflection => 
          reflection.id === id ? data : reflection
        )
      );
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao atualizar reflexão:', error);
      return false;
    }
  };

  // Deletar reflexão
  const deleteReflection = async (id: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    try {
      console.log('🗑️ Deletando reflexão:', id);

      const { error } = await supabase
        .from('user_reflections')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Erro ao deletar reflexão:', error);
        return false;
      }

      console.log('✅ Reflexão deletada');
      
      // Remover da lista local
      setReflections(prev => prev.filter(reflection => reflection.id !== id));
      return true;
    } catch (error) {
      console.error('💥 Erro inesperado ao deletar reflexão:', error);
      return false;
    }
  };

  // Formatar data relativa
  const formatRelativeDate = useCallback((dateString: string): string => {
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
  }, []);

  // Carregar reflexões quando usuário mudar - agora com fetchReflections memoizada
  useEffect(() => {
    fetchReflections();
  }, [fetchReflections]);

  return {
    reflections,
    loading,
    createReflection,
    updateReflection,
    deleteReflection,
    formatRelativeDate,
    refetch: fetchReflections
  };
}