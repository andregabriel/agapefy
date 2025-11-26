import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ZAPI_INSTANCE_NAME = (process.env.ZAPI_INSTANCE_NAME as string) || "3E60EE9AC55FD0C647E46EB3E4757B57";
const ZAPI_TOKEN = (process.env.ZAPI_TOKEN as string) || "9F677316F38A3D2FA08EEB09";
const ZAPI_CLIENT_TOKEN = (process.env.ZAPI_CLIENT_TOKEN as string) || "F3adb78efb3ba40888e8c090e6b90aea4S";
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function POST(request: NextRequest) {
  try {
    // Tentar ler o body de diferentes formas
    let body: any;
    try {
      const text = await request.text();
      console.log('📥 Body recebido (raw):', text.substring(0, 500));
      
      if (!text || text.trim() === '') {
        console.log('⚠️ Body vazio recebido');
        return NextResponse.json({ status: 'ignored', reason: 'empty_body' }, { status: 200 });
      }
      
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError);
      try {
        body = await request.json();
      } catch (jsonError) {
        console.error('❌ Erro ao ler body como JSON:', jsonError);
        return NextResponse.json({ 
          status: 'error', 
          reason: 'invalid_json',
          error: parseError instanceof Error ? parseError.message : 'Erro desconhecido'
        }, { status: 200 });
      }
    }
    
    console.log('🔔 Webhook recebido:', JSON.stringify(body, null, 2));
    
    // Verificar se body é válido
    if (!body || typeof body !== 'object') {
      console.log('❌ Body inválido ou não é um objeto');
      return NextResponse.json({ status: 'ignored', reason: 'invalid_body' }, { status: 200 });
    }

    // Verificar se é mensagem nossa (deve ser ignorada)
    if (body.fromMe === true) {
      console.log('⚠️ Mensagem ignorada - é nossa própria mensagem (fromMe=true)');
      return NextResponse.json({ status: 'ignored', reason: 'own_message' }, { status: 200 });
    }

    // Normalizar payload (produção Z-API pode enviar em diferentes formatos)
    const userPhoneRaw = body.phone || body.remoteJid || body.chatId || body.data?.phone || '';
    const userPhone = typeof userPhoneRaw === 'string' ? userPhoneRaw.replace(/\D/g, '') : '';
    // Versão mascarada para logs (mantém apenas últimos 4 dígitos)
    const maskedUserPhone = userPhone ? userPhone.replace(/\d(?=\d{4})/g, 'x') : '';
    const messageContent = (
      body.message?.conversation ||
      body.message?.text ||
      body.message?.extendedTextMessage?.text ||
      body.message?.imageMessage?.caption ||
      body.message?.videoMessage?.caption ||
      body.message?.documentMessage?.caption ||
      body.text?.message ||
      body.text ||
      body.data?.message ||
      body.data?.text ||
      (typeof body.message === 'string' ? body.message : '') ||
      (typeof body.text === 'string' ? body.text : '') ||
      ''
    ) as string;
    const userName = body.senderName || body.pushName || body.chatName || body.data?.senderName || body.data?.pushName || 'Irmão(ã)';

    // Log detalhado do que foi extraído
    console.log('📋 Dados extraídos do webhook:');
    const logUserPhoneRaw =
      typeof userPhoneRaw === 'string'
        ? String(userPhoneRaw).replace(/\d(?=\d{4})/g, 'x')
        : '';
    const logMessagePreview =
      messageContent && messageContent.length > 0
        ? `${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''} [len=${messageContent.length}]`
        : '';
    console.log(`  - userPhoneRaw (mascarado): "${logUserPhoneRaw}"`);
    console.log(`  - userPhone (normalizado, mascarado): "${maskedUserPhone}"`);
    console.log(`  - messageContent (preview): "${logMessagePreview}"`);
    console.log(`  - userName: "${userName}"`);
    console.log(`  - fromMe: ${body.fromMe}`);

    // Validar se é uma mensagem válida
    if (!userPhone) {
      console.log('❌ Mensagem ignorada - número de telefone não encontrado');
      console.log('  Campos disponíveis no body:', Object.keys(body));
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'no_phone',
        available_fields: Object.keys(body)
      }, { status: 200 });
    }
    
    if (!messageContent || !messageContent.trim()) {
      console.log('❌ Mensagem ignorada - conteúdo vazio');
      console.log('  Estrutura do body.message:', JSON.stringify(body.message, null, 2));
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'empty_message',
        message_structure: body.message
      }, { status: 200 });
    }

    console.log(`📱 Processando mensagem de ${userName} (${maskedUserPhone}): [len=${messageContent.length}]`);

    // ------------------------------------------------------------------
    // Proteção contra duplicidade de processamento
    // ------------------------------------------------------------------
    // Assim como no endpoint /api/webhook/whatsapp/receive, garantimos aqui
    // que a mesma mensagem (telefone + conteúdo) não seja processada mais
    // de uma vez em um curto intervalo de tempo. Isso evita respostas
    // duplicadas para o usuário caso o webhook seja reenviado.
    try {
      const duplicateWindowMs = 30 * 1000; // 30 segundos
      const since = new Date(Date.now() - duplicateWindowMs).toISOString();

      const { data: existingConversations, error: dupError } = await supabase
        .from('whatsapp_conversations')
        .select('id, created_at')
        .eq('user_phone', userPhone)
        .eq('message_content', messageContent)
        .gte('created_at', since)
        .limit(1);

      if (dupError) {
        console.warn('⚠️ Erro ao verificar duplicidade de conversa (webhook):', dupError);
      } else if (existingConversations && existingConversations.length > 0) {
        console.log('⚠️ Mensagem duplicada detectada (webhook) - ignorando processamento para evitar respostas em duplicidade');
        return NextResponse.json({
          status: 'ignored',
          reason: 'duplicate_message',
          phone: userPhone,
          message_preview: messageContent.substring(0, 50),
        }, { status: 200 });
      }
    } catch (dupCheckError) {
      console.warn('⚠️ Falha inesperada ao checar duplicidade (webhook):', dupCheckError);
      // Se a checagem falhar, seguimos o fluxo normal para não interromper
      // o atendimento ao usuário.
    }

    // Verificar se usuário já existe antes de fazer upsert
    console.log('👤 Verificando/registrando usuário...');
    const { data: existingUser } = await supabase
      .from('whatsapp_users')
      .select('is_active, has_sent_first_message')
      .eq('phone_number', userPhone)
      .maybeSingle();
    
    // Verificar se o usuário está ativo
    if (existingUser && existingUser.is_active === false) {
      console.log(`❌ Usuário ${maskedUserPhone || '***'} está inativo - mensagem ignorada`);
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'user_inactive',
        message: 'Usuário desativado. Mensagens não serão processadas.'
      });
    }

    // Se não existe, criar com has_sent_first_message: false
    // Se existe, manter o valor atual de has_sent_first_message
    const hasSentFirstMessage = existingUser?.has_sent_first_message ?? false;

    // Atualizar ou criar usuário
    await supabase.from('whatsapp_users').upsert({
      phone_number: userPhone,
      name: userName,
      is_active: existingUser?.is_active ?? true, // Manter status existente ou criar como ativo
      has_sent_first_message: hasSentFirstMessage,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });

    // Carregar configurações úteis (boas-vindas, menu e regras de assistentes)
    const settingsRows = await supabase
      .from('app_settings')
      .select('key,value')
      .in('key', [
        'whatsapp_send_welcome_enabled',
        'whatsapp_welcome_message',
        'whatsapp_menu_message',
        'whatsapp_menu_enabled',
        'whatsapp_menu_reminder_enabled',
        'whatsapp_assistant_rules'
      ]);
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows.data || []) settingsMap[r.key] = r.value as string;

    // Verificar se é a primeira mensagem do usuário (usando has_sent_first_message)
    const isFirstMessage = !hasSentFirstMessage;

    // Gerar resposta inteligente
    console.log('🤖 Gerando resposta inteligente...');
    const responseResult = await generateIntelligentResponse(request, messageContent, userName, userPhone, settingsMap);
    const response = typeof responseResult === 'string' ? responseResult : responseResult.response;
    const responseThreadId = typeof responseResult === 'object' ? responseResult.threadId : undefined;
    console.log(`💬 Resposta gerada: "${response}"`);

    // Salvar conversa (thread_id será salvo junto se existir)
    console.log('💾 Salvando conversa...');
    const conversationData: any = {
      user_phone: userPhone,
      conversation_type: 'intelligent_chat',
      message_content: messageContent,
      response_content: response,
      message_type: 'text'
    };
    
    // Adicionar thread_id se disponível (para continuidade de conversa com assistentes)
    if (responseThreadId) {
      conversationData.thread_id = responseThreadId;
    }
    
    await supabase.from('whatsapp_conversations').insert(conversationData);

    // Enviar resposta via Z-API
    console.log('📤 Enviando resposta via Z-API...');
    const sendResult = await sendWhatsAppMessage(userPhone, response);
    
    if (sendResult.success) {
      console.log('✅ Mensagem enviada com sucesso!');
    } else {
      console.error('❌ Erro ao enviar mensagem:', sendResult.error);
    }

    // Se for primeira mensagem, marcar que o usuário enviou a primeira mensagem
    // IMPORTANTE: Isso deve acontecer SEMPRE, independente de enviar boas-vindas ou não
    // Pois não podemos enviar mensagens para usuários que não enviaram a primeira mensagem
    if (isFirstMessage) {
      await supabase
        .from('whatsapp_users')
        .update({ has_sent_first_message: true, updated_at: new Date().toISOString() })
        .eq('phone_number', userPhone);
      
      // Se boas-vindas estiver ativada, enviar a mensagem de boas-vindas + menu
      const sendWelcome = (settingsMap['whatsapp_send_welcome_enabled'] ?? 'true') === 'true';
      const menuEnabled = (settingsMap['whatsapp_menu_enabled'] ?? 'false') === 'true';
      const welcomeText = settingsMap['whatsapp_welcome_message'] || '';
      const menuText = settingsMap['whatsapp_menu_message'] || '';
      
      if (sendWelcome) {
        // Montar mensagem: boas-vindas + menu (se menu estiver ativado)
        const welcomeParts = [welcomeText];
        if (menuEnabled && menuText) {
          welcomeParts.push(menuText);
        }
        const welcomeMsg = welcomeParts.filter(Boolean).join('\n\n');
        
        if (welcomeMsg.trim()) {
          await sendWhatsAppMessage(userPhone, welcomeMsg);
        }
      }
    }

    // Lembrete a cada 5 mensagens do usuário (apenas se ativado)
    const menuReminderEnabled = (settingsMap['whatsapp_menu_reminder_enabled'] ?? 'false') === 'true';
    const menuReminderText = settingsMap['whatsapp_menu_message'] || '';
    if (menuReminderEnabled && menuReminderText) {
      const { count: convCount } = await supabase
        .from('whatsapp_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_phone', userPhone);
      if ((convCount || 0) > 0 && (convCount as number) % 5 === 0) {
        await sendWhatsAppMessage(userPhone, menuReminderText);
      }
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
    
    // Log detalhado do erro
    if (error instanceof Error) {
      console.error('  - Mensagem:', error.message);
      console.error('  - Stack:', error.stack);
    }
    
    // Sempre retornar 200 para o Z-API para evitar reenvios
    // Mas logar o erro para debug
    return NextResponse.json({ 
      status: 'error',
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }
}

async function generateIntelligentResponse(request: NextRequest, message: string, userName: string, userPhone: string, settingsMap?: Record<string,string>): Promise<string | { response: string; threadId?: string }> {
  try {
    console.log('🧠 Iniciando geração de resposta IA...');
    
    // Verificar chave OpenAI
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('❌ Chave OpenAI não configurada');
      return `🤗 Olá ${userName}! Sou o Agape, seu companheiro espiritual. Como posso te ajudar hoje? 😊`;
    }

    // Detectar intenção usando apenas heurísticas internas
    let intention = detectIntention(message);
    console.log(`🎯 Intenção detectada: ${intention}`);
    
    // Buscar histórico de conversas
    const { data: conversationHistory } = await supabase
      .from('whatsapp_conversations')
      .select('message_content, response_content')
      .eq('user_phone', userPhone)
      .order('created_at', { ascending: false })
      .limit(3);

    // Selecionar assistente baseado em detecção inteligente (palavras-chave + contexto)
    let selectedAssistant: Assistant | null = null;
    
    // Se detectou suporte, priorizar assistente de suporte
    if (intention === 'support_request') {
      console.log('🎯 Intenção de suporte detectada - priorizando assistente de suporte');
      try {
        selectedAssistant = await selectAssistantByMessage(message, settingsMap);
        // Se não encontrou assistente de suporte, tentar encontrar manualmente
        if (!selectedAssistant || selectedAssistant.type !== 'support') {
          const assistantRules = settingsMap?.['whatsapp_assistant_rules'];
          if (assistantRules) {
            try {
              const config: AssistantConfig = JSON.parse(assistantRules);
              const supportAssistant = config.assistants?.find(a => 
                a.enabled && (a.type === 'support' || a.type === 'sales')
              );
              if (supportAssistant) {
                selectedAssistant = supportAssistant;
                console.log(`✅ Assistente de suporte encontrado: ${supportAssistant.name}`);
              }
            } catch {}
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar assistente de suporte:', error);
      }
    } else {
      // Para outras intenções, usar seleção normal
      try {
        selectedAssistant = await selectAssistantByMessage(message, settingsMap);
      } catch (error) {
        console.error('❌ Erro ao chamar assistente:', error);
      }
    }
    
    // Chamar assistente selecionado
    if (selectedAssistant) {
      try {
        console.log(`🤖 Usando assistente: ${selectedAssistant.name} (${selectedAssistant.assistantId})`);
        const result = await callOpenAIAssistant(selectedAssistant.assistantId, message, userPhone);
        if (result && result.reply) {
          console.log('✅ Resposta do assistente recebida');
          return { response: result.reply, threadId: result.threadId };
        } else {
          console.log('⚠️ Assistente não retornou resposta, usando fallback inteligente');
        }
      } catch (error) {
        console.error('❌ Erro ao chamar assistente:', error);
        // Fallback para fluxo normal se assistente falhar
      }
    }
    
    // Se nenhum assistente foi selecionado ou não retornou resposta, usar detecção inteligente de intenção
    // para aplicar o prompt mais adequado no GPT-4o
    const detectedContext = detectMessageContext(message);
    console.log(`🧠 Contexto detectado: ${detectedContext}`);

    // Prompt e prefixo considerando apenas configuração interna e contexto detectado
    let systemPrompt = getSystemPrompt(intention);
    let responsePrefix = getResponsePrefix(intention);
    
    // Melhorar prompt baseado no contexto detectado se não houver assistente específico
    if (!selectedAssistant) {
      const contextPrompt = getContextualPrompt(message, detectedContext);
      if (contextPrompt) {
        systemPrompt = contextPrompt;
        console.log(`📝 Usando prompt contextualizado para: ${detectedContext}`);
      }
    }

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

function isSimpleGreeting(message: string): boolean {
  const lowerMessage = normalizeText(message.trim());
  // Cumprimentos muito simples (apenas 1-3 palavras)
  const simpleGreetings = [
    'olá', 'ola', 'oi', 'oie', 'olá!', 'ola!', 'oi!',
    'bom dia', 'boa tarde', 'boa noite',
    'bom dia!', 'boa tarde!', 'boa noite!',
    'hey', 'hi', 'hello'
  ];
  
  // Verificar se é apenas um cumprimento simples (sem outras palavras)
  const words = lowerMessage.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 3) {
    return simpleGreetings.some(greeting => lowerMessage === greeting || lowerMessage.startsWith(greeting + ' '));
  }
  
  return false;
}

function detectIntention(message: string, triggers?: Record<string, string[]>): string {
  const lowerMessage = normalizeText(message);
  
  // 1) Detectar suporte ANTES de outras intenções (prioridade alta)
  const supportKeywords = [
    'suporte', 'ajuda', 'problema', 'erro', 'não funciona', 'não consigo',
    'dificuldade', 'preciso de ajuda', 'preciso ajuda', 'como fazer', 'como usar',
    'login', 'senha', 'conta', 'app', 'aplicativo', 'plataforma', 'sistema',
    'quero suporte', 'preciso suporte', 'falar com suporte', 'atendimento'
  ];
  
  if (supportKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'support_request';
  }
  
  // 2) Triggers por intenção (Gatilhos)
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
  
  // 3) Detectar cumprimentos
  if (lowerMessage.includes('olá') || lowerMessage.includes('oi') || lowerMessage.includes('ola') || 
      lowerMessage.includes('bom dia') || lowerMessage.includes('boa tarde') || lowerMessage.includes('boa noite')) {
    return 'greeting';
  }
  
  // 4) Detectar pedidos de oração (mas não confundir com suporte)
  if ((lowerMessage.includes('oracao') || lowerMessage.includes('ore') || lowerMessage.includes('triste') || 
       lowerMessage.includes('ansioso')) && !lowerMessage.includes('suporte') && !lowerMessage.includes('ajuda')) {
    return 'prayer_request';
  }
  
  // 5) Detectar questões bíblicas
  if (lowerMessage.includes('biblia') || lowerMessage.includes('versiculo') || lowerMessage.includes('jesus') ||
      lowerMessage.includes('deus') || lowerMessage.includes('parabola')) {
    return 'bible_question';
  }
  
  // 6) Versículo do dia
  if (lowerMessage.includes('versiculo do dia') || lowerMessage.includes('/versiculo')) {
    return 'daily_verse';
  }
  
  // 7) Orientação espiritual
  if (lowerMessage.includes('conselho') || lowerMessage.includes('orientação') || lowerMessage.includes('direção')) {
    return 'spiritual_guidance';
  }
  
  return 'general_conversation';
}

function detectMessageContext(message: string): 'support' | 'sales' | 'biblical' | 'general' {
  const lowerMessage = message.toLowerCase();
  
  // Padrões de suporte
  const supportPatterns = [
    /\b(não consigo|não funciona|erro|problema|dificuldade|ajuda|como fazer|como usar|login|senha|conta)\b/i,
    /\b(app|aplicativo|plataforma|sistema|site|página|funcionalidade)\b/i
  ];
  
  // Padrões de vendas
  const salesPatterns = [
    /\b(pagamento|pagar|comprar|assinatura|plano|preço|custo|valor|quanto|desconto|promoção|oferta)\b/i,
    /\b(quero|gostaria|interessado|desejo|preciso comprar)\b/i
  ];
  
  // Padrões bíblicos
  const biblicalPatterns = [
    /\b(bíblia|versículo|jesus|deus|cristo|evangelho|escritura|parábola|oração)\b/i
  ];
  
  if (supportPatterns.some(p => p.test(lowerMessage))) return 'support';
  if (salesPatterns.some(p => p.test(lowerMessage))) return 'sales';
  if (biblicalPatterns.some(p => p.test(lowerMessage))) return 'biblical';
  
  return 'general';
}

function getContextualPrompt(message: string, context: 'support' | 'sales' | 'biblical' | 'general'): string | null {
  const lowerMessage = message.toLowerCase();
  
  if (context === 'support') {
    return `Você é Agape, um assistente de suporte técnico especializado e extremamente eficiente. 

SUA MISSÃO:
- Resolver problemas do usuário de forma rápida e eficaz
- Ser proativo e oferecer soluções práticas
- Explicar de forma clara e didática
- Ser empático e paciente com dificuldades técnicas
- Se não souber algo específico, oferecer alternativas ou direcionar para onde encontrar ajuda

ESTILO DE RESPOSTA:
- Seja direto mas acolhedor
- Use passos numerados quando apropriado
- Ofereça múltiplas soluções quando possível
- Confirme se o problema foi resolvido
- Use emojis moderadamente (✅ para confirmação, 🔧 para soluções técnicas)

CONTEXTO DA MENSAGEM: "${message}"

Responda de forma que o usuário se sinta ajudado e confiante em resolver seu problema.`;
  }
  
  if (context === 'sales') {
    return `Você é Agape, um vendedor excepcional e consultor de produtos especializado. 

SUA MISSÃO:
- Entender as necessidades do cliente
- Apresentar benefícios de forma convincente mas honesta
- Criar valor e mostrar como o produto/serviço resolve problemas
- Ser consultivo, não apenas vendedor
- Fechar vendas de forma natural e sem pressão
- Responder objeções com empatia e dados

TÉCNICAS DE VENDAS:
- Faça perguntas para entender necessidades
- Destaque benefícios, não apenas características
- Use prova social quando apropriado
- Crie urgência positiva quando relevante
- Ofereça opções e facilite a decisão
- Seja transparente sobre preços e condições

ESTILO DE RESPOSTA:
- Entusiasmado mas profissional
- Foque em como o produto melhora a vida do cliente
- Use linguagem que gere confiança
- Seja consultivo, não apenas vendedor
- Use emojis estrategicamente (💰 para valores, ✨ para benefícios, 🎯 para ofertas)

CONTEXTO DA MENSAGEM: "${message}"

Transforme a conversa em uma oportunidade de ajudar o cliente a tomar a melhor decisão.`;
  }
  
  if (context === 'biblical') {
    return `Você é Agape, um mentor espiritual e especialista em Bíblia profundamente conhecedor das Escrituras.

SUA MISSÃO:
- Responder perguntas bíblicas com precisão teológica
- Explicar versículos e passagens de forma acessível
- Conectar ensinamentos bíblicos à vida prática
- Oferecer orientação espiritual baseada na Palavra
- Ser sábio, empático e edificante

ESTILO DE RESPOSTA:
- Use referências bíblicas precisas (livro, capítulo, versículo)
- Explique o contexto histórico quando relevante
- Aplique ensinamentos à vida prática
- Seja reverente mas acessível
- Use emojis moderadamente (📖 para versículos, 🙏 para oração, ✨ para inspiração)

CONTEXTO DA MENSAGEM: "${message}"

Seja um guia espiritual que ajuda o usuário a crescer na fé através do conhecimento bíblico.`;
  }
  
  return null;
}

function getSystemPrompt(intention: string): string {
  const prompts = {
    greeting: `Você é Agape, um assistente espiritual cristão carinhoso. O usuário está cumprimentando você. Responda de forma calorosa e acolhedora, perguntando como ele está.`,
    prayer_request: `Você é Agape, um assistente espiritual cristão. O usuário precisa de oração. Crie uma oração personalizada e reconfortante para a situação dele. Use linguagem acolhedora.`,
    bible_question: `Você é Agape, especialista da Bíblia. Responda perguntas bíblicas com conhecimento teológico e referências bíblicas. Seja didático e acessível.`,
    spiritual_guidance: `Você é Agape, conselheiro espiritual cristão. Ofereça orientação baseada nos ensinamentos bíblicos com empatia e sabedoria.`,
    support_request: `Você é Agape, assistente de suporte técnico da plataforma Agapefy. 

SUA MISSÃO:
- Resolver problemas do usuário de forma rápida e eficaz
- Ser proativo e oferecer soluções práticas
- Explicar de forma clara e didática
- Ser empático e paciente com dificuldades técnicas
- Se não souber algo específico, oferecer alternativas ou direcionar para onde encontrar ajuda
- NÃO usar referências bíblicas para questões técnicas de suporte

ESTILO DE RESPOSTA:
- Seja direto mas acolhedor
- Use passos numerados quando apropriado
- Ofereça múltiplas soluções quando possível
- Confirme se o problema foi resolvido
- Use emojis moderadamente (✅ para confirmação, 🔧 para soluções técnicas)

Responda de forma que o usuário se sinta ajudado e confiante em resolver seu problema.`,
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
    support_request: '🔧 ',
    general_conversation: '💙 ',
    daily_verse: ''
  } as const;
  return (prefixes as any)[intention] || '💙 ';
}

interface Assistant {
  id: string;
  name: string;
  assistantId: string;
  type: 'biblical' | 'sales' | 'support';
  description: string;
  keywords: string[];
  enabled: boolean;
}

interface AssistantConfig {
  assistants: Assistant[];
  defaultAssistantId?: string;
}

/**
 * Usa GPT como classificador leve para entender a intenção principal da mensagem.
 *
 * Categorias possíveis:
 * - "support_sales": dúvidas sobre funcionamento do app, uso, problemas técnicos,
 *   login/conta/senha, pagamentos, planos, preços, compras, suporte ou vendas.
 * - "biblical": perguntas sobre Bíblia, versículos, Jesus, Deus, temas espirituais,
 *   orações, fé ou conteúdo religioso.
 * - "indeterminado": quando não der para ter certeza entre as duas acima.
 */
async function analyzeMessageIntentWithAI(
  message: string
): Promise<'support_sales' | 'biblical' | 'indeterminado' | null> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.log('⚠️ OPENAI_API_KEY não configurada para análise de intenção, pulando IA');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 10,
        messages: [
          {
            role: 'system',
            content:
              'Você é um classificador de intenções para mensagens do WhatsApp. ' +
              'Analise a mensagem do usuário e escolha APENAS UMA das categorias abaixo, retornando somente o rótulo, sem explicações:\n\n' +
              '- "support_sales": Perguntas sobre funcionamento do app, como usar, como fazer algo, login, conta, senha, cadastro, problemas técnicos, erros, dificuldades, ajuda, pagamentos, planos, preços, assinatura, suporte, vendas ou qualquer tema ligado ao uso ou compra do produto.\n' +
              '- "biblical": Perguntas ou comentários sobre Bíblia, versículos, Jesus, Deus, Espírito Santo, temas espirituais, orações, fé, doutrina cristã ou conteúdo religioso em geral.\n' +
              '- "indeterminado": Quando a mensagem for muito genérica, social (tipo só \"oi\", \"bom dia\") ou não der para saber com clareza se é sobre o app ou sobre Bíblia.\n\n' +
              'Responda estritamente com UMA destas palavras: support_sales, biblical ou indeterminado.',
          },
          {
            role: 'user',
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('❌ Erro HTTP na análise de intenção com IA:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim()?.toLowerCase();

    if (raw === 'support_sales' || raw === 'biblical' || raw === 'indeterminado') {
      console.log(`🤖 IA classificou intenção como: ${raw}`);
      return raw;
    }

    console.log('⚠️ Resposta inesperada da IA na análise de intenção:', raw);
    return null;
  } catch (error) {
    console.error('❌ Erro ao chamar IA para análise de intenção:', error);
    return null;
  }
}

async function selectAssistantByMessage(message: string, settingsMap?: Record<string, string>): Promise<Assistant | null> {
  try {
    // Carregar configuração de assistentes
    const assistantRules = settingsMap?.['whatsapp_assistant_rules'];
    if (!assistantRules) {
      console.log('⚠️ Configuração de assistentes não encontrada');
      return null;
    }

    // Parse da configuração
    let config: AssistantConfig;
    try {
      config = JSON.parse(assistantRules);
    } catch {
      console.error('❌ Erro ao fazer parse da configuração de assistentes');
      return null;
    }

    if (!config.assistants || !Array.isArray(config.assistants) || config.assistants.length === 0) {
      console.log('⚠️ Nenhum assistente configurado');
      return null;
    }

    // Normalizar mensagem para busca
    const normalizedMessage = normalizeText(message);
    const originalMessage = message.toLowerCase();

    // PRIORIDADE 0: Se mensagem contém palavras de suporte explícitas, priorizar assistente de suporte
    const explicitSupportKeywords = ['suporte', 'quero suporte', 'preciso suporte', 'falar com suporte', 'atendimento'];
    if (explicitSupportKeywords.some(keyword => normalizedMessage.includes(normalizeText(keyword)))) {
      const supportAssistant = config.assistants.find(a => 
        a.enabled && a.type === 'support'
      ) || config.assistants.find(a => 
        a.enabled && a.type === 'sales'
      );
      if (supportAssistant) {
        console.log(`✅ Assistente de suporte selecionado por palavra-chave explícita: ${supportAssistant.name}`);
        return supportAssistant;
      }
    }

    // PRIORIDADE 1: Verificar palavras-chave explícitas de cada assistente habilitado
    for (const assistant of config.assistants.filter(a => a.enabled)) {
      const matchedKeywords = assistant.keywords.filter(kw => 
        normalizedMessage.includes(normalizeText(kw))
      );
      
      if (matchedKeywords.length > 0) {
        console.log(`✅ Assistente selecionado por palavras-chave: ${assistant.name} (palavras: ${matchedKeywords.join(', ')})`);
        return assistant;
      }
    }

    // PRIORIDADE 2: Detecção inteligente de contexto e intenção
    
    // Padrões para detectar suporte/vendas (mais abrangente)
    const supportSalesPatterns = [
      // Problemas técnicos e suporte
      /\b(não consigo|não funciona|não está funcionando|não consegui|não consigo fazer|não está dando certo)\b/i,
      /\b(erro|problema|dificuldade|preciso de ajuda|preciso ajuda|estou com problema|tenho problema)\b/i,
      /\b(como faço|como fazer|como usar|como funciona|como posso|não sei como|não entendi como)\b/i,
      /\b(login|entrar|acessar|conta|senha|esqueci|esqueceu|recuperar|resetar)\b/i,
      /\b(cadastro|registro|registrar|cadastrar|perfil|conta|usuário|usuario)\b/i,
      /\b(app|aplicativo|plataforma|sistema|site|página|página)\b/i,
      
      // Vendas e pagamentos
      /\b(pagamento|pagar|pagando|comprar|compra|assinatura|assinar|plano|planos|preço|preços|custo|valor|quanto custa|quanto é)\b/i,
      /\b(desconto|promoção|promocao|oferta|especial|benefício|beneficio|vantagem)\b/i,
      /\b(quero|gostaria|interessado|interessada|desejo|preciso comprar|quero assinar)\b/i,
      
      // Dúvidas sobre funcionalidades
      /\b(o que é|o que faz|para que serve|funcionalidade|recurso|feature|como funciona)\b/i,
      /\b(dúvida|dúvidas|duvida|duvidas|pergunta|perguntas|quero saber|gostaria de saber)\b/i,
    ];

    // Padrões para detectar perguntas bíblicas/espirituais
    const biblicalPatterns = [
      /\b(bíblia|biblia|versículo|versiculo|versículos|versiculos|escritura|escrituras)\b/i,
      /\b(jesus|cristo|deus|senhor|espírito santo|espirito santo|trindade)\b/i,
      /\b(evangelho|evangelhos|apóstolo|apostolo|apostolos|apóstolos|discípulo|discipulo)\b/i,
      /\b(parábola|parabola|parábolas|parabolas|salmos|salmo|provérbios|proverbios)\b/i,
      /\b(o que a bíblia diz|o que diz a bíblia|o que significa|explique|ensina|fala sobre)\b/i,
      /\b(mateus|marcos|lucas|joão|joao|gênesis|genesis|êxodo|exodo|levítico|levitico)\b/i,
      /\b(números|numeros|deuteronômio|deuteronomio|josué|josue|juízes|juizes)\b/i,
      /\b(oração|orações|oracoes|orar|reza|rezar|rezo|rezar|pedido|pedidos)\b/i,
      /\b(fé|fe|esperança|esperanca|amor|caridade|perdão|perdao|graça|graca)\b/i,
    ];

    // Verificar padrões de suporte/vendas
    const isSupportSalesQuestion = supportSalesPatterns.some(pattern => pattern.test(originalMessage));
    
    if (isSupportSalesQuestion) {
      // Priorizar assistente de suporte, depois vendas
      const supportAssistant = config.assistants.find(a => 
        a.enabled && a.type === 'support'
      ) || config.assistants.find(a => 
        a.enabled && a.type === 'sales'
      );
      
      if (supportAssistant) {
        console.log(`✅ Assistente de suporte/vendas selecionado por contexto inteligente: ${supportAssistant.name}`);
        return supportAssistant;
      }
    }

    // Verificar padrões bíblicos
    const isBiblicalQuestion = biblicalPatterns.some(pattern => pattern.test(originalMessage));
    
    if (isBiblicalQuestion) {
      const biblicalAssistant = config.assistants.find(a => 
        a.enabled && a.type === 'biblical'
      );
      
      if (biblicalAssistant) {
        console.log(`✅ Assistente bíblico selecionado por contexto inteligente: ${biblicalAssistant.name}`);
        return biblicalAssistant;
      }
    }

    // PRIORIDADE 3: Análise de intenção por estrutura da mensagem
    
    // Perguntas diretas sobre funcionalidade = suporte
    if (originalMessage.match(/^(como|o que|qual|quando|onde|por que|porque|por quê|porque)/i) && 
        (originalMessage.includes('fazer') || originalMessage.includes('usar') || originalMessage.includes('funciona'))) {
      const supportAssistant = config.assistants.find(a => 
        a.enabled && (a.type === 'support' || a.type === 'sales')
      );
      if (supportAssistant) {
        console.log(`✅ Assistente selecionado por análise de estrutura (pergunta funcional): ${supportAssistant.name}`);
        return supportAssistant;
      }
    }

    // Mensagens com problemas/erros = suporte
    if (originalMessage.match(/\b(não|erro|problema|dificuldade|ajuda)\b/i) && 
        !originalMessage.match(/\b(bíblia|biblia|versículo|jesus|deus)\b/i)) {
      const supportAssistant = config.assistants.find(a => 
        a.enabled && (a.type === 'support' || a.type === 'sales')
      );
      if (supportAssistant) {
        console.log(`✅ Assistente selecionado por análise de estrutura (problema técnico): ${supportAssistant.name}`);
        return supportAssistant;
      }
    }

    // PRIORIDADE 3.5: Análise de intenção com IA (fallback inteligente)
    const aiClassification = await analyzeMessageIntentWithAI(message);

    if (aiClassification === 'support_sales') {
      const supportAssistant = config.assistants.find(a =>
        a.enabled && (a.type === 'support' || a.type === 'sales')
      );
      if (supportAssistant) {
        console.log(
          `✅ Assistente selecionado por análise de IA (support_sales): ${supportAssistant.name}`
        );
        return supportAssistant;
      }
    } else if (aiClassification === 'biblical') {
      const biblicalAssistant = config.assistants.find(a => a.enabled && a.type === 'biblical');
      if (biblicalAssistant) {
        console.log(
          `✅ Assistente selecionado por análise de IA (biblical): ${biblicalAssistant.name}`
        );
        return biblicalAssistant;
      }
    }

    // PRIORIDADE 4: Fallback com preferência para suporte/vendas como padrão
    const supportOrSalesDefault =
      config.assistants.find(a => a.enabled && (a.type === 'support' || a.type === 'sales')) ||
      null;

    if (supportOrSalesDefault) {
      console.log(
        `✅ Usando assistente de suporte/vendas como fallback padrão: ${supportOrSalesDefault.name}`
      );
      return supportOrSalesDefault;
    }

    // Se não houver suporte/vendas, usar defaultAssistantId ou primeiro habilitado
    const defaultAssistant =
      config.assistants.find(a => a.enabled && a.id === config.defaultAssistantId) ||
      config.assistants.find(a => a.enabled);

    if (defaultAssistant) {
      console.log(`✅ Usando assistente padrão: ${defaultAssistant.name}`);
      return defaultAssistant;
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao selecionar assistente:', error);
    return null;
  }
}

async function callOpenAIAssistant(assistantId: string, message: string, userPhone: string): Promise<{ reply: string; threadId: string } | null> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('❌ Chave OpenAI não configurada');
      return null;
    }

    // Buscar thread existente do usuário ou criar nova
    let threadId: string | undefined = undefined;
    try {
      const { data: threadData } = await supabase
        .from('whatsapp_conversations')
        .select('thread_id')
        .eq('user_phone', userPhone)
        .not('thread_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      threadId = threadData?.thread_id as string | undefined;
    } catch (error) {
      // Coluna thread_id pode não existir ainda, continuar sem thread existente
      console.log('⚠️ Não foi possível buscar thread existente, criando nova');
    }

    // Criar cliente OpenAI
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: openaiApiKey });

    // Criar ou usar thread existente
    let thread;
    if (threadId) {
      try {
        // Verificar se thread ainda existe
        await client.beta.threads.retrieve(threadId);
        thread = { id: threadId };
      } catch {
        // Thread não existe mais, criar nova
        thread = await client.beta.threads.create();
        threadId = thread.id;
      }
    } else {
      thread = await client.beta.threads.create();
      threadId = thread.id;
    }

    // Adicionar mensagem do usuário à thread
    await client.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message,
    });

    // Criar run do assistente
    const run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      temperature: 0.2,
      top_p: 1.0,
      response_format: { type: 'text' },
    });

    // Aguardar conclusão do run (com timeout de 30 segundos)
    const started = Date.now();
    const timeout = 30000; // 30 segundos
    while (true) {
      const r = await client.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (r.status === 'completed') break;
      if (r.status === 'failed' || r.status === 'expired' || r.status === 'cancelled') {
        throw new Error(`Run failed with status: ${r.status}`);
      }
      
      if (Date.now() - started > timeout) {
        throw new Error('Timeout ao aguardar resposta do assistente');
      }
      
      await new Promise((res) => setTimeout(res, 800));
    }

    // Buscar resposta do assistente
    const messages = await client.beta.threads.messages.list(thread.id, { order: 'desc', limit: 1 });
    const lastMessage = messages.data[0];
    
    if (lastMessage && Array.isArray(lastMessage.content) && lastMessage.content[0]?.type === 'text') {
      const reply = (lastMessage.content[0] as any).text.value;
      
      // Retornar resposta com thread_id para continuidade
      if (reply && threadId) {
        return { reply, threadId };
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao chamar assistente OpenAI:', error);
    return null;
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
    // Mascarar telefone e não logar o conteúdo completo da mensagem
    const maskedPhone = phone ? String(phone).replace(/\d(?=\d{4})/g, 'x') : '';
    console.log(`📤 Enviando mensagem para ${maskedPhone}: [len=${message.length}]`);
    
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