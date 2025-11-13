import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ZAPI_INSTANCE_NAME = (process.env.ZAPI_INSTANCE_NAME as string) || "3E60EE9AC55FD0C647E46EB3E4757B57";
const ZAPI_TOKEN = (process.env.ZAPI_TOKEN as string) || "9F677316F38A3D2FA08EEB09";
const ZAPI_CLIENT_TOKEN = (process.env.ZAPI_CLIENT_TOKEN as string) || "F3adb78efb3ba40888e8c090e6b90aea4S";
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Webhook RECEIVE recebido:', JSON.stringify(body, null, 2));

    // Normalizar campos do Z-API: pode vir como body.message.* (testes) ou body.text.message (produção)
    const userPhoneRaw = body.phone || body.remoteJid || body.chatId || '';
    const userPhone = typeof userPhoneRaw === 'string' ? userPhoneRaw.replace(/\D/g, '') : '';
    const messageContent = (
                          body.message?.conversation || 
                          body.message?.text || 
                          body.message?.extendedTextMessage?.text || 
                          body.message?.imageMessage?.caption ||
                          body.text?.message ||
                          (typeof body.text === 'string' ? body.text : '') ||
                          ''
                        ) as string;
    const userName = body.senderName || body.pushName || body.chatName || 'Irmão(ã)';

    // Validar se é uma mensagem válida e não é nossa própria mensagem
    if (!userPhone || !messageContent || body.fromMe) {
      console.log('❌ Mensagem ignorada - critérios não atendidos');
      return NextResponse.json({ status: 'ignored', reason: 'invalid_message' });
    }

    console.log(`📱 Processando mensagem de ${userName} (${userPhone}): "${messageContent}"`);

    if (!messageContent.trim()) {
      console.log('❌ Mensagem vazia ignorada');
      return NextResponse.json({ status: 'ignored', reason: 'empty_message' });
    }

    // Registrar usuário no banco
    console.log('👤 Registrando usuário...');
    await supabase.from('whatsapp_users').upsert({
      phone_number: userPhone,
      name: userName,
      is_active: true,
      receives_daily_verse: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });

    // Carregar configurações úteis (boas-vindas, menu)
    // NOTA: NÃO carregar bw_waiting_message - foi completamente removida
    const settingsRows = await supabase.from('app_settings').select('key,value').in('key', [
      'whatsapp_send_welcome_enabled',
      'whatsapp_welcome_message',
      'whatsapp_menu_message',
      'bw_intents_config',
      'bw_short_commands'
    ]);
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows.data || []) settingsMap[r.key] = r.value as string;
    // Garantir que bw_waiting_message não seja usado mesmo se estiver no banco
    delete settingsMap['bw_waiting_message'];

    // Verificar primeiro contato
    const { count: prevCount } = await supabase
      .from('whatsapp_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_phone', userPhone);

    // Detectar rapidamente a intenção (sem enviar mensagem de espera)
    const quickTriggers: Record<string, string[]> = (() => {
      if (settingsMap && typeof settingsMap['bw_short_commands'] === 'string') {
        try { return JSON.parse(settingsMap['bw_short_commands']); } catch { return {}; }
      }
      return {};
    })();
    let quickIntent = detectIntention(messageContent, quickTriggers);
    const intentsCfgQuick = settingsMap && settingsMap['bw_intents_config']
      ? (() => { try { return JSON.parse(settingsMap['bw_intents_config']); } catch { return {}; } })()
      : {};
    const quickCfg = intentsCfgQuick[quickIntent] || {};
    if (quickCfg && quickCfg.enabled === false) quickIntent = 'general_conversation';

    // NOTA: Mensagem de espera (bw_waiting_message) foi completamente removida
    // Não enviar nenhuma mensagem antes da resposta principal

    // Gerar resposta inteligente com IA
    console.log('🤖 Gerando resposta inteligente...');
    const response = await generateIntelligentResponse(request, messageContent, userName, userPhone, settingsMap);
    console.log(`💬 Resposta gerada: "${response}"`);

    // Salvar conversa no banco
    console.log('💾 Salvando conversa...');
    await supabase.from('whatsapp_conversations').insert({
      user_phone: userPhone,
      conversation_type: detectConversationType(messageContent),
      message_content: messageContent,
      response_content: response,
      message_type: 'text'
    });

    // Enviar resposta principal via Z-API
    console.log('📤 Enviando resposta via Z-API...');
    const sendResult = await sendWhatsAppMessage(userPhone, response);
    
    if (sendResult.success) {
      console.log('✅ Mensagem enviada com sucesso!');
    } else {
      console.error('❌ Erro ao enviar mensagem:', sendResult.error);
    }

    // Se for primeiro contato e boas-vindas estiver ativada, enviar a mensagem de boas-vindas + menu
    const sendWelcome = (settingsMap['whatsapp_send_welcome_enabled'] ?? 'true') === 'true';
    const welcomeText = settingsMap['whatsapp_welcome_message'] || '';
    const menuText = settingsMap['whatsapp_menu_message'] || '';
    if ((prevCount || 0) === 0 && sendWelcome) {
      const welcomeMsg = [welcomeText, menuText].filter(Boolean).join('\n\n');
      if (welcomeMsg.trim()) {
        await sendWhatsAppMessage(userPhone, welcomeMsg);
      }
    }

    // Lembrete a cada 5 mensagens do usuário
    const { count: convCount } = await supabase
      .from('whatsapp_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_phone', userPhone);
    if ((convCount || 0) > 0 && (convCount as number) % 5 === 0 && menuText) {
      await sendWhatsAppMessage(userPhone, menuText);
    }

    return NextResponse.json({ 
      status: 'success', 
      message: 'Mensagem processada com sucesso',
      response: response,
      user: userName,
      phone: userPhone,
      message_sent: sendResult.success,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro no webhook receive:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function generateIntelligentResponse(request: NextRequest, message: string, userName: string, userPhone: string, settingsMap?: Record<string,string>): Promise<string> {
  try {
    console.log('🧠 Iniciando geração de resposta IA...');
    
    // Verificar chave OpenAI
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('❌ Chave OpenAI não configurada');
      return getDefaultResponse(message, userName);
    }

    // Detectar intenção da mensagem
    // Build triggers from config/short-commands
    const triggersMap: Record<string, string[]> = (() => {
      if (settingsMap && typeof settingsMap['bw_short_commands'] === 'string') {
        try { return JSON.parse(settingsMap['bw_short_commands']); } catch { return {}; }
      }
      return {};
    })();
    let intention = detectIntention(message, triggersMap);
    // Tentar aplicar atalhos configurados pelo admin
    const sc = (settingsMap && settingsMap['bw_short_commands']) ? {} as any : await loadShortCommands();
    // Preferir mapa vindo do carregamento inicial (se fornecido)
    const shortCommands = (() => {
      if (settingsMap && typeof settingsMap['bw_short_commands'] === 'string') {
        try { return JSON.parse(settingsMap['bw_short_commands']); } catch { return {}; }
      }
      return sc;
    })();
    const matched = matchShortCommand(shortCommands, message);
    if (matched) {
      intention = matched;
    }
    console.log(`🎯 Intenção detectada: ${intention}`);
    
    // Buscar histórico de conversas recentes
    const { data: conversationHistory } = await supabase
      .from('whatsapp_conversations')
      .select('message_content, response_content')
      .eq('user_phone', userPhone)
      .order('created_at', { ascending: false })
      .limit(3);

    // Ler configuração por intenção do app_settings (se existir)
    const intentsConfig = settingsMap && settingsMap['bw_intents_config']
      ? (() => { try { return JSON.parse(settingsMap['bw_intents_config']); } catch { return {}; } })()
      : await loadIntentsConfig();
    const currentIntentCfg = intentsConfig[intention] || {};
    if (currentIntentCfg && currentIntentCfg.enabled === false) {
      // Intenção desativada: cair para conversa geral
      intention = 'general_conversation';
    }

    // Fluxos especiais
    // 1) Toggle de versículo diário
    if (intention === 'daily_verse') {
      const lower = message.toLowerCase();
      const enable = /(ativar|ligar|começar|inscrever|quero receber)/.test(lower);
      const disable = /(parar|desativar|cancelar|remover|não quero|nao quero)/.test(lower);
      if (enable || disable) {
        await supabase
          .from('whatsapp_users')
          .update({ receives_daily_verse: enable, updated_at: new Date().toISOString() })
          .eq('phone_number', userPhone);
        const onMsg = (currentIntentCfg.messages?.confirm_on as string) || '✅ Versículo diário ativado. Você começará a receber todos os dias.';
        const offMsg = (currentIntentCfg.messages?.confirm_off as string) || '❌ Versículo diário desativado. Você pode ativar quando quiser.';
        return enable ? onMsg : offMsg;
      }
      // Nenhuma ação explícita: instruir
      return (currentIntentCfg.messages?.help as string) || 'Para receber o versículo do dia, envie: "ativar versículo diário". Para parar, envie: "parar versículo diário".';
    }

    // 2) Busca de orações (links do app)
    if (intention === 'prayer_request') {
      const query = extractPrayerQuery(message);
      const limit = Number(currentIntentCfg.max_results || 3) || 3;
      const results = await searchPrayers(query);
      const header = (currentIntentCfg.messages?.header as string) || 'Encontrei estas orações no app:';
      const none = (currentIntentCfg.messages?.no_results as string) || 'Não encontrei orações para esse tema. Tente outra palavra, como "fé", "família" ou "gratidão".';
      if (results.length === 0) {
        return none;
      }
      const lines = results.slice(0, limit).map((r, i) => `${i+1}. ${r.title} – https://agapefy.com/player/audio/${r.id}`);
      return `${header}\n\n${lines.join('\n')}`;
    }

    // 3) Conversa geral: usar Assistente Biblicus quando configurado
    // NOTA: Não enviar mensagem de espera (bw_waiting_message) - foi completamente removida
    const useAssistant = intention === 'general_conversation' && (currentIntentCfg?.engine || 'prompt') === 'assistant';
    if (useAssistant) {
      const base = request.nextUrl.origin;
      // NÃO enviar mensagem de espera antes de chamar o Biblicus
      const chatRes = await fetch(`${base}/api/biblicus/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (chatRes.ok) {
        const data = await chatRes.json();
        const reply = (data && (data.reply || data?.reply === '' ? data.reply : data?.response)) || '';
        if (reply) return reply;
      }
      // fallback se Assistente falhar: cai para prompt padrão abaixo
    }

    // Definir prompt do sistema baseado na intenção (considerando override do admin)
    let systemPrompt = currentIntentCfg?.prompt?.trim() || getSystemPrompt(intention);
    let responsePrefix = getResponsePrefix(intention);

    // Se for versículo do dia, retornar diretamente
    if (intention === 'daily_verse') {
      return await getDailyVerse();
    }

    // Construir contexto da conversa
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = conversationHistory.reverse().map(conv => 
        `${userName}: ${conv.message_content}\nAgape: ${conv.response_content}`
      ).join('\n\n');
    }

    console.log('🚀 Fazendo requisição para OpenAI GPT-4o...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Melhor modelo disponível
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}

IMPORTANTE:
- Seu nome é Agape
- Seja natural, empático e inteligente
- Use emojis apropriados mas sem exagero
- Mantenha respostas entre 50-200 caracteres para WhatsApp
- Seja genuinamente útil e acolhedor
- Para cumprimentos simples como "olá", responda "Olá, como você está?"

${conversationContext ? `Contexto da conversa:\n${conversationContext}` : ''}

Nome do usuário: ${userName}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ Erro na API OpenAI:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const data = await openaiResponse.json();
    const aiResponse = data.choices[0]?.message?.content || getDefaultResponse(message, userName);

    console.log('✅ Resposta IA gerada com sucesso');
    return `${responsePrefix}${aiResponse}`;

  } catch (error) {
    console.error('💥 Erro ao gerar resposta IA:', error);
    return getDefaultResponse(message, userName);
  }
}

function normalizeText(text: string): string {
  try {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  } catch {
    return text.toLowerCase();
  }
}

function detectIntention(message: string, triggers?: Record<string, string[]>): string {
  const lower = normalizeText(message);
  // 1) Triggers por intenção (Gatilhos)
  if (triggers) {
    for (const [intent, list] of Object.entries(triggers)) {
      for (const token of list || []) {
        const tkn = normalizeText(token || '');
        if (tkn && lower.includes(tkn)) {
          // Normalizamos intents antigas para as três atuais
          if (intent === 'daily_verse') return 'daily_verse';
          if (intent === 'prayer_request') return 'prayer_request';
          return 'general_conversation';
        }
      }
    }
  }
  // 2) Heurística mínima
  if (/(versiculo|\/versiculo|verso do dia)/.test(lower)) return 'daily_verse';
  if (/(buscar|busca|oracao|oração)/.test(lower)) return 'prayer_request';
  // 3) Fallback
  return 'general_conversation';
}

function getSystemPrompt(intention: string): string {
  const prompts = {
    greeting: `Você é Agape, um assistente espiritual cristão carinhoso. O usuário está cumprimentando você. Responda de forma calorosa e acolhedora, perguntando como ele está.`,
    prayer_request: `Você é Agape, um assistente espiritual cristão. O usuário precisa de oração. Crie uma oração personalizada e reconfortante para a situação dele. Use linguagem acolhedora.`,
    bible_question: `Você é Agape, especialista da Bíblia. Responda perguntas bíblicas com conhecimento teológico e referências bíblicas. Seja didático e acessível.`,
    spiritual_guidance: `Você é Agape, conselheiro espiritual cristão. Ofereça orientação baseada nos ensinamentos bíblicos com empatia e sabedoria.`,
    general_conversation: `Você é Agape, companheiro espiritual cristão inteligente e carinhoso. Responda naturalmente com empatia e sabedoria cristã.`
  };

  return prompts[intention as keyof typeof prompts] || prompts.general_conversation;
}

async function loadIntentsConfig(): Promise<Record<string, { enabled?: boolean; prompt?: string }>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'bw_intents_config')
      .maybeSingle();
    if (error || !data?.value) return {};
    const parsed = JSON.parse(data.value);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, { enabled?: boolean; prompt?: string }>;
    return {};
  } catch {
    return {};
  }
}

async function loadShortCommands(): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'bw_short_commands')
      .maybeSingle();
    if (error || !data?.value) return {};
    const parsed = JSON.parse(data.value);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string[]>;
    return {};
  } catch {
    return {};
  }
}

function matchShortCommand(shortCommands: Record<string, string[]>, message: string): string | null {
  const text = normalizeText(message);
  for (const [intent, cmds] of Object.entries(shortCommands)) {
    for (const cmd of cmds || []) {
      const token = normalizeText(cmd || '');
      if (token && text.includes(token)) return intent;
    }
  }
  return null;
}

function getResponsePrefix(intention: string): string {
  const prefixes = {
    greeting: '😊 ',
    prayer_request: '🙏 ',
    bible_question: '📖 ',
    spiritual_guidance: '✨ ',
    general_conversation: '💙 '
  };

  return prefixes[intention as keyof typeof prefixes] || '💙 ';
}

function detectConversationType(message: string): string {
  const intention = detectIntention(message);
  const types = {
    prayer_request: 'prayer',
    daily_verse: 'daily_verse',
    general_conversation: 'intelligent_chat'
  } as const;
  return (types as any)[intention] || 'intelligent_chat';
}

function getDefaultResponse(message: string, userName: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Resposta específica para cumprimentos
  if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('ola')) {
    return `Olá ${userName}, como você está? Sou o Agape, seu companheiro espiritual. 🙏`;
  }
  
  // Resposta para pedidos de oração
  if (lowerMessage.includes('oração') || lowerMessage.includes('ore')) {
    return `🙏 ${userName}, vou orar por você. Que Deus te abençoe e te dê paz neste momento. 💙`;
  }
  
  // Resposta padrão
  return `🤗 Olá ${userName}! Sou o Agape, seu companheiro espiritual. Como posso te ajudar hoje? 😊`;
}

// ===== Busca de orações =====
type PrayerSearchItem = { id: string; title: string };

async function searchPrayers(termRaw: string): Promise<PrayerSearchItem[]> {
  const term = (termRaw || '').trim();
  if (!term) return [];
  try {
    const { data, error } = await supabase
      .from('audios')
      .select('id, title')
      .ilike('title', `%${term}%`)
      .limit(3);
    if (error) return [];
    return (data || []).map((r: any) => ({ id: r.id as string, title: r.title as string }));
  } catch {
    return [];
  }
}

function extractPrayerQuery(message: string): string {
  const m = message.toLowerCase();
  const cleaned = m
    .replace(/^buscar\s+/, '')
    .replace(/^procure\s+/, '')
    .replace(/^oração\s+(sobre|de)\s+/, '')
    .replace(/^oracao\s+(sobre|de)\s+/, '')
    .replace(/^oração\s+/, '')
    .replace(/^oracao\s+/, '')
    .trim();
  return cleaned || message;
}

async function getDailyVerse(): Promise<string> {
  try {
    // Buscar versículo aleatório da base de dados
    const { data: verses } = await supabase
      .from('verses')
      .select('*')
      .limit(1);

    if (verses && verses.length > 0) {
      const verse = verses[0];
      return `📖 *Versículo do Dia*\n\n"${verse.verse_text}"\n\n📍 ${verse.book} ${verse.chapter}:${verse.start_verse}\n\n🙏 Que este versículo abençoe seu dia!`;
    }
  } catch (error) {
    console.error('Erro ao buscar versículo:', error);
  }
  
  // Versículo padrão se não conseguir buscar do banco
  return "📖 *Versículo do Dia*\n\n\"Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que esperais.\"\n\n📍 Jeremias 29:11\n\n🙏 Que este versículo abençoe seu dia!";
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<{success: boolean, error?: string}> {
  try {
    console.log(`📤 Enviando mensagem para ${phone}: ${message}`);
    
    const response = await fetch(`${ZAPI_BASE_URL}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN
      },
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    });

    const responseData = await response.json();

    if (response.ok) {
      console.log(`✅ Mensagem enviada para ${phone}:`, responseData);
      return { success: true };
    } else {
      console.error(`❌ Erro ao enviar mensagem para ${phone}:`, responseData);
      return { success: false, error: responseData.message || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error('❌ Erro no envio:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}