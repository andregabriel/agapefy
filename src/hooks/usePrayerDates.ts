"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface PrayerDate {
  id: string;
  user_id: string;
  prayer_date: string; // formato YYYY-MM-DD
  created_at: string;
}

export function usePrayerDates() {
  const { user } = useAuth();
  const [prayerDates, setPrayerDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar datas de oração do usuário - memoizada
  const fetchPrayerDates = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('📅 Buscando datas de oração do usuário:', user.id);
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_prayer_dates')
        .select('prayer_date')
        .eq('user_id', user.id)
        .order('prayer_date', { ascending: false });

      if (fetchError) {
        console.error('❌ Erro ao buscar datas de oração:', fetchError);
        setError('Erro ao carregar datas de oração');
      } else {
        console.log('✅ Datas de oração encontradas:', data?.length || 0);
        
        // Converter strings de data para objetos Date
        const dates = data?.map(item => new Date(item.prayer_date)) || [];
        setPrayerDates(dates);
      }
    } catch (err) {
      console.error('💥 Erro inesperado ao buscar datas:', err);
      setError('Erro inesperado ao carregar datas');
    } finally {
      setLoading(false);
    }
  }, [user]); // Dependência apenas do user

  // Adicionar data de oração (quando usuário ora)
  const addPrayerDate = async (date: Date) => {
    if (!user) return false;

    try {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('➕ Adicionando data de oração:', dateString);

      const { error: insertError } = await supabase
        .from('user_prayer_dates')
        .insert({
          user_id: user.id,
          prayer_date: dateString
        });

      if (insertError) {
        // Se for erro de duplicata, não é problema
        if (insertError.code === '23505') {
          console.log('📝 Data já registrada:', dateString);
          return true;
        }
        
        console.error('❌ Erro ao adicionar data de oração:', insertError);
        setError('Erro ao registrar data de oração');
        return false;
      }

      console.log('✅ Data de oração adicionada:', dateString);
      
      // Atualizar lista local
      setPrayerDates(prev => {
        const newDate = new Date(dateString);
        const exists = prev.some(d => d.toDateString() === newDate.toDateString());
        if (!exists) {
          return [...prev, newDate].sort((a, b) => b.getTime() - a.getTime());
        }
        return prev;
      });

      return true;
    } catch (err) {
      console.error('💥 Erro ao adicionar data de oração:', err);
      setError('Erro inesperado ao registrar data');
      return false;
    }
  };

  // Verificar se uma data específica tem oração registrada - memoizada
  const hasPrayerOnDate = useCallback((date: Date): boolean => {
    return prayerDates.some(prayerDate => 
      prayerDate.toDateString() === date.toDateString()
    );
  }, [prayerDates]);

  // Obter estatísticas de dias consecutivos - memoizada
  const getConsecutiveDays = useCallback((): number => {
    if (prayerDates.length === 0) return 0;

    const sortedDates = [...prayerDates].sort((a, b) => b.getTime() - a.getTime());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let consecutiveDays = 0;
    let currentDate = new Date(today);

    // Verificar se orou hoje ou ontem (para não quebrar sequência)
    const latestPrayer = sortedDates[0];
    const daysDiff = Math.floor((today.getTime() - latestPrayer.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 1) {
      return 0; // Sequência quebrada
    }

    // Se não orou hoje, começar de ontem
    if (daysDiff === 1) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Contar dias consecutivos
    for (const prayerDate of sortedDates) {
      const prayerDay = new Date(prayerDate);
      prayerDay.setHours(0, 0, 0, 0);

      if (prayerDay.getTime() === currentDate.getTime()) {
        consecutiveDays++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return consecutiveDays;
  }, [prayerDates]);

  // Carregar datas quando o usuário mudar
  useEffect(() => {
    fetchPrayerDates();
  }, [fetchPrayerDates]);

  return {
    prayerDates,
    loading,
    error,
    addPrayerDate,
    hasPrayerOnDate,
    getConsecutiveDays,
    refetch: fetchPrayerDates
  };
}