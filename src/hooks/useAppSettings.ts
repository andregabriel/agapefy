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
  // Regras de assistentes do WhatsApp (JSON string: AssistantConfig)
  whatsapp_assistant_rules?: string;
  // Lista global de nomes para "Objetivos espirituais" (string JSON: string[])
  spiritual_goals?: string;
  // Prompts por campo do GManual (string)
  gmanual_title_prompt?: string;
  gmanual_subtitle_prompt?: string;
  gmanual_description_prompt?: string; // para audio_description
  gmanual_preparation_prompt?: string;
  gmanual_text_prompt?: string; // para prayer_text
  gmanual_final_message_prompt?: string;
  gmanual_image_prompt_prompt?: string; // para prompt da imagem (thumbnail)
  // Template usado para enviar ao DALL‑E (padrão e ativo)
  gmanual_image_generate_template?: string;
  gmanual_auto_pauses_prompt?: string;
  gmanual_pauses_auto_enabled?: string;
  gmanual_pause_comma?: string;
  gmanual_pause_period?: string;
  gmanual_pause_before_prayer?: string;
  gmanual_pause_after_prayer?: string;
  // WhatsApp (Biblicus)
  whatsapp_biblicus_number?: string; // número destino para CTA (somente dígitos, ex: 5569920018597)
  whatsapp_welcome_message?: string; // mensagem de boas-vindas enviada pelo BW
  whatsapp_send_welcome_enabled?: string; // 'true' | 'false' — controla envio de boas-vindas
  whatsapp_menu_message?: string; // mensagem de menu inicial e lembretes
  // Config per-intenção do BW
  bw_intents_config?: string; // JSON string: { [intention]: { enabled: boolean, prompt?: string } }
  // Comandos curtos por intenção (atalhos)
  bw_short_commands?: string; // JSON string: { [intention]: string[] }
  // Mensagem de espera para conversa geral
  bw_waiting_message?: string; // Texto enviado imediatamente na intenção general_conversation
  // Novos campos para controle da frase bíblica
  prayer_quote_position?: string; // índice 0-based (string para compatibilidade com app_settings)
  prayer_quote_auto_enabled?: string; // 'true' | 'false'
  prayer_quote_auto_time?: string; // formato HH:mm (tz local do app)
  prayer_quote_ai_enabled?: string; // 'true' | 'false' - seleção via OpenAI
  prayer_quote_ai_prompt_template?: string; // prompt base editável pelo admin
  prayer_quote_last_verse_id?: string;
  prayer_quote_last_updated_at?: string; // ISO
  prayer_quote_history?: string; // JSON string: [{verse_id,date}]
  // Lista de motores de IA para geração de áudio (string JSON: string[])
  audio_ai_engines?: string;
  // Onboarding texts
  onboarding_step2_title?: string;
  onboarding_step2_subtitle?: string;
  onboarding_step3_title?: string;
  // Onboarding step 4 (WhatsApp) texts
  onboarding_step4_section_title?: string;
  onboarding_step4_instruction?: string;
  onboarding_step4_label?: string;
  onboarding_step4_privacy_text?: string;
  onboarding_step4_skip_button?: string;
  onboarding_step4_complete_button?: string;
  // Onboarding step active controls
  onboarding_static_preview_active?: string;
  onboarding_static_whatsapp_active?: string;
  onboarding_hardcoded_6_active?: string;
  onboarding_hardcoded_7_active?: string;
  onboarding_hardcoded_8_active?: string;
  // Onboarding step positions
  onboarding_static_preview_position?: string;
  onboarding_static_whatsapp_position?: string;
  onboarding_hardcoded_6_position?: string;
  onboarding_hardcoded_7_position?: string;
  onboarding_hardcoded_8_position?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  prayer_quote_text: '"Onde dois ou três estiverem reunidos em meu nome, ali estou eu no meio deles."',
  prayer_quote_reference: 'Mateus 18:20',
  show_prayer_stats: 'true',
  logo_url: '',
  whatsapp_assistant_rules: '',
  spiritual_goals: '[]',
  // Prompts padrão do GManual (PT-BR, reverente e objetivos claros)
  gmanual_title_prompt: 'Escreva um título curto (máximo 60 caracteres), claro e inspirador, adequado para uma oração cristã brasileira. Use linguagem simples e reverente. Retorne apenas o título, sem aspas.',
  gmanual_subtitle_prompt: 'Escreva um subtítulo (máximo 100 caracteres) que complemente o título com leveza e clareza, em tom reverente, sem repetir o título. Apenas o subtítulo, sem aspas.',
  gmanual_description_prompt: 'Escreva 1–2 frases breves que descrevam o áudio da oração para uma lista de conteúdos (tom convidativo, claro e respeitoso). Evite emojis e hashtags. Retorne apenas o texto.',
  gmanual_preparation_prompt: 'Escreva 1–3 frases curtas de preparação para o momento de oração, guiando a pessoa a se aquietar e focar em Deus (tom acolhedor e reverente).',
  gmanual_text_prompt: 'Escreva o texto completo da oração (100–300 palavras), com estrutura tradicional: invocação, petição/gratidão e conclusão. Linguagem reverente, clara e próxima do brasileiro. Não use citações diretas extensas.',
  gmanual_final_message_prompt: 'Escreva 1–2 frases de encerramento curtas que abençoem e encorajem a continuidade da vida de oração. Apenas o texto.',
  gmanual_image_prompt_prompt: 'Escreva uma descrição detalhada, vívida e objetiva em português para gerar uma imagem relacionada a esta oração, incluindo elementos de ambiente, luz, composição, expressões e emoções. Evite nomes próprios e texto na imagem. Mínimo 20 caracteres. Retorne apenas a descrição.',
  // Template ativo para geração de imagem (DALL‑E)
  gmanual_image_generate_template: '{imagem_descricao}',
  // WhatsApp (default de produção informado pelo admin)
  whatsapp_biblicus_number: '5569920018597',
  whatsapp_welcome_message: '📖 Olá! Eu sou o Biblicus\n\nUm assistente virtual da Agapefy para te acompanhar na sua jornada espiritual. ✨\n\n🙌 O que posso fazer:\n\n• Obter respostas baseadas na Bíblia\n• Enviar versículos diariamente\n• Lembrar você dos horários de oração\n• Montar orações personalizadas para você\n\n💬 Comandos disponíveis:\n\n• **/conversa** – Tire dúvidas e converse sobre a Bíblia\n• **/versículos** – Receba mensagens com passagens todos os dias\n• **/lembretes** – Ative lembretes nos horários de oração\n• **/oração** – Tenha uma oração feita especialmente para você\n\n✨ Como usar:\nCadastre seu número de WhatsApp e comece a conversar comigo. Você poderá enviar mensagens e receber respostas, versículos, lembretes e orações diretamente no seu celular.\n\n🚀 Pronto para começar?',
  whatsapp_send_welcome_enabled: 'true',
  whatsapp_menu_message: '1️⃣ Respostas baseadas na Bíblia (envie: biblia)\n2️⃣ Receber Versículo diariamente (envie: versículo)\n3️⃣ Buscar orações no app Agapefy (envie: buscar)',
  // Intents config padrão (string JSON) — modo simplificado com 3 intenções
  bw_intents_config: JSON.stringify({
    general_conversation: { enabled: true, engine: 'prompt' },
    daily_verse: { enabled: true, prompt: '' },
    prayer_request: { enabled: true }
  }),
  bw_short_commands: JSON.stringify({
    general_conversation: ["biblia"],
    daily_verse: ["versículo", "/versiculo", "versículo do dia"],
    prayer_request: ["buscar", "oração", "oracao"]
  }),
  bw_waiting_message: '',
  // Defaults novos
  prayer_quote_position: '0',
  prayer_quote_auto_enabled: 'true',
  prayer_quote_auto_time: '07:00',
  prayer_quote_ai_enabled: 'false',
  prayer_quote_ai_prompt_template: `Você é um curador bíblico. Escolha um único versículo da Bíblia que seja claro, edificante, compreensível para leigos e autocontido. Evite genealogias, leis rituais, profecias e visões enigmáticas ou trechos violentos/duros sem contexto. Prefira trechos que transmitam esperança, encorajamento, sabedoria prática ou conforto. Não repita nenhum dos últimos 30 versículos informados.`,
  prayer_quote_last_verse_id: '',
  prayer_quote_last_updated_at: '',
  prayer_quote_history: '[]'
  ,
  // Lista padrão com pelo menos um motor conhecido
  audio_ai_engines: JSON.stringify(["ElevenLabs", "OpenAI Audio"]) 
  ,
  // Onboarding defaults
  onboarding_step2_title: 'Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil.',
  onboarding_step2_subtitle: 'Sua playlist foi criada, em breve você poderá escutar essas orações.',
  onboarding_step3_title: 'Conecte seu WhatsApp para receber uma mensagem diária para {category}.',
  // Onboarding step 4 (WhatsApp) defaults
  onboarding_step4_section_title: 'Configuração do WhatsApp',
  onboarding_step4_instruction: 'Informe seu número com DDD. Exemplo: +55 11 99999-9999',
  onboarding_step4_label: 'Número do WhatsApp',
  onboarding_step4_privacy_text: 'seu número será usado apenas para enviar/receber mensagens.',
  onboarding_step4_skip_button: 'Pular',
  onboarding_step4_complete_button: 'Concluir',
  // Onboarding step active controls (default: true)
  onboarding_static_preview_active: 'true',
  onboarding_static_whatsapp_active: 'true',
  onboarding_hardcoded_6_active: 'true',
  onboarding_hardcoded_7_active: 'true',
  onboarding_hardcoded_8_active: 'true',
  // Onboarding step positions (default baselines)
  onboarding_static_preview_position: '2',
  onboarding_static_whatsapp_position: '3',
  onboarding_hardcoded_6_position: '6',
  onboarding_hardcoded_7_position: '7',
  onboarding_hardcoded_8_position: '8',
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