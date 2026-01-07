import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Texto é obrigatório' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'Chave da OpenAI não configurada' },
        { status: 500 }
      );
    }

    // Detectar intenção do texto
    const intention = detectIntention(text);

    // Gerar resposta baseada na intenção
    const systemPrompt = getSystemPrompt(intention);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
      return NextResponse.json(
        { error: 'Erro na API da OpenAI' },
        { status: 500 }
      );
    }

    const data = await openaiResponse.json();
    const response = data.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { error: 'Nenhuma resposta gerada' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      intention: intention,
      response: response,
      model: 'gpt-4o',
      tokens_used: data.usage?.total_tokens || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro no teste da OpenAI:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

function detectIntention(text: string): string {
  const lowerText = text.toLowerCase();
  
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
- Seja genuinamente útil e acolhedor`;
}
