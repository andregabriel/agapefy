"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Audio } from '@/lib/supabase-queries';

export interface UserActivity {
  id: string;
  user_id: string;
  audio_id: string;
  activity_type: string;
  duration_listened: number;
  completed: boolean;
  created_at: string;
  audio: Audio;
}

export interface ActivityInput {
  audio_id: string;
  activity_type?: string;
  duration_listened?: number;
  completed?: boolean;
}

export function useUserActivity() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar atividades recentes do usuário - memoizada
  const fetchRecentActivities = useCallback(async (limit: number = 10) => {
    if (!user) {
      console.log('🔍 useUserActivity: Usuário não autenticado');
      setLoading(false);
      return;
    }

    try {
      console.log('📋 useUserActivity: Buscando atividades recentes do usuário:', user.id);
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_activity_log')
        .select(`
          id,
          user_id,
          audio_id,
          activity_type,
          duration_listened,
          completed,
          created_at,
          audio:audios(
            id,
            title,
            subtitle,
            description,
            cover_url,
            duration,
            category_id,
            created_at,
            category:categories(
              id,
              name,
              image_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        console.warn('❌ useUserActivity: Erro ao buscar atividades (tratado):', fetchError);
        setError('Erro ao carregar atividades');
        return;
      }

      console.log('✅ useUserActivity: Atividades carregadas:', data?.length || 0);
      setActivities((data || []) as unknown as UserActivity[]);
    } catch (err) {
      console.error('💥 useUserActivity: Erro inesperado:', err);
      setError('Erro inesperado ao carregar atividades');
    } finally {
      setLoading(false);
    }
  }, [user]); // Dependência apenas do user

  // Registrar nova atividade
  const logActivity = async (activityData: ActivityInput): Promise<boolean> => {
    if (!user) {
      console.log('⚠️ useUserActivity: Tentativa de registrar atividade sem usuário');
      return false;
    }

    try {
      console.log('📝 useUserActivity: Registrando atividade:', activityData);

      const { error } = await supabase
        .from('user_activity_log')
        .insert({
          user_id: user.id,
          audio_id: activityData.audio_id,
          activity_type: activityData.activity_type || 'play',
          duration_listened: activityData.duration_listened || 0,
          completed: activityData.completed || false
        });

      if (error) {
        console.warn('❌ useUserActivity: Erro ao registrar atividade (tratado):', error);
        return false;
      }

      console.log('✅ useUserActivity: Atividade registrada com sucesso');
      
      // Recarregar atividades
      await fetchRecentActivities();
      
      return true;
    } catch (err) {
      console.error('💥 useUserActivity: Erro ao registrar atividade:', err);
      return false;
    }
  };

  // Formatar data relativa (hoje, ontem, etc.) - memoizada
  const formatRelativeDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Agora há pouco';
    } else if (diffInHours < 24) {
      return `Há ${diffInHours}h`;
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `Há ${diffInDays} dias`;
    }
  }, []);

  // Formatar hora - memoizada
  const formatTime = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);

  // Carregar atividades quando usuário mudar
  useEffect(() => {
    fetchRecentActivities();
  }, [fetchRecentActivities]);

  return {
    activities,
    loading,
    error,
    logActivity,
    formatRelativeDate,
    formatTime,
    refetch: fetchRecentActivities
  };
}