import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    console.log('📤 API upload-category-image: Iniciando processamento...');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ API upload-category-image: Arquivo não fornecido');
      return NextResponse.json(
        { error: 'Arquivo de imagem é obrigatório' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      console.error('❌ API upload-category-image: Tipo de arquivo inválido:', file.type);
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Use JPEG, PNG ou WebP' },
        { status: 400 }
      );
    }

    // Validar tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('❌ API upload-category-image: Arquivo muito grande:', file.size);
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 5MB permitido' },
        { status: 400 }
      );
    }

    // Inicializar cliente Supabase com as credenciais do servidor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ API upload-category-image: Credenciais do Supabase não configuradas');
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 API upload-category-image: Preparando upload...');

    // Determinar extensão do arquivo
    let ext = 'png';
    if (file.type.includes('jpeg') || file.type.includes('jpg')) ext = 'jpg';
    if (file.type.includes('webp')) ext = 'webp';
    
    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileName = `categories/${timestamp}-${randomStr}.${ext}`;

    console.log('⬆️ API upload-category-image: Fazendo upload para Supabase Storage...');
    console.log('📁 Arquivo:', fileName);
    console.log('📊 Tamanho:', file.size, 'bytes');
    console.log('🎨 Tipo:', file.type);

    // Converter File para ArrayBuffer e depois para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload para o Supabase Storage no bucket 'media'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ API upload-category-image: Erro no upload:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao fazer upload da imagem', details: uploadError.message },
        { status: 500 }
      );
    }

    console.log('✅ API upload-category-image: Upload concluído');

    // Obter URL pública do arquivo
    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      console.error('❌ API upload-category-image: Não foi possível obter URL pública');
      return NextResponse.json(
        { error: 'Erro ao obter URL pública da imagem' },
        { status: 500 }
      );
    }

    console.log('✅ API upload-category-image: URL pública gerada:', publicUrlData.publicUrl);

    return NextResponse.json({
      success: true,
      image_url: publicUrlData.publicUrl,
      file_path: fileName
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ API upload-category-image: Erro geral:', {
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
