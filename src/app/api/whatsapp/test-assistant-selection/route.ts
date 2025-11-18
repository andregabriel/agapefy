import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Interfaces (mesmas da API principal)
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

// Função auxiliar para normalizar texto (mesma da API principal)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Usa GPT como classificador leve para entender a intenção principal da mensagem.
 * Mesma função da API principal.
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
              '- "indeterminado": Quando a mensagem for muito genérica, social (tipo só "oi", "bom dia") ou não der para saber com clareza se é sobre o app ou sobre Bíblia.\n\n' +
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

/**
 * Função de seleção de assistente - mesma lógica da API principal.
 * Retorna o assistente selecionado e o motivo da seleção.
 */
async function selectAssistantByMessage(
  message: string,
  settingsMap?: Record<string, string>
): Promise<{ assistant: Assistant | null; reason: string }> {
  try {
    // Carregar configuração de assistentes
    const assistantRules = settingsMap?.['whatsapp_assistant_rules'];
    if (!assistantRules) {
      return { assistant: null, reason: 'Configuração de assistentes não encontrada' };
    }

    // Parse da configuração
    let config: AssistantConfig;
    try {
      config = JSON.parse(assistantRules);
    } catch {
      return { assistant: null, reason: 'Erro ao fazer parse da configuração de assistentes' };
    }

    if (!config.assistants || !Array.isArray(config.assistants) || config.assistants.length === 0) {
      return { assistant: null, reason: 'Nenhum assistente configurado' };
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
        return { 
          assistant: supportAssistant, 
          reason: `Palavra-chave de suporte explícita encontrada: "${explicitSupportKeywords.find(k => normalizedMessage.includes(normalizeText(k)))}"` 
        };
      }
    }

    // PRIORIDADE 1: Verificar palavras-chave explícitas de cada assistente habilitado
    for (const assistant of config.assistants.filter(a => a.enabled)) {
      const matchedKeywords = assistant.keywords.filter(kw => 
        normalizedMessage.includes(normalizeText(kw))
      );
      
      if (matchedKeywords.length > 0) {
        return { 
          assistant, 
          reason: `Palavras-chave encontradas: ${matchedKeywords.join(', ')}` 
        };
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
        return { 
          assistant: supportAssistant, 
          reason: 'Contexto detectado: Pergunta de suporte/vendas (detecção inteligente)' 
        };
      }
    }

    // Verificar padrões bíblicos
    const isBiblicalQuestion = biblicalPatterns.some(pattern => pattern.test(originalMessage));
    
    if (isBiblicalQuestion) {
      const biblicalAssistant = config.assistants.find(a => 
        a.enabled && a.type === 'biblical'
      );
      
      if (biblicalAssistant) {
        return { 
          assistant: biblicalAssistant, 
          reason: 'Contexto detectado: Pergunta bíblica/espiritual (detecção inteligente)' 
        };
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
        return { 
          assistant: supportAssistant, 
          reason: 'Estrutura detectada: Pergunta funcional (análise de estrutura)' 
        };
      }
    }

    // Mensagens com problemas/erros = suporte
    if (originalMessage.match(/\b(não|erro|problema|dificuldade|ajuda)\b/i) && 
        !originalMessage.match(/\b(bíblia|biblia|versículo|jesus|deus)\b/i)) {
      const supportAssistant = config.assistants.find(a => 
        a.enabled && (a.type === 'support' || a.type === 'sales')
      );
      if (supportAssistant) {
        return { 
          assistant: supportAssistant, 
          reason: 'Estrutura detectada: Problema técnico (análise de estrutura)' 
        };
      }
    }

    // PRIORIDADE 3.5: Análise de IA
    const aiClassification = await analyzeMessageIntentWithAI(message);
    
    if (aiClassification === 'support_sales') {
      const supportAssistant = config.assistants.find(a => 
        a.enabled && a.type === 'support'
      ) || config.assistants.find(a => 
        a.enabled && a.type === 'sales'
      );
      if (supportAssistant) {
        return { 
          assistant: supportAssistant, 
          reason: `Análise de IA: ${aiClassification} (classificação inteligente)` 
        };
      }
    }

    if (aiClassification === 'biblical') {
      const biblicalAssistant = config.assistants.find(a => 
        a.enabled && a.type === 'biblical'
      );
      if (biblicalAssistant) {
        return { 
          assistant: biblicalAssistant, 
          reason: `Análise de IA: ${aiClassification} (classificação inteligente)` 
        };
      }
    }

    // PRIORIDADE 4: Fallback - sempre priorizar suporte/vendas
    const supportAssistant = config.assistants.find(a => 
      a.enabled && a.type === 'support'
    ) || config.assistants.find(a => 
      a.enabled && a.type === 'sales'
    );

    if (supportAssistant) {
      return { 
        assistant: supportAssistant, 
        reason: aiClassification === 'indeterminado' 
          ? 'Análise de IA retornou "indeterminado", usando assistente de suporte/vendas como padrão'
          : 'Nenhuma palavra-chave ou contexto específico encontrado, usando assistente de suporte/vendas como padrão'
      };
    }

    // Último recurso: qualquer assistente habilitado
    const defaultAssistant = config.assistants.find(a => 
      a.enabled && (a.id === config.defaultAssistantId || !config.defaultAssistantId)
    ) || config.assistants.find(a => a.enabled);

    if (defaultAssistant) {
      return { 
        assistant: defaultAssistant, 
        reason: 'Nenhuma palavra-chave ou contexto específico encontrado, usando assistente padrão configurado'
      };
    }

    return { assistant: null, reason: 'Nenhum assistente habilitado encontrado' };
  } catch (error) {
    console.error('❌ Erro ao selecionar assistente:', error);
    return { assistant: null, reason: `Erro ao selecionar assistente: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    // Carregar configurações
    const { data: settingsRows } = await supabase
      .from('app_settings')
      .select('key,value')
      .eq('key', 'whatsapp_assistant_rules');

    const settingsMap: Record<string, string> = {};
    if (settingsRows) {
      for (const row of settingsRows) {
        settingsMap[row.key] = row.value as string;
      }
    }

    // Selecionar assistente usando a mesma lógica da API principal
    const result = await selectAssistantByMessage(message, settingsMap);

    return NextResponse.json({
      success: true,
      assistant: result.assistant,
      reason: result.reason,
      message: message
    });

  } catch (error) {
    console.error('❌ Erro no teste de seleção de assistente:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao testar seleção de assistente',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}


