import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    console.log('🔧 API setup-audio-bucket: Criando bucket de áudios...');

    // Inicializar cliente Supabase com as credenciais do servidor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ API setup-audio-bucket: Credenciais do Supabase não configuradas');
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o bucket já existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ API setup-audio-bucket: Erro ao listar buckets:', listError);
      return NextResponse.json(
        { error: 'Erro ao listar buckets', details: listError.message },
        { status: 500 }
      );
    }

    const audiosBucketExists = buckets?.some(bucket => bucket.name === 'audios');

    if (audiosBucketExists) {
      console.log('✅ API setup-audio-bucket: Bucket "audios" já existe');
      return NextResponse.json({
        success: true,
        message: 'Bucket "audios" já existe',
        bucket: 'audios',
        already_exists: true
      });
    }

    // Criar o bucket
    console.log('🆕 API setup-audio-bucket: Criando bucket "audios"...');
    const { data: createData, error: createError } = await supabase.storage.createBucket('audios', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
    });

    if (createError) {
      console.error('❌ API setup-audio-bucket: Erro ao criar bucket:', createError);
      return NextResponse.json(
        { error: 'Erro ao criar bucket', details: createError.message },
        { status: 500 }
      );
    }

    console.log('✅ API setup-audio-bucket: Bucket "audios" criado com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Bucket "audios" criado com sucesso',
      bucket: 'audios',
      created: true,
      data: createData
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ API setup-audio-bucket: Erro geral:', errorMessage);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
