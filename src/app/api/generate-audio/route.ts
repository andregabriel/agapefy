import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🎵 API generate-audio: Iniciando processamento...');
    
    const { text, voice_id = 'pNInz6obpgDQGcFmaJgB', voice_settings } = await request.json();

    if (!text) {
      console.error('❌ API generate-audio: Texto não fornecido');
      return NextResponse.json(
        { error: 'Texto é obrigatório' },
        { status: 400 }
      );
    }

    console.log('📝 API generate-audio: Texto recebido:', text.substring(0, 100) + '...');
    console.log('🎤 API generate-audio: Voice ID recebido:', voice_id);

    // Buscar a chave da API do ElevenLabs das variáveis de ambiente
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    
    console.log('🔍 API generate-audio: Verificando variáveis de ambiente...');
    console.log('🔍 API generate-audio: ELEVENLABS_API_KEY existe?', !!elevenlabsApiKey);
    console.log('🔍 API generate-audio: ELEVENLABS_API_KEY primeiros chars:', elevenlabsApiKey ? elevenlabsApiKey.substring(0, 8) + '...' : 'undefined');
    
    if (!elevenlabsApiKey) {
      console.error('❌ API generate-audio: Chave da API ElevenLabs não configurada');
      console.error('❌ API generate-audio: Variáveis disponíveis:', Object.keys(process.env).filter(key => key.includes('ELEVEN')));
      
      return NextResponse.json(
        { 
          error: 'Chave da API ElevenLabs não configurada',
          details: 'Configure a variável ELEVENLABS_API_KEY nas configurações do ambiente',
          instructions: 'Vá em Configurações → Environment Variables → Adicione ELEVENLABS_API_KEY'
        },
        { status: 500 }
      );
    }

    console.log('✅ API generate-audio: Chave da API encontrada');

    // Garantir que estamos usando exatamente o voice_id fornecido
    const finalVoiceId = voice_id || 'pNInz6obpgDQGcFmaJgB';
    console.log('🎯 API generate-audio: Voice ID final usado:', finalVoiceId);

    const requestBody: Record<string, unknown> = {
      text: text,
      model_id: 'eleven_multilingual_v2',
      ...(voice_settings ? { voice_settings } : {})
    };

    console.log('📡 API generate-audio: Enviando requisição para ElevenLabs...');
    console.log('🔗 API generate-audio: URL:', `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`);

    // Chamar a API do ElevenLabs para gerar áudio com a voz específica
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 API generate-audio: Status da resposta ElevenLabs:', response.status);
    console.log('📡 API generate-audio: Headers da resposta:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorDetails;
      try {
        const errorText = await response.text();
        console.error('❌ API generate-audio: Erro da API ElevenLabs (texto):', errorText);
        
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { message: errorText };
        }
      } catch (readError) {
        console.error('❌ API generate-audio: Erro ao ler resposta de erro:', readError);
        errorDetails = { message: 'Erro desconhecido da API ElevenLabs' };
      }

      console.error('❌ API generate-audio: Erro detalhado:', {
        status: response.status,
        statusText: response.statusText,
        voiceId: finalVoiceId,
        errorDetails
      });

      return NextResponse.json(
        { 
          error: 'Erro ao gerar áudio',
          details: errorDetails,
          status: response.status,
          statusText: response.statusText,
          voiceId: finalVoiceId
        },
        { status: 500 }
      );
    }

    console.log('✅ API generate-audio: Resposta OK da ElevenLabs');

    // Converter o áudio para base64
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    
    console.log('📦 API generate-audio: Áudio convertido para base64, tamanho:', audioBase64.length);
    
    // Criar URL de dados para o áudio
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    console.log('✅ API generate-audio: Áudio gerado com sucesso usando voice_id:', finalVoiceId);

    return NextResponse.json({ 
      audio_url: audioDataUrl,
      audio_base64: audioBase64,
      content_type: 'audio/mpeg',
      voice_id_used: finalVoiceId,
      success: true
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ API generate-audio: Erro geral:', {
      message: errorMessage,
      stack: errorStack,
      error
    });
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: errorMessage,
        stack: errorStack
      },
      { status: 500 }
    );
  }
}