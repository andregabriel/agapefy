import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AppSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
  type: string;
  created_at: string;
  updated_at: string;
}

interface AppSettings {
  prayer_quote_text: string;
  prayer_quote_reference: string;
  show_prayer_stats: string;
  logo_url: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  prayer_quote_text: '"Onde dois ou três estiverem reunidos em meu nome, ali estou eu no meio deles."',
  prayer_quote_reference: 'Mateus 18:20',
  show_prayer_stats: 'true',
  logo_url: ''
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      console.log('🔄 useAppSettings: Buscando configurações...');
      
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) {
        console.error('❌ useAppSettings: Erro na query:', error);
        throw error;
      }

      console.log('📊 useAppSettings: Dados brutos do banco:', data);

      // Converter array para objeto com fallbacks
      const settingsObj: AppSettings = { ...DEFAULT_SETTINGS };
      
      data?.forEach((setting: AppSetting) => {
        if (setting.key in settingsObj) {
          (settingsObj as any)[setting.key] = setting.value;
          console.log(`✅ useAppSettings: Configuração carregada - ${setting.key}: ${setting.value}`);
        }
      });

      console.log('🎯 useAppSettings: Configurações finais:', settingsObj);
      setSettings(settingsObj);
    } catch (err) {
      console.error('❌ useAppSettings: Erro ao buscar configurações:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      // Manter configurações padrão em caso de erro
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: string) => {
    try {
      console.log(`🔄 useAppSettings: Atualizando ${key} = ${value}`);
      
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key,
          value,
          type: 'text'
        }, {
          onConflict: 'key'
        });

      if (error) {
        console.error('❌ useAppSettings: Erro ao atualizar:', error);
        throw error;
      }

      // Atualizar estado local
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));

      console.log(`✅ useAppSettings: ${key} atualizado com sucesso`);
      return { success: true };
    } catch (err) {
      console.error('❌ useAppSettings: Erro ao atualizar configuração:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Erro desconhecido' 
      };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    updateSetting,
    refetch: fetchSettings
  };
}