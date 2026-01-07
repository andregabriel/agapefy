import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin, requireWebhookSecret } from '@/lib/api-auth';

const ZAPI_INSTANCE_NAME = process.env.ZAPI_INSTANCE_NAME as string;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN as string;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN as string;
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function POST(request: NextRequest) {
  try {
    const webhookAuth = requireWebhookSecret(request, 'WHATSAPP_WEBHOOK_SECRET');
    if (webhookAuth) {
      const adminAuth = await requireAdmin(request);
      if (!adminAuth.ok) return webhookAuth;
    }

    if (!ZAPI_INSTANCE_NAME || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      return NextResponse.json({ error: 'Z-API credentials not configured' }, { status: 500 });
    }

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
      // Tentar ler como JSON diretamente
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
    
    console.log('🔔 Webhook RECEIVE recebido:', JSON.stringify(body, null, 2));
    
    // Verificar se body é válido
    if (!body || typeof body !== 'object') {
      console.log('❌ Body inválido ou não é um objeto');
      return NextResponse.json({ status: 'ignored', reason: 'invalid_body' }, { status: 200 });
    }

    // Verificar se é mensagem nossa (deve ser ignorada)
    if (body.fromMe === true) {
      console.log('⚠️ Mensagem ignorada - é nossa própria mensagem (fromMe=true)');
      return NextResponse.json({ status: 'ignored', reason: 'own_message' });
    }

    // Normalizar campos do Z-API: pode vir em diferentes formatos
    // Formato 1: body.phone (padrão Z-API)
    // Formato 2: body.remoteJid (formato WhatsApp Business API)
    // Formato 3: body.chatId (formato alternativo)
    // Formato 4: body.data?.phone (formato aninhado)
    const userPhoneRaw = body.phone || body.remoteJid || body.chatId || body.data?.phone || '';
    const userPhone = typeof userPhoneRaw === 'string' ? userPhoneRaw.replace(/\D/g, '') : '';
    // Versão mascarada para logs (mantém apenas últimos 4 dígitos)
    const maskedUserPhone = userPhone ? userPhone.replace(/\d(?=\d{4})/g, 'x') : '';
    
    // Extrair Message ID para Idempotência (fundamental para evitar duplicações em retries)
    const messageId = body.messageId || body.id || body.data?.messageId || body.data?.id;
    console.log(`🔑 Message ID recebido: ${messageId || 'NÃO ENCONTRADO'}`);

    // Normalizar conteúdo da mensagem - Z-API pode enviar em diferentes formatos
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
      });
    }
    
    if (!messageContent || !messageContent.trim()) {
      console.log('❌ Mensagem ignorada - conteúdo vazio');
      console.log('  Estrutura do body.message:', JSON.stringify(body.message, null, 2));
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'empty_message',
        message_structure: body.message
      });
    }

    console.log(`📱 Processando mensagem de ${userName} (${maskedUserPhone}): [len=${messageContent.length}]`);

    // ------------------------------------------------------------------
    // Proteção contra duplicidade de processamento
    // ------------------------------------------------------------------
    // Alguns provedores de webhook (incluindo Z-API) podem reenviar o mesmo
    // evento em casos de timeout/intermitência de rede. Para evitar que o
    // usuário receba respostas duplicadas e que a conversa seja registrada
    // duas vezes, verificamos se já existe uma conversa recente com o mesmo
    // número + conteúdo (normalizado) de mensagem.
    try {
      // Normalizar texto para deduplicação (minimiza diferenças de caixa,
      // acentos e espaços em branco).
      const normalizeForDedup = (text: string): string => {
        const base = normalizeText(text || '');
        return base.replace(/\s+/g, ' ').trim();
      };

      const normalizedCurrent = normalizeForDedup(messageContent);
      const fingerprint = `${userPhone}|${normalizedCurrent}`;

      console.log('🧬 Fingerprint de deduplicação (receive):', fingerprint.substring(0, 120));

      const duplicateWindowMs = 60 * 1000; // 60 segundos
      const since = new Date(Date.now() - duplicateWindowMs).toISOString();

      // Buscar últimas conversas recentes desse usuário dentro da janela
      const { data: recentConversations, error: dupError } = await supabase
        .from('whatsapp_conversations')
        .select('id, created_at, message_content')
        .eq('user_phone', userPhone)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);

      if (dupError) {
        console.warn('⚠️ Erro ao verificar duplicidade de conversa (receive):', dupError);
      } else if (recentConversations && recentConversations.length > 0) {
        const duplicateConversation = recentConversations.find(conv => {
          const normalizedStored = normalizeForDedup(conv.message_content || '');
          return normalizedStored === normalizedCurrent;
        });

        if (duplicateConversation) {
          console.log(
            '⚠️ Mensagem duplicada detectada (receive) - ignorando processamento para evitar respostas em duplicidade. Conversa correspondente:',
            {
              id: duplicateConversation.id,
              created_at: duplicateConversation.created_at,
            }
          );
          return NextResponse.json(
            {
              status: 'ignored',
              reason: 'duplicate_message',
              phone: userPhone,
              message_preview: messageContent.substring(0, 80),
            },
            { status: 200 }
          );
        }
      }

      console.log('✅ Nenhuma duplicidade recente detectada para este webhook (receive)');
    } catch (dupCheckError) {
      console.warn('⚠️ Falha inesperada ao checar duplicidade (receive):', dupCheckError);
      // Em caso de erro na checagem, continuamos o fluxo normal para não
      // bloquear o processamento da mensagem.
    }

    // Verificar se usuário já existe antes de fazer upsert
    console.log('👤 Verificando/registrando usuário...');
    console.log(`📞 Número normalizado (mascarado): ${maskedUserPhone}`);
    
    const { data: existingUser, error: userError } = await supabase
      .from('whatsapp_users')
      .select('has_sent_first_message')
      .eq('phone_number', userPhone)
      .maybeSingle();
    
    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
    }
    
    // Se não existe, criar com has_sent_first_message: false
    // Se existe, manter o valor atual de has_sent_first_message
    const hasSentFirstMessage = existingUser?.has_sent_first_message ?? false;
    
    console.log(`👤 Usuário existente: ${existingUser ? 'SIM' : 'NÃO'}, has_sent_first_message: ${hasSentFirstMessage}`);
    
    const upsertResult = await supabase.from('whatsapp_users').upsert({
      phone_number: userPhone,
      name: userName,
      is_active: true,
      receives_daily_verse: true,
      has_sent_first_message: hasSentFirstMessage,
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });
    
    if (upsertResult.error) {
      console.error('❌ Erro ao fazer upsert do usuário:', upsertResult.error);
    } else {
      console.log(`✅ Usuário ${userPhone} registrado/atualizado com sucesso`);
    }

    // Carregar configurações úteis (boas-vindas, menu e regras de assistentes)
    const settingsRows = await supabase.from('app_settings').select('key,value').in('key', [
      'whatsapp_send_welcome_enabled',
      'whatsapp_welcome_message',
      'whatsapp_menu_message',
      'whatsapp_menu_enabled',
      'whatsapp_menu_reminder_enabled',
      'whatsapp_assistant_rules'
    ]);
    
    if (settingsRows.error) {
      console.error('❌ Erro ao carregar configurações:', settingsRows.error);
    }
    
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows.data || []) settingsMap[r.key] = r.value as string;
    
    console.log('⚙️ Configurações carregadas:', {
      'whatsapp_send_welcome_enabled': settingsMap['whatsapp_send_welcome_enabled'] ?? 'não encontrado',
      'whatsapp_welcome_message': settingsMap['whatsapp_welcome_message'] ? `${settingsMap['whatsapp_welcome_message'].length} caracteres` : 'não encontrado',
      'whatsapp_menu_enabled': settingsMap['whatsapp_menu_enabled'] ?? 'não encontrado',
      'whatsapp_menu_message': settingsMap['whatsapp_menu_message'] ? `${settingsMap['whatsapp_menu_message'].length} caracteres` : 'não encontrado',
    });

    // Verificar se é a primeira mensagem do usuário (usando has_sent_first_message)
    // IMPORTANTE: Se o usuário não existia antes, isFirstMessage será true
    // Se existia mas has_sent_first_message era false, também será true
    const isFirstMessage = !hasSentFirstMessage;
    
    console.log(`🔍 Verificação de primeira mensagem para ${userPhone}:`);
    console.log(`  - existingUser: ${existingUser ? 'existe' : 'não existe'}`);
    console.log(`  - hasSentFirstMessage: ${hasSentFirstMessage}`);
    console.log(`  - isFirstMessage: ${isFirstMessage}`);

    // ------------------------------------------------------------------
    // Inserção antecipada da conversa ("Claim") com Idempotência
    // ------------------------------------------------------------------
    // Para evitar race condition em reenvios do webhook, inserimos o registro
    // imediatamente com status pendente e o message_id ÚNICO.
    // O banco de dados garantirá que apenas uma inserção com este message_id tenha sucesso.
    console.log('💾 Inserindo conversa antecipada (status: Processando)...');
    
    const conversationType = detectConversationType(messageContent);
    
    const insertPayload: any = {
        user_phone: userPhone,
        conversation_type: conversationType,
        message_content: messageContent,
        response_content: 'Processando...', // Placeholder
        message_type: 'text'
    };

    // Se tivermos messageId, incluímos para garantir unicidade física
    if (messageId) {
      insertPayload.message_id = messageId;
    }

    const { data: insertedConversation, error: insertError } = await supabase
      .from('whatsapp_conversations')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      // Verificar se é erro de duplicidade (código 23505 no Postgres)
      // O Supabase pode retornar isso no details ou code
      const isDuplicate = insertError.code === '23505' || 
                          insertError.message?.includes('duplicate key') ||
                          insertError.details?.includes('already exists');

      if (isDuplicate) {
        console.log(`⚠️ Mensagem duplicada detectada pelo BANCO (message_id: ${messageId}) - Abortando.`);
        return NextResponse.json({ 
          status: 'ignored', 
          reason: 'duplicate_message_id',
          message_id: messageId
        }, { status: 200 });
      }

      console.error('❌ Erro ao inserir conversa antecipada:', insertError);
      // Se falhar por outro motivo, seguimos (mas sem proteção de ID)
    }
    
    const conversationId = insertedConversation?.id;
    console.log(`📝 Conversa iniciada com ID: ${conversationId}`);

    // Gerar resposta inteligente com IA
    console.log('🤖 Gerando resposta inteligente...');
    const responseResult = await generateIntelligentResponse(request, messageContent, userName, userPhone, settingsMap);
    const response = typeof responseResult === 'string' ? responseResult : responseResult.response;
    const responseThreadId = typeof responseResult === 'object' ? responseResult.threadId : undefined;
    console.log(`💬 Resposta gerada: "${response}"`);

    // Atualizar conversa no banco com a resposta final
    if (conversationId) {
      console.log('💾 Atualizando conversa com resposta final...');
      const updateData: any = {
        response_content: response,
        // Se detectarmos mudança de tipo durante processamento, poderíamos atualizar aqui
        // mas por hora mantemos o tipo inicial ou detectamos de novo se quiser
      };
      
      if (responseThreadId) {
        updateData.thread_id = responseThreadId;
      }

      const { error: updateError } = await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', conversationId);
        
      if (updateError) {
        console.error('❌ Erro ao atualizar conversa:', updateError);
      }
    } else {
      // Fallback: se não conseguiu inserir antes, tenta inserir agora
      console.log('💾 Salvando conversa (fallback)...');
      const conversationData: any = {
        user_phone: userPhone,
        conversation_type: detectConversationType(messageContent),
        message_content: messageContent,
        response_content: response,
        message_type: 'text'
      };
      if (responseThreadId) {
        conversationData.thread_id = responseThreadId;
      }
      await supabase.from('whatsapp_conversations').insert(conversationData);
    }

    // Enviar resposta principal via Z-API
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
          console.log(`🎉 Primeira mensagem detectada para ${maskedUserPhone} (${userName})`);
      
      await supabase
        .from('whatsapp_users')
        .update({ has_sent_first_message: true, updated_at: new Date().toISOString() })
        .eq('phone_number', userPhone);
      
      // Se boas-vindas estiver ativada, enviar a mensagem de boas-vindas + menu
      const sendWelcome = (settingsMap['whatsapp_send_welcome_enabled'] ?? 'true') === 'true';
      const menuEnabled = (settingsMap['whatsapp_menu_enabled'] ?? 'false') === 'true';
      const welcomeText = settingsMap['whatsapp_welcome_message'] || '';
      const menuText = settingsMap['whatsapp_menu_message'] || '';
      
      console.log(`📋 Configurações de boas-vindas para ${userPhone}:`);
      console.log(`  - sendWelcome: ${sendWelcome}`);
      console.log(`  - menuEnabled: ${menuEnabled}`);
      console.log(`  - welcomeText length: ${welcomeText.length}`);
      console.log(`  - menuText length: ${menuText.length}`);
      
      if (sendWelcome) {
        // Montar mensagem: boas-vindas + menu (se menu estiver ativado)
        const welcomeParts = [welcomeText];
        if (menuEnabled && menuText) {
          welcomeParts.push(menuText);
        }
        const welcomeMsg = welcomeParts.filter(Boolean).join('\n\n');
        
        console.log(`📝 Mensagem de boas-vindas montada (${welcomeMsg.length} caracteres):`);
        console.log(`  "${welcomeMsg.substring(0, 100)}${welcomeMsg.length > 100 ? '...' : ''}"`);
        
        if (welcomeMsg.trim()) {
          console.log(`📤 Enviando mensagem de boas-vindas para ${userPhone}...`);
          // Adicionar um pequeno delay para garantir que a resposta principal foi enviada primeiro
          await new Promise(resolve => setTimeout(resolve, 500));
          const welcomeResult = await sendWhatsAppMessage(userPhone, welcomeMsg);
          if (welcomeResult.success) {
            console.log(`✅ Mensagem de boas-vindas enviada com sucesso para ${userPhone}`);
          } else {
            console.error(`❌ Erro ao enviar mensagem de boas-vindas para ${userPhone}:`, welcomeResult.error);
            // Tentar novamente após 1 segundo em caso de erro
            console.log(`🔄 Tentando reenviar mensagem de boas-vindas para ${userPhone}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await sendWhatsAppMessage(userPhone, welcomeMsg);
            if (retryResult.success) {
              console.log(`✅ Mensagem de boas-vindas reenviada com sucesso para ${userPhone}`);
            } else {
              console.error(`❌ Erro ao reenviar mensagem de boas-vindas para ${userPhone}:`, retryResult.error);
            }
          }
        } else {
          console.warn(`⚠️ Mensagem de boas-vindas está vazia após trim, não enviando para ${userPhone}`);
          console.warn(`  - welcomeText: "${welcomeText.substring(0, 50)}${welcomeText.length > 50 ? '...' : ''}"`);
          console.warn(`  - menuEnabled: ${menuEnabled}`);
          console.warn(`  - menuText: "${menuText.substring(0, 50)}${menuText.length > 50 ? '...' : ''}"`);
        }
      } else {
        console.log(`⚠️ Boas-vindas desativada nas configurações para ${userPhone}`);
      }
    } else {
      console.log(`ℹ️ Não é primeira mensagem para ${userPhone} (has_sent_first_message=${hasSentFirstMessage})`);
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
      message: 'Mensagem processada com sucesso',
      response: response,
      user: userName,
      phone: userPhone,
      message_sent: sendResult.success,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro no webhook receive:', error);
    
    // Log detalhado do erro
    if (error instanceof Error) {
      console.error('  - Mensagem:', error.message);
      console.error('  - Stack:', error.stack);
    }

    // Tentar atualizar conversa pendente com erro, se houver ID, para não travar deduplicação
    // Precisamos extrair o ID de algum lugar ou ter acesso a ele. 
    // Como o try/catch engloba tudo, o conversationId não está acessível aqui facilmente 
    // se foi declarado dentro do try. Mas a lógica de deduplicação já trata "Processando..."
    // como duplicado, o que é bom. Se falhar, o usuário tenta de novo e a deduplicação
    // vai barrar por 60s. Isso é aceitável para evitar spam.
    
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
      return getDefaultResponse(message, userName);
    }

    // Detectar intenção usando apenas heurísticas internas
    let intention = detectIntention(message);
    console.log(`🎯 Intenção detectada: ${intention}`);
    
    // Buscar histórico de conversas recentes
    const { data: conversationHistory } = await supabase
      .from('whatsapp_conversations')
      .select('message_content, response_content')
      .eq('user_phone', userPhone)
      .order('created_at', { ascending: false })
      .limit(3);

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
        const onMsg = '✅ Versículo diário ativado. Você começará a receber todos os dias.';
        const offMsg = '❌ Versículo diário desativado. Você pode ativar quando quiser.';
        return enable ? onMsg : offMsg;
      }
      // Nenhuma ação explícita: instruir
      return 'Para receber o versículo do dia, envie: "ativar versículo diário". Para parar, envie: "parar versículo diário".';
    }

    // 2) Busca de orações (links do app)
    if (intention === 'prayer_request') {
      const query = extractPrayerQuery(message);
      const limit = 3;
      const results = await searchPrayers(query);
      const header = 'Encontrei estas orações no app:';
      const none = 'Não encontrei orações para esse tema. Tente outra palavra, como "fé", "família" ou "gratidão".';
      if (results.length === 0) {
        return none;
      }
      const lines = results.slice(0, limit).map((r, i) => `${i+1}. ${r.title} – https://agapefy.com/player/audio/${r.id}`);
      return `${header}\n\n${lines.join('\n')}`;
    }

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

    // Definir prompt do sistema baseado na intenção (apenas configuração interna)
    let systemPrompt = getSystemPrompt(intention);
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

    console.log('🚀 Fazendo requisição para OpenAI GPT-4o-mini...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Modelo otimizado para velocidade e custo
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

// ===== Interfaces e funções para Assistentes OpenAI =====
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
    // NOTA: Não definimos temperature/top_p aqui para respeitar as configurações 
    // definidas no Dashboard da OpenAI para cada assistente.
    const run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
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
  } catch (error: any) {
    console.error('❌ Erro ao chamar assistente OpenAI:', error);
    
    // Recuperação de erro de Thread: Se a thread não existe ou é inválida (400 ou 404),
    // removemos o thread_id da última conversa do usuário para forçar criação de nova na próxima.
    const errorMsg = error?.message || '';
    const isThreadError = errorMsg.includes('thread_') && (errorMsg.includes('404') || errorMsg.includes('400') || errorMsg.includes('not found'));
    
    if (isThreadError && userPhone) {
        console.log(`⚠️ Detectado erro de Thread inválida. Tentando limpar thread_id para usuário ${userPhone}...`);
        try {
            // Setar thread_id como null nas conversas recentes desse usuário para 'esquecer' a thread quebrada
            await supabase
                .from('whatsapp_conversations')
                .update({ thread_id: null })
                .eq('user_phone', userPhone)
                .not('thread_id', 'is', null);
            console.log('✅ Thread IDs limpos com sucesso.');
        } catch (cleanupError) {
            console.error('❌ Falha ao limpar thread_id:', cleanupError);
        }
    }

    return null;
  }
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
