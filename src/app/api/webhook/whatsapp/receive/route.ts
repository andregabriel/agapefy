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

    // Validar se é uma mensagem válida e não é nossa própria mensagem
    if (!body.phone || !body.message || body.fromMe) {
      console.log('❌ Mensagem ignorada - critérios não atendidos');
      return NextResponse.json({ status: 'ignored', reason: 'invalid_message' });
    }

    const userPhone = body.phone.replace(/\D/g, '');
    const messageContent = body.message.conversation || 
                          body.message.text || 
                          body.message.extendedTextMessage?.text || 
                          body.message.imageMessage?.caption ||
                          '';
    const userName = body.senderName || body.pushName || 'Irmão(ã)';

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

    // Gerar resposta inteligente com IA
    console.log('🤖 Gerando resposta inteligente...');
    const response = await generateIntelligentResponse(messageContent, userName, userPhone);
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

async function generateIntelligentResponse(message: string, userName: string, userPhone: string): Promise<string> {
  try {
    console.log('🧠 Iniciando geração de resposta IA...');
    
    // Verificar chave OpenAI
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('❌ Chave OpenAI não configurada');
      return getDefaultResponse(message, userName);
    }

    // Detectar intenção da mensagem
    let intention = detectIntention(message);
    // Tentar aplicar atalhos configurados pelo admin
    const sc = await loadShortCommands();
    const matched = matchShortCommand(sc, message);
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
    const intentsConfig = await loadIntentsConfig();
    const currentIntentCfg = intentsConfig[intention];
    if (currentIntentCfg && currentIntentCfg.enabled === false) {
      // Intenção desativada: cair para conversa geral
      intention = 'general_conversation';
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

function detectIntention(message: string): string {
  const lowerMessage = message.toLowerCase();
  // Short commands override from app settings
  // We load synchronously above in generateIntelligentResponse; for pure function fallback keep defaults here.
  
  // Detectar cumprimentos
  if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('ola') || 
      lowerMessage.includes('bom dia') || lowerMessage.includes('boa tarde') || lowerMessage.includes('boa noite') ||
      lowerMessage.includes('hey') || lowerMessage.includes('e aí')) {
    return 'greeting';
  }
  
  // Detectar pedidos de oração
  if (lowerMessage.includes('oração') || lowerMessage.includes('ore') || lowerMessage.includes('dificuldade') || 
      lowerMessage.includes('problema') || lowerMessage.includes('triste') || lowerMessage.includes('ansioso') ||
      lowerMessage.includes('preocupado') || lowerMessage.includes('ajuda')) {
    return 'prayer_request';
  }
  
  // Detectar perguntas bíblicas
  if (lowerMessage.includes('bíblia') || lowerMessage.includes('versículo') || lowerMessage.includes('jesus') ||
      lowerMessage.includes('deus') || lowerMessage.includes('parábola') || lowerMessage.includes('joão') ||
      lowerMessage.includes('salmo') || lowerMessage.includes('provérbio') || lowerMessage.includes('evangelho')) {
    return 'bible_question';
  }
  
  // Detectar pedido de versículo do dia
  if (lowerMessage.includes('versículo do dia') || lowerMessage.includes('/versiculo') || 
      lowerMessage.includes('verso do dia')) {
    return 'daily_verse';
  }
  
  // Detectar pedido de orientação espiritual
  if (lowerMessage.includes('conselho') || lowerMessage.includes('orientação') || lowerMessage.includes('direção') ||
      lowerMessage.includes('guia') || lowerMessage.includes('caminho')) {
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
  const text = message.toLowerCase();
  for (const [intent, cmds] of Object.entries(shortCommands)) {
    for (const cmd of cmds || []) {
      if (cmd && text.includes(cmd.toLowerCase())) return intent;
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
    greeting: 'intelligent_chat',
    prayer_request: 'prayer',
    bible_question: 'bible_expert',
    daily_verse: 'daily_verse',
    spiritual_guidance: 'brother',
    general_conversation: 'intelligent_chat'
  };

  return types[intention as keyof typeof types] || 'intelligent_chat';
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