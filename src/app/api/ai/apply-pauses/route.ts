import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Texto é obrigatório', detail: 'O campo "text" deve ser uma string não vazia.' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.error('❌ apply-pauses: OPENAI_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Chave da OpenAI não configurada no servidor.' },
        { status: 500 }
      );
    }

    const promptWithContext = text;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'Você é um assistente que adiciona marcações SSML de pausas (<break time="Xs" />) em textos de oração.',
          },
          { role: 'user', content: promptWithContext },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('❌ apply-pauses: erro da OpenAI', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      return NextResponse.json(
        { error: 'Erro ao gerar pausas automáticas na OpenAI.' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content && typeof data.choices[0].message.content === 'string'
        ? data.choices[0].message.content
        : text;

    return NextResponse.json({ text: content });
  } catch (error) {
    console.error('❌ apply-pauses: erro inesperado', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar pausas automáticas.' },
      { status: 500 }
    );
  }
}


