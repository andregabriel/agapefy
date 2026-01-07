import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json({
        success: false,
        error: 'CHAVE_NAO_CONFIGURADA',
        message: 'Chave OpenAI não configurada',
        solution: 'Configure OPENAI_API_KEY no arquivo .env.local'
      });
    }

    if (!openaiApiKey.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: 'CHAVE_INVALIDA',
        message: 'Formato da chave OpenAI inválido',
        solution: 'A chave deve começar com "sk-"'
      });
    }

    // Testar conexão com OpenAI
    const testResponse = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
    });

    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      
      if (testResponse.status === 401) {
        return NextResponse.json({
          success: false,
          error: 'CHAVE_INVALIDA',
          message: 'Chave OpenAI inválida ou expirada',
          solution: 'Verifique se a chave está correta em https://platform.openai.com/api-keys'
        });
      }
      
      if (testResponse.status === 429) {
        return NextResponse.json({
          success: false,
          error: 'LIMITE_EXCEDIDO',
          message: 'Limite de uso da OpenAI excedido',
          solution: 'Verifique seus créditos em https://platform.openai.com/usage'
        });
      }

      return NextResponse.json({
        success: false,
        error: 'ERRO_API',
        message: `Erro na API OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`,
        solution: 'Verifique o status da OpenAI'
      });
    }

    const models = await testResponse.json();
    const hasGPT4o = models.data.some((model: any) => model.id === 'gpt-4o');
    const recommendedModel = hasGPT4o ? 'gpt-4o' : 'gpt-4-turbo-preview';

    return NextResponse.json({
      success: true,
      message: 'OpenAI configurada e funcionando!',
      key_format: 'Válida',
      models_available: models.data.length,
      recommended_model: recommendedModel,
      has_gpt4o: hasGPT4o
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'ERRO_CONEXAO',
      message: 'Erro de conexão com OpenAI',
      solution: 'Verifique sua conexão com a internet',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'Texto é obrigatório'
      }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json({
        success: false,
        error: 'CHAVE_NAO_CONFIGURADA',
        message: 'Chave OpenAI não configurada'
      });
    }

    // Detectar intenção
    const intention = detectIntention(text);
    const systemPrompt = getSystemPrompt(intention);

    console.log('🧠 Testando IA com GPT-4o...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Melhor modelo
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('Erro da OpenAI:', error);
      return NextResponse.json({
        success: false,
        error: 'ERRO_API_OPENAI',
        message: 'Erro na API da OpenAI',
        details: error
      });
    }

    const data = await openaiResponse.json();
    const response = data.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json({
        success: false,
        error: 'RESPOSTA_VAZIA',
        message: 'OpenAI não retornou resposta'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'IA funcionando perfeitamente!',
      intention: intention,
      response: response,
      model_used: 'gpt-4o',
      tokens_used: data.usage?.total_tokens || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no teste da OpenAI:', error);
    return NextResponse.json({
      success: false,
      error: 'ERRO_INTERNO',
      message: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

function detectIntention(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('olá') || lowerText.includes('oi') || lowerText.includes('ola') || 
      lowerText.includes('bom dia') || lowerText.includes('boa tarde') || lowerText.includes('boa noite')) {
    return 'greeting';
  }
  
  if (lowerText.includes('oração') || lowerText.includes('ore') || lowerText.includes('dificuldade') || 
      lowerText.includes('problema') || lowerText.includes('triste') || lowerText.includes('ansioso')) {
    return 'prayer_request';
  }
  
  if (lowerText.includes('bíblia') || lowerText.includes('versículo') || lowerText.includes('jesus') ||
      lowerText.includes('deus') || lowerText.includes('parábola') || lowerText.includes('joão') ||
      lowerText.includes('salmo') || lowerText.includes('provérbio')) {
    return 'bible_question';
  }
  
  if (lowerText.includes('versículo do dia') || lowerText.includes('/versiculo')) {
    return 'daily_verse';
  }
  
  if (lowerText.includes('conselho') || lowerText.includes('orientação') || lowerText.includes('direção')) {
    return 'spiritual_guidance';
  }
  
  return 'general_conversation';
}

function getSystemPrompt(intention: string): string {
  const prompts = {
    greeting: `Você é Agape, um assistente espiritual cristão carinhoso. O usuário está cumprimentando você. Responda de forma calorosa e acolhedora, perguntando como ele está.`,
    prayer_request: `Você é Agape, um assistente espiritual cristão. O usuário precisa de oração. Crie uma oração personalizada e reconfortante para a situação dele. Use linguagem acolhedora.`,
    bible_question: `Você é Agape, especialista da Bíblia. Responda perguntas bíblicas com conhecimento teológico e referências bíblicas. Seja didático e acessível.`,
    daily_verse: `Você é Agape. Forneça um versículo bíblico inspirador com explicação breve.`,
    spiritual_guidance: `Você é Agape, conselheiro espiritual cristão. Ofereça orientação baseada nos ensinamentos bíblicos com empatia e sabedoria.`,
    general_conversation: `Você é Agape, companheiro espiritual cristão inteligente e carinhoso. Responda naturalmente com empatia e sabedoria cristã.`
  };

  return prompts[intention as keyof typeof prompts] || prompts.general_conversation + `

IMPORTANTE:
- Seu nome é Agape
- Seja natural, empático e inteligente
- Use emojis apropriados mas sem exagero
- Mantenha respostas entre 100-400 caracteres para WhatsApp
- Seja genuinamente útil e acolhedor
- Para cumprimentos simples como "olá", responda "Olá, como você está?"`;
}
