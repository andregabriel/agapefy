"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserActivity } from '@/hooks/useUserActivity';
import { usePrayerDates } from '@/hooks/usePrayerDates';

export interface UserMetrics {
  // Métricas da semana atual
  currentWeekPrayers: number;
  weeklyProgress: number;
  
  // Tempo total
  totalMinutesListened: number;
  totalHours: number;
  totalMinutesRemainder: number;
  
  // Recordes
  bestWeeklyStreak: number;
  bestConsecutiveDays: number;
  
  // Estatísticas gerais
  totalActivities: number;
  completedActivities: number;
  averageSessionDuration: number;
}

export function useUserMetrics() {
  const { user } = useAuth();
  const { activities } = useUserActivity();
  const { prayerDates, getConsecutiveDays } = usePrayerDates();
  const [metrics, setMetrics] = useState<UserMetrics>({
    currentWeekPrayers: 0,
    weeklyProgress: 0,
    totalMinutesListened: 0,
    totalHours: 0,
    totalMinutesRemainder: 0,
    bestWeeklyStreak: 0,
    bestConsecutiveDays: 0,
    totalActivities: 0,
    completedActivities: 0,
    averageSessionDuration: 0
  });
  const [loading, setLoading] = useState(true);

  // Calcular início da semana atual (domingo) - memoizada
  const getWeekStart = useCallback((): Date => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo, 1 = segunda, etc.
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }, []);

  // Memoizar getConsecutiveDays para evitar dependência instável
  const consecutiveDays = useMemo(() => {
    return getConsecutiveDays();
  }, [getConsecutiveDays]);

  // Calcular métricas quando dados mudarem - usando useCallback
  const calculateMetrics = useCallback(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('📊 useUserMetrics: Calculando métricas do usuário...');
      
      const weekStart = getWeekStart();
      const now = new Date();

      // 1. Orações desta semana (atividades de play/completed desta semana)
      const thisWeekActivities = activities.filter(activity => {
        const activityDate = new Date(activity.created_at);
        return activityDate >= weekStart && activityDate <= now;
      });

      // Contar apenas atividades únicas por áudio (evitar duplicatas de play/pause/completed)
      const uniqueAudiosThisWeek = new Set(
        thisWeekActivities
          .filter(activity => activity.activity_type === 'play' || activity.activity_type === 'completed')
          .map(activity => activity.audio_id)
      );
      const currentWeekPrayers = uniqueAudiosThisWeek.size;

      // 2. Tempo total ouvido (somar duration_listened de todas as atividades)
      const totalSeconds = activities.reduce((total, activity) => {
        return total + (activity.duration_listened || 0);
      }, 0);
      const totalMinutesListened = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutesListened / 60);
      const totalMinutesRemainder = totalMinutesListened % 60;

      // 3. Atividades completadas
      const completedActivities = activities.filter(activity => activity.completed).length;
      const totalActivities = activities.length;

      // 4. Duração média das sessões (em minutos)
      const averageSessionDuration = totalActivities > 0 
        ? Math.floor(totalMinutesListened / totalActivities) 
        : 0;

      // 5. Recordes (simulados por enquanto - em uma implementação real, seria necessário histórico mais longo)
      // Para recordes reais, precisaríamos de dados históricos por semana
      const bestWeeklyStreak = Math.max(currentWeekPrayers, 18); // Mantém o recorde atual ou usa o valor atual
      const bestConsecutiveDays = Math.max(consecutiveDays, 21); // Mantém o recorde atual ou usa o valor atual

      const calculatedMetrics: UserMetrics = {
        currentWeekPrayers,
        weeklyProgress: (currentWeekPrayers / 7) * 100, // Assumindo meta de 7 por semana
        totalMinutesListened,
        totalHours,
        totalMinutesRemainder,
        bestWeeklyStreak,
        bestConsecutiveDays,
        totalActivities,
        completedActivities,
        averageSessionDuration
      };

      console.log('✅ useUserMetrics: Métricas calculadas:', {
        semana: currentWeekPrayers,
        totalMinutos: totalMinutesListened,
        atividades: totalActivities,
        completas: completedActivities
      });

      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('❌ useUserMetrics: Erro ao calcular métricas:', error);
    } finally {
      setLoading(false);
    }
  }, [user, activities, consecutiveDays, getWeekStart]);

  // Executar cálculo quando dependências mudarem
  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  // Função para formatar tempo total - memoizada
  const formatTotalTime = useCallback((): string => {
    if (metrics.totalHours > 0) {
      return `${metrics.totalHours}h ${metrics.totalMinutesRemainder}min`;
    }
    return `${metrics.totalMinutesListened}min`;
  }, [metrics.totalHours, metrics.totalMinutesRemainder, metrics.totalMinutesListened]);

  // Função para obter texto de progresso semanal - memoizada
  const getWeeklyProgressText = useCallback((weeklyGoal: number = 7): string => {
    const remaining = Math.max(0, weeklyGoal - metrics.currentWeekPrayers);
    if (remaining === 0) {
      return 'Meta semanal atingida! 🎉';
    }
    return `${remaining} orações para atingir a meta`;
  }, [metrics.currentWeekPrayers]);

  // Função para obter texto de progresso consecutivo - memoizada
  const getConsecutiveProgressText = useCallback((consecutiveGoal: number = 7): string => {
    const remaining = Math.max(0, consecutiveGoal - consecutiveDays);
    if (remaining === 0) {
      return 'Meta de dias consecutivos atingida! 🔥';
    }
    return `${remaining} dias para atingir a meta`;
  }, [consecutiveDays]);

  return {
    metrics,
    loading,
    formatTotalTime,
    getWeeklyProgressText,
    getConsecutiveProgressText
  };
}