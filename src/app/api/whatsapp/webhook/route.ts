import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ZAPI_INSTANCE_NAME = (process.env.ZAPI_INSTANCE_NAME as string) || "3E60EE9AC55FD0C647E46EB3E4757B57";
const ZAPI_TOKEN = (process.env.ZAPI_TOKEN as string) || "9F677316F38A3D2FA08EEB09";
const ZAPI_CLIENT_TOKEN = (process.env.ZAPI_CLIENT_TOKEN as string) || "F3adb78efb3ba40888e8c090e6b90aea4S";
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Webhook recebido:', JSON.stringify(body, null, 2));

    // Normalizar payload (produção Z-API pode enviar em body.text.message)
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

    // Validar se é uma mensagem válida
    if (!userPhone || !messageContent || body.fromMe) {
      console.log('❌ Mensagem ignorada - critérios não atendidos');
      return NextResponse.json({ status: 'ignored', reason: 'invalid_message' });
    }

    console.log(`📱 Processando mensagem de ${userName} (${userPhone}): "${messageContent}"`);

    if (!messageContent.trim()) {
      console.log('❌ Mensagem vazia ignorada');
      return NextResponse.json({ status: 'ignored', reason: 'empty_message' });
    }

    // Registrar usuário
    console.log('👤 Registrando usuário...');
    await supabase.from('whatsapp_users').upsert({
      phone_number: userPhone,
      name: userName,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });

    // Carregar configurações úteis (short-commands, intents)
    const settingsRows = await supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['bw_intents_config','bw_short_commands','bw_waiting_message']);
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows.data || []) settingsMap[r.key] = r.value as string;

    // Ack imediato se conversa geral
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
    if (quickIntent === 'general_conversation') {
      const waiting = (settingsMap['bw_waiting_message'] || ' Buscando a resposta na Bíblia, aguarde alguns segundos… ').trim();
      if (waiting) {
        await sendWhatsAppMessage(userPhone, waiting);
      }
    }

    // Gerar resposta inteligente
    console.log('🤖 Gerando resposta inteligente...');
    const response = await generateIntelligentResponse(request, messageContent, userName, userPhone, settingsMap);
    console.log(`💬 Resposta gerada: "${response}"`);

    // Salvar conversa
    console.log('💾 Salvando conversa...');
    await supabase.from('whatsapp_conversations').insert({
      user_phone: userPhone,
      conversation_type: 'intelligent_chat',
      message_content: messageContent,
      response_content: response,
      message_type: 'text'
    });

    // Enviar resposta via Z-API
    console.log('📤 Enviando resposta via Z-API...');
    const sendResult = await sendWhatsAppMessage(userPhone, response);
    
    if (sendResult.success) {
      console.log('✅ Mensagem enviada com sucesso!');
    } else {
      console.error('❌ Erro ao enviar mensagem:', sendResult.error);
    }

    return NextResponse.json({ 
      status: 'success', 
      response,
      user: userName,
      phone: userPhone,
      message_sent: sendResult.success
    });

  } catch (error) {
    console.error('💥 Erro no webhook:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
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
      return `🤗 Olá ${userName}! Sou o Agape, seu companheiro espiritual. Como posso te ajudar hoje? 😊`;
    }

    // Detectar intenção com triggers de config (se houver)
    const triggersMap: Record<string, string[]> = (() => {
      if (settingsMap && typeof settingsMap['bw_short_commands'] === 'string') {
        try { return JSON.parse(settingsMap['bw_short_commands']); } catch { return {}; }
      }
      return {};
    })();
    let intention = detectIntention(message, triggersMap);
    // Aplicar atalhos configurados pelo admin (fallback para leitura direta)
    const sc = (settingsMap && settingsMap['bw_short_commands']) ? {} as any : await loadShortCommands();
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
    
    // Buscar histórico de conversas
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
    const currentIntentCfg = intentsConfig[intention];
    if (currentIntentCfg && currentIntentCfg.enabled === false) {
      intention = 'general_conversation';
    }

    // 3) Conversa geral: usar Assistente Biblicus quando configurado
    const useAssistant = intention === 'general_conversation' && (currentIntentCfg?.engine || 'assistant') === 'assistant';
    if (useAssistant) {
      const base = request.nextUrl.origin;
      try {
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
      } catch {}
      // fallback se Assistente falhar: segue fluxo de prompt abaixo
    }

    // Prompt e prefixo considerando overrides
    let systemPrompt = currentIntentCfg?.prompt?.trim() || getSystemPrompt(intention);
    let responsePrefix = getResponsePrefix(intention);

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

    console.log('🚀 Fazendo requisição para OpenAI...');
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
- Para cumprimentos simples como "olá", responda perguntando como a pessoa está

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
    const response = data.choices[0]?.message?.content || 'Olá! Como posso te ajudar hoje? 😊';

    console.log('✅ Resposta IA gerada com sucesso');
    return `${responsePrefix}${response}`;

  } catch (error) {
    console.error('💥 Erro ao gerar resposta:', error);
    
    // Fallback inteligente baseado na mensagem
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('ola')) {
      return `😊 Olá ${userName}! Como você está? Sou o Agape, seu companheiro espiritual. 🙏`;
    }
    
    return `🤗 Olá ${userName}! Sou o Agape, seu companheiro espiritual. Como posso te ajudar hoje? 😊`;
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
  const lowerMessage = normalizeText(message);
  // 1) Triggers por intenção (Gatilhos)
  if (triggers) {
    for (const [intent, list] of Object.entries(triggers)) {
      for (const token of list || []) {
        const tkn = normalizeText(token || '');
        if (tkn && lowerMessage.includes(tkn)) {
          if (intent === 'daily_verse') return 'daily_verse';
          if (intent === 'prayer_request') return 'prayer_request';
          return 'general_conversation';
        }
      }
    }
  }
  
  // Detectar cumprimentos
  if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('ola') || 
      lowerMessage.includes('bom dia') || lowerMessage.includes('boa tarde') || lowerMessage.includes('boa noite')) {
    return 'greeting';
  }
  
  if (lowerMessage.includes('oracao') || lowerMessage.includes('ore') || lowerMessage.includes('dificuldade') || 
      lowerMessage.includes('problema') || lowerMessage.includes('triste') || lowerMessage.includes('ansioso')) {
    return 'prayer_request';
  }
  
  if (lowerMessage.includes('biblia') || lowerMessage.includes('versiculo') || lowerMessage.includes('jesus') ||
      lowerMessage.includes('deus') || lowerMessage.includes('parabola')) {
    return 'bible_question';
  }
  
  if (lowerMessage.includes('versiculo do dia') || lowerMessage.includes('/versiculo')) {
    return 'daily_verse';
  }
  
  if (lowerMessage.includes('conselho') || lowerMessage.includes('orientação') || lowerMessage.includes('direção')) {
    return 'spiritual_guidance';
  }
  
  return 'general_conversation';
}

function getSystemPrompt(intention: string): string {
  const prompts = {
    greeting: `Você é Agape, um assistente espiritual cristão carinhoso. O usuário está cumprimentando você. Responda de forma calorosa e acolhedora, perguntando como ele está.`,
    prayer_request: `Você é Agape, um assistente espiritual cristão. O usuário precisa de oração. Crie uma oração personalizada e reconfortante para a situação dele. Use linguagem acolhedora.`,
    bible_question: `Você é Agape, especialista da Bíblia. Responda perguntas bíblicas com conhecimento teológico e referências bíblicas. Seja didático e acessível.`,
    spiritual_guidance: `Você é Agape, conselheiro espiritual cristão. Ofereça orientação baseada nos ensinamentos bíblicos com empatia e sabedoria.`,
    general_conversation: `Você é Agape, companheiro espiritual cristão inteligente e carinhoso. Responda naturalmente com empatia e sabedoria cristã.`,
    daily_verse: ''
  } as const;
  return (prompts as any)[intention] || prompts.general_conversation;
}

function getResponsePrefix(intention: string): string {
  const prefixes = {
    greeting: '😊 ',
    prayer_request: '🙏 ',
    bible_question: '📖 ',
    spiritual_guidance: '✨ ',
    general_conversation: '💙 ',
    daily_verse: ''
  } as const;
  return (prefixes as any)[intention] || '💙 ';
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

// removed duplicate getSystemPrompt and getResponsePrefix declarations

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

async function getDailyVerse(): Promise<string> {
  try {
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