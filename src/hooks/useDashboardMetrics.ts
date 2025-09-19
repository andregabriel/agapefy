"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserActivity } from '@/hooks/useUserActivity';
import { usePrayerDates } from '@/hooks/usePrayerDates';

export interface DashboardMetrics {
  currentWeekPrayers: number;
  totalMinutesListened: number;
  recordWeeklyPrayers: number;
  recordConsecutiveDays: number;
  thisWeekProgress: number;
  totalHours: number;
  totalMinutesRemainder: number;
}

export function useDashboardMetrics() {
  const { user } = useAuth();
  const { activities } = useUserActivity();
  const { getConsecutiveDays } = usePrayerDates();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    currentWeekPrayers: 0,
    totalMinutesListened: 0,
    recordWeeklyPrayers: 0,
    recordConsecutiveDays: 0,
    thisWeekProgress: 0,
    totalHours: 0,
    totalMinutesRemainder: 0
  });
  const [loading, setLoading] = useState(true);

  // Calcular métricas a partir das atividades
  const calculateMetrics = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('📊 Calculando métricas do dashboard...');
      setLoading(true);

      // Buscar todas as atividades do usuário para cálculos históricos
      const { data: allActivities, error } = await supabase
        .from('user_activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar atividades para métricas:', error);
        return;
      }

      const now = new Date();
      
      // Calcular início da semana atual (domingo)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // Filtrar atividades desta semana
      const thisWeekActivities = allActivities?.filter(activity => {
        const activityDate = new Date(activity.created_at);
        return activityDate >= startOfWeek;
      }) || [];

      // Contar orações únicas desta semana (por dia)
      const thisWeekDays = new Set();
      thisWeekActivities.forEach(activity => {
        const activityDate = new Date(activity.created_at);
        const dayKey = activityDate.toDateString();
        thisWeekDays.add(dayKey);
      });
      const currentWeekPrayers = thisWeekDays.size;

      // Calcular tempo total ouvido (em segundos)
      const totalSecondsListened = allActivities?.reduce((total, activity) => {
        return total + (activity.duration_listened || 0);
      }, 0) || 0;

      const totalMinutesListened = Math.floor(totalSecondsListened / 60);
      const totalHours = Math.floor(totalMinutesListened / 60);
      const totalMinutesRemainder = totalMinutesListened % 60;

      // Calcular recordes
      let recordWeeklyPrayers = 0;
      let recordConsecutiveDays = getConsecutiveDays();

      // Calcular recorde semanal (últimas 12 semanas)
      for (let weekOffset = 0; weekOffset < 12; weekOffset++) {
        const weekStart = new Date(startOfWeek);
        weekStart.setDate(startOfWeek.getDate() - (weekOffset * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekActivities = allActivities?.filter(activity => {
          const activityDate = new Date(activity.created_at);
          return activityDate >= weekStart && activityDate <= weekEnd;
        }) || [];

        const weekDays = new Set();
        weekActivities.forEach(activity => {
          const activityDate = new Date(activity.created_at);
          const dayKey = activityDate.toDateString();
          weekDays.add(dayKey);
        });

        recordWeeklyPrayers = Math.max(recordWeeklyPrayers, weekDays.size);
      }

      // Buscar recorde histórico de dias consecutivos
      try {
        const { data: prayerDates } = await supabase
          .from('user_prayer_dates')
          .select('prayer_date')
          .eq('user_id', user.id)
          .order('prayer_date', { ascending: true });

        if (prayerDates && prayerDates.length > 0) {
          let maxConsecutive = 1;
          let currentConsecutive = 1;

          for (let i = 1; i < prayerDates.length; i++) {
            const prevDate = new Date(prayerDates[i - 1].prayer_date);
            const currentDate = new Date(prayerDates[i].prayer_date);
            const diffDays = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              currentConsecutive++;
              maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
              currentConsecutive = 1;
            }
          }

          recordConsecutiveDays = Math.max(recordConsecutiveDays, maxConsecutive);
        }
      } catch (error) {
        console.error('❌ Erro ao calcular recorde de dias consecutivos:', error);
      }

      const newMetrics: DashboardMetrics = {
        currentWeekPrayers,
        totalMinutesListened,
        recordWeeklyPrayers: Math.max(recordWeeklyPrayers, currentWeekPrayers),
        recordConsecutiveDays,
        thisWeekProgress: (currentWeekPrayers / 7) * 100, // Assumindo meta de 7 dias
        totalHours,
        totalMinutesRemainder
      };

      console.log('✅ Métricas calculadas:', newMetrics);
      setMetrics(newMetrics);

    } catch (error) {
      console.error('💥 Erro ao calcular métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Recalcular quando atividades mudarem
  useEffect(() => {
    calculateMetrics();
  }, [user, activities]);

  // Função para formatar tempo total
  const formatTotalTime = (): string => {
    if (metrics.totalHours > 0) {
      return `${metrics.totalHours}h ${metrics.totalMinutesRemainder}min`;
    }
    return `${metrics.totalMinutesListened}min`;
  };

  // Função para obter texto de progresso semanal
  const getWeeklyProgressText = (weeklyGoal: number): string => {
    const remaining = Math.max(0, weeklyGoal - metrics.currentWeekPrayers);
    if (remaining === 0) {
      return 'Meta semanal atingida! 🎉';
    }
    return `${remaining} ${remaining === 1 ? 'oração' : 'orações'} para atingir a meta`;
  };

  return {
    metrics,
    loading,
    formatTotalTime,
    getWeeklyProgressText,
    refetch: calculateMetrics
  };
}