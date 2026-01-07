import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    console.log('📤 API upload-audio-to-storage: Iniciando processamento...');
    
    const { audioBase64, fileName } = await request.json();

    if (!audioBase64) {
      console.error('❌ API upload-audio-to-storage: Base64 não fornecido');
      return NextResponse.json(
        { error: 'Base64 do áudio é obrigatório' },
        { status: 400 }
      );
    }

    // Inicializar cliente Supabase com as credenciais do servidor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ API upload-audio-to-storage: Credenciais do Supabase não configuradas');
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 API upload-audio-to-storage: Convertendo base64 para blob...');

    // Remover prefixo data URL se existir
    const base64Data = audioBase64.replace(/^data:audio\/[a-z]+;base64,/, '');
    
    // Converter base64 para buffer
    const audioBuffer = Buffer.from(base64Data, 'base64');
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const finalFileName = fileName || `audio-${timestamp}-${randomStr}.mp3`;
    const filePath = `generated/${finalFileName}`;

    console.log('⬆️ API upload-audio-to-storage: Fazendo upload para Supabase Storage...');
    console.log('📁 Arquivo:', filePath);

    // Upload para o Supabase Storage no bucket 'audios'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audios')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ API upload-audio-to-storage: Erro no upload:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao fazer upload do áudio', details: uploadError.message },
        { status: 500 }
      );
    }

    console.log('✅ API upload-audio-to-storage: Upload concluído');

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from('audios')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      console.error('❌ API upload-audio-to-storage: Não foi possível obter URL pública');
      return NextResponse.json(
        { error: 'Erro ao obter URL pública do áudio' },
        { status: 500 }
      );
    }

    console.log('✅ API upload-audio-to-storage: URL pública gerada:', publicUrlData.publicUrl);

    return NextResponse.json({
      success: true,
      audio_url: publicUrlData.publicUrl,
      file_path: filePath
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ API upload-audio-to-storage: Erro geral:', {
      message: errorMessage,
      stack: errorStack,
      error
    });
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
