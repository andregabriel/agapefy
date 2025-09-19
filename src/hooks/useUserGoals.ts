"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UserGoals {
  id: string;
  user_id: string;
  weekly_goal: number;
  consecutive_goal: number;
  created_at: string;
  updated_at: string;
}

export interface UserGoalsInput {
  weekly_goal: number;
  consecutive_goal: number;
}

export function useUserGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar metas do usuário
  const fetchGoals = async () => {
    if (!user) {
      console.log('🔍 useUserGoals: Usuário não autenticado, pulando busca');
      setLoading(false);
      return;
    }

    try {
      console.log('🎯 useUserGoals: Buscando metas do usuário:', user.id);
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.log('📝 useUserGoals: Erro ao buscar metas:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint
        });

        if (fetchError.code === 'PGRST116') {
          // Nenhum registro encontrado - criar metas padrão
          console.log('📝 useUserGoals: Nenhuma meta encontrada, criando metas padrão');
          await createDefaultGoals();
        } else {
          console.error('❌ useUserGoals: Erro inesperado ao buscar metas:', fetchError);
          setError(`Erro ao carregar metas: ${fetchError.message}`);
        }
      } else {
        console.log('✅ useUserGoals: Metas encontradas:', data);
        setGoals(data);
      }
    } catch (err) {
      console.error('💥 useUserGoals: Erro inesperado ao buscar metas:', err);
      setError('Erro inesperado ao carregar metas');
    } finally {
      setLoading(false);
    }
  };

  // Criar metas padrão
  const createDefaultGoals = async () => {
    if (!user) {
      console.error('❌ useUserGoals: Tentativa de criar metas sem usuário autenticado');
      return;
    }

    try {
      console.log('📝 useUserGoals: Criando metas padrão para usuário:', user.id);
      
      const defaultGoals: UserGoalsInput = {
        weekly_goal: 7,
        consecutive_goal: 7
      };

      const insertData = {
        user_id: user.id,
        ...defaultGoals
      };

      console.log('📤 useUserGoals: Dados para inserção:', insertData);

      const { data, error: insertError } = await supabase
        .from('user_goals')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ useUserGoals: Erro detalhado ao criar metas padrão:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          insertData: insertData
        });
        
        // Tentar diagnóstico do erro
        if (insertError.code === '42501') {
          setError('Erro de permissão. Verifique se você está autenticado.');
        } else if (insertError.code === '23505') {
          setError('Metas já existem para este usuário.');
          // Tentar buscar as metas existentes
          await fetchGoals();
          return;
        } else {
          setError(`Erro ao criar metas: ${insertError.message || 'Erro desconhecido'}`);
        }
      } else {
        console.log('✅ useUserGoals: Metas padrão criadas com sucesso:', data);
        setGoals(data);
      }
    } catch (err) {
      console.error('💥 useUserGoals: Erro inesperado ao criar metas padrão:', err);
      setError('Erro inesperado ao criar metas padrão');
    }
  };

  // Atualizar metas
  const updateGoals = async (newGoals: UserGoalsInput) => {
    if (!user) {
      console.error('❌ useUserGoals: Tentativa de atualizar metas sem usuário autenticado');
      return false;
    }

    if (!goals) {
      console.error('❌ useUserGoals: Tentativa de atualizar metas sem metas existentes');
      return false;
    }

    try {
      console.log('🔄 useUserGoals: Atualizando metas:', newGoals);
      setError(null);

      const updateData = {
        ...newGoals,
        updated_at: new Date().toISOString()
      };

      console.log('📤 useUserGoals: Dados para atualização:', updateData);

      const { data, error: updateError } = await supabase
        .from('user_goals')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ useUserGoals: Erro detalhado ao atualizar metas:', {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          updateData: updateData
        });
        
        setError(`Erro ao salvar metas: ${updateError.message || 'Erro desconhecido'}`);
        return false;
      }

      console.log('✅ useUserGoals: Metas atualizadas com sucesso:', data);
      setGoals(data);
      return true;
    } catch (err) {
      console.error('💥 useUserGoals: Erro inesperado ao atualizar metas:', err);
      setError('Erro inesperado ao salvar metas');
      return false;
    }
  };

  // Carregar metas quando o usuário mudar
  useEffect(() => {
    console.log('🔄 useUserGoals: useEffect disparado, usuário:', !!user, user?.id);
    fetchGoals();
  }, [user]);

  return {
    goals,
    loading,
    error,
    updateGoals,
    refetch: fetchGoals
  };
}