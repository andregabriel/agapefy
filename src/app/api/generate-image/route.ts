import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    console.log('🖼️ Iniciando geração de imagem com DALL-E 3...');
    console.log('📝 Prompt recebido:', prompt);

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.error('❌ Prompt da imagem é obrigatório e deve ser uma string não vazia');
      return NextResponse.json(
        { error: 'Prompt da imagem é obrigatório e deve ser uma string não vazia' },
        { status: 400 }
      );
    }

    // Buscar a chave da API do OpenAI das variáveis de ambiente
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.error('❌ Chave da API OpenAI não configurada');
      return NextResponse.json(
        { error: 'Chave da API OpenAI não configurada' },
        { status: 500 }
      );
    }

    console.log('🔑 Chave OpenAI encontrada');
    console.log('🎨 Gerando imagem com DALL-E 3 (melhor versão)...');

    // Garantir que o prompt está limpo e dentro do limite
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length > 4000) {
      console.error('❌ Prompt muito longo (máximo 4000 caracteres para DALL-E 3)');
      return NextResponse.json(
        { error: 'Prompt muito longo. Máximo 4000 caracteres.' },
        { status: 400 }
      );
    }

    console.log('🎯 Prompt final:', cleanPrompt);

    // Objeto de requisição para DALL-E 3 com melhor qualidade
    const dalleRequest = {
      model: 'dall-e-3',
      prompt: cleanPrompt,
      n: 1,
      size: '256x256', // Tamanho menor conforme solicitado
      quality: 'hd', // Alta definição
      style: 'natural' // Estilo natural para imagens religiosas
    };

    console.log('📦 Objeto de requisição DALL-E 3:', dalleRequest);

    // Chamar a API do DALL-E 3 da OpenAI
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dalleRequest),
    });

    console.log('📡 Status da resposta DALL-E 3:', response.status);
    console.log('📡 Headers da resposta DALL-E 3:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const buildErrorPayload = async (resp: Response, reqBody: any) => {
        const errorText = await resp.text().catch(() => '');
        console.error('❌ Erro da API DALL-E 3:', errorText);
        let errorMessage = 'Erro ao gerar imagem';
        let errorDetails: any = {};
        try {
          if (errorText && errorText.trim()) {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
            errorDetails = errorJson;
          } else {
            errorDetails = { rawError: '(vazio)' };
          }
        } catch (e) {
          console.error('❌ Não foi possível fazer parse do erro:', e);
          errorDetails = { rawError: errorText };
        }
        return { error: errorMessage, details: errorDetails, requestSent: reqBody };
      };

      // Retry único com qualidade padrão caso erro 5xx ou corpo vazio
      const shouldRetry = response.status >= 500;
      if (shouldRetry) {
        const retryReq = { ...dalleRequest, quality: 'standard' } as any;
        console.warn('↻ Retry DALL-E 3 com quality=standard');
        const retryResp = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retryReq),
        });
        console.log('📡 Status retry DALL-E 3:', retryResp.status);
        if (retryResp.ok) {
          const retryData = await retryResp.json();
          const imageUrlRetry = retryData.data?.[0]?.url;
          if (imageUrlRetry) {
            return NextResponse.json({ 
              image_url: imageUrlRetry,
              prompt_used: cleanPrompt,
              revised_prompt: retryData.data?.[0]?.revised_prompt,
              dalle_request: retryReq,
              dalle_response: retryData,
              model_used: 'dall-e-3'
            });
          }
        }
        const payload = await buildErrorPayload(retryResp, retryReq);
        return NextResponse.json(payload, { status: retryResp.status });
      }

      const payload = await buildErrorPayload(response, dalleRequest);
      return NextResponse.json(payload, { status: response.status });
    }

    const data = await response.json();
    console.log('📦 Dados recebidos da DALL-E 3:', data);

    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt; // DALL-E 3 pode revisar o prompt

    if (!imageUrl) {
      console.error('❌ Nenhuma URL de imagem encontrada na resposta');
      return NextResponse.json(
        { error: 'Nenhuma imagem foi gerada', responseData: data },
        { status: 500 }
      );
    }

    console.log('✅ Imagem gerada com sucesso (DALL-E 3):', imageUrl);
    if (revisedPrompt) {
      console.log('📝 Prompt revisado pelo DALL-E 3:', revisedPrompt);
    }

    return NextResponse.json({ 
      image_url: imageUrl,
      prompt_used: cleanPrompt,
      revised_prompt: revisedPrompt,
      dalle_request: dalleRequest,
      dalle_response: data,
      model_used: 'dall-e-3'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro na API generate-image:', errorMessage);
    console.error('🔍 Stack trace:', error);
    
    return NextResponse.json(
      { 
        error: `Erro interno do servidor: ${errorMessage}`,
        details: { stack: error instanceof Error ? error.stack : undefined },
        requestSent: null
      },
      { status: 500 }
    );
  }
}