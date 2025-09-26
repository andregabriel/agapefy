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
  // WhatsApp (Biblicus)
  whatsapp_biblicus_number?: string; // número destino para CTA (somente dígitos, ex: 5569920018597)
  // Novos campos para controle da frase bíblica
  prayer_quote_position?: string; // índice 0-based (string para compatibilidade com app_settings)
  prayer_quote_auto_enabled?: string; // 'true' | 'false'
  prayer_quote_auto_time?: string; // formato HH:mm (tz local do app)
  prayer_quote_ai_enabled?: string; // 'true' | 'false' - seleção via OpenAI
  prayer_quote_ai_prompt_template?: string; // prompt base editável pelo admin
  prayer_quote_last_verse_id?: string;
  prayer_quote_last_updated_at?: string; // ISO
  prayer_quote_history?: string; // JSON string: [{verse_id,date}]
}

const DEFAULT_SETTINGS: AppSettings = {
  prayer_quote_text: '"Onde dois ou três estiverem reunidos em meu nome, ali estou eu no meio deles."',
  prayer_quote_reference: 'Mateus 18:20',
  show_prayer_stats: 'true',
  logo_url: '',
  // WhatsApp (default de produção informado pelo admin)
  whatsapp_biblicus_number: '5569920018597',
  // Defaults novos
  prayer_quote_position: '0',
  prayer_quote_auto_enabled: 'true',
  prayer_quote_auto_time: '07:00',
  prayer_quote_ai_enabled: 'false',
  prayer_quote_ai_prompt_template: `Você é um curador bíblico. Escolha um único versículo da Bíblia que seja claro, edificante, compreensível para leigos e autocontido. Evite genealogias, leis rituais, profecias e visões enigmáticas ou trechos violentos/duros sem contexto. Prefira trechos que transmitam esperança, encorajamento, sabedoria prática ou conforto. Não repita nenhum dos últimos 30 versículos informados.`,
  prayer_quote_last_verse_id: '',
  prayer_quote_last_updated_at: '',
  prayer_quote_history: '[]'
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