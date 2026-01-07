import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar a chave da API do OpenAI das variáveis de ambiente
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'Chave da API OpenAI não configurada' },
        { status: 500 }
      );
    }

    // Criar prompt estruturado para gerar oração completa
    const systemPrompt = `Você é um assistente especializado em criar orações cristãs completas. 
    Baseado no tema fornecido, crie uma oração estruturada com título, sub-título, texto da oração e descrição para imagem.
    
    IMPORTANTE: Retorne APENAS um JSON válido com a seguinte estrutura:
    {
      "title": "Título da oração (máximo 60 caracteres)",
      "subtitle": "Sub-título explicativo (máximo 100 caracteres)", 
      "prayer_text": "Texto completo da oração (100-300 palavras, estrutura tradicional: invocação, petição/gratidão, conclusão)",
      "image_prompt": "Descrição detalhada para gerar imagem religiosa relacionada ao tema (máximo 200 caracteres)"
    }
    
    Use linguagem reverente mas acessível, adequada para o contexto cristão brasileiro.`;

    const userPrompt = `Crie uma oração completa baseada no seguinte tema: ${prompt}`;

    // Chamar a API do OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro da API OpenAI:', error);
      return NextResponse.json(
        { error: 'Erro ao gerar oração' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const generatedContent = data.choices[0]?.message?.content;

    if (!generatedContent) {
      return NextResponse.json(
        { error: 'Nenhum conteúdo foi gerado' },
        { status: 500 }
      );
    }

    try {
      // Tentar fazer parse do JSON retornado
      const prayerData = JSON.parse(generatedContent.trim());
      
      // Validar se tem os campos necessários
      if (!prayerData.title || !prayerData.subtitle || !prayerData.prayer_text || !prayerData.image_prompt) {
        throw new Error('Estrutura JSON inválida');
      }

      return NextResponse.json(prayerData);

    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      console.error('Conteúdo recebido:', generatedContent);
      
      // Fallback: retornar como texto simples
      return NextResponse.json({
        title: `Oração: ${prompt.substring(0, 50)}`,
        subtitle: 'Oração gerada por IA',
        prayer_text: generatedContent.trim(),
        image_prompt: `Imagem religiosa relacionada a ${prompt}`
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na API generate-prayer:', errorMessage);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
