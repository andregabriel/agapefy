import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseBuffer } from 'music-metadata';

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

    // Converter o áudio para buffer
    const audioBuffer = await response.arrayBuffer();
    
    console.log('📦 API generate-audio: Áudio recebido, tamanho:', audioBuffer.byteLength, 'bytes');

    // Tentar extrair duração do MP3 a partir do buffer
    let durationSeconds: number | null = null;
    try {
      const meta = await parseBuffer(Buffer.from(audioBuffer), 'audio/mpeg');
      durationSeconds = meta?.format?.duration ? Math.round(meta.format.duration) : null;
      console.log('⏱️ API generate-audio: Duração detectada (s):', durationSeconds);
    } catch (e) {
      console.warn('⚠️ API generate-audio: Falha ao obter duração do áudio via metadata. Prosseguindo sem duração.');
    }

    // Inicializar cliente Supabase para upload
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ API generate-audio: Credenciais do Supabase não configuradas');
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileName = `generated-${timestamp}-${randomStr}.mp3`;
    const filePath = `generated/${fileName}`;

    console.log('⬆️ API generate-audio: Fazendo upload para Supabase Storage...');
    console.log('📁 Arquivo:', filePath);

    // Upload para o Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audios')
      .upload(filePath, Buffer.from(audioBuffer), {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ API generate-audio: Erro ao fazer upload no Storage:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao salvar áudio no Storage', details: uploadError.message },
        { status: 500 }
      );
    }

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from('audios')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      console.error('❌ API generate-audio: Não foi possível obter URL pública');
      return NextResponse.json(
        { error: 'Erro ao obter URL pública do áudio' },
        { status: 500 }
      );
    }

    console.log('✅ API generate-audio: Áudio salvo no Storage:', publicUrlData.publicUrl);
    console.log('✅ API generate-audio: Áudio gerado com sucesso usando voice_id:', finalVoiceId);

    return NextResponse.json({ 
      audio_url: publicUrlData.publicUrl,
      content_type: 'audio/mpeg',
      voice_id_used: finalVoiceId,
      duration_seconds: durationSeconds,
      success: true,
      storage_path: filePath
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