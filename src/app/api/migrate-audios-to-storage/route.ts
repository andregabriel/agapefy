import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 API migrate-audios: Iniciando migração de áudios base64 para Storage...');

    // Inicializar cliente Supabase com as credenciais do servidor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ API migrate-audios: Credenciais do Supabase não configuradas');
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar áudios com audio_url em base64
    console.log('🔍 API migrate-audios: Buscando áudios com base64...');
    const { data: audios, error: fetchError } = await supabase
      .from('audios')
      .select('id, title, audio_url')
      .like('audio_url', 'data:audio%');

    if (fetchError) {
      console.error('❌ API migrate-audios: Erro ao buscar áudios:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar áudios', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!audios || audios.length === 0) {
      console.log('✅ API migrate-audios: Nenhum áudio com base64 encontrado');
      return NextResponse.json({
        success: true,
        message: 'Nenhum áudio com base64 encontrado para migrar',
        migrated: []
      });
    }

    console.log(`📊 API migrate-audios: Encontrados ${audios.length} áudios para migrar`);

    const results = [];

    // Migrar cada áudio
    for (const audio of audios) {
      try {
        console.log(`🔄 Migrando áudio: ${audio.title} (${audio.id})`);

        // Extrair base64
        const base64Data = audio.audio_url.replace(/^data:audio\/[a-z]+;base64,/, '');
        
        // Converter para buffer
        const audioBuffer = Buffer.from(base64Data, 'base64');
        
        // Gerar nome do arquivo
        const timestamp = Date.now();
        const sanitizedTitle = audio.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .substring(0, 50);
        const fileName = `migrated-${sanitizedTitle}-${timestamp}.mp3`;
        const filePath = `migrated/${fileName}`;

        console.log(`⬆️ Upload para: ${filePath}`);

        // Upload para o Storage
        const { error: uploadError } = await supabase.storage
          .from('audios')
          .upload(filePath, audioBuffer, {
            contentType: 'audio/mpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error(`❌ Erro no upload de ${audio.title}:`, uploadError);
          results.push({
            id: audio.id,
            title: audio.title,
            success: false,
            error: uploadError.message
          });
          continue;
        }

        // Obter URL pública
        const { data: publicUrlData } = supabase.storage
          .from('audios')
          .getPublicUrl(filePath);

        if (!publicUrlData?.publicUrl) {
          console.error(`❌ Erro ao obter URL pública de ${audio.title}`);
          results.push({
            id: audio.id,
            title: audio.title,
            success: false,
            error: 'Erro ao obter URL pública'
          });
          continue;
        }

        // Atualizar registro no banco com nova URL
        const { error: updateError } = await supabase
          .from('audios')
          .update({ audio_url: publicUrlData.publicUrl })
          .eq('id', audio.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar ${audio.title}:`, updateError);
          results.push({
            id: audio.id,
            title: audio.title,
            success: false,
            error: updateError.message
          });
          continue;
        }

        console.log(`✅ Áudio migrado com sucesso: ${audio.title}`);
        console.log(`   Nova URL: ${publicUrlData.publicUrl}`);

        results.push({
          id: audio.id,
          title: audio.title,
          success: true,
          old_url_preview: audio.audio_url.substring(0, 50) + '...',
          new_url: publicUrlData.publicUrl
        });

      } catch (audioError) {
        console.error(`❌ Erro ao processar ${audio.title}:`, audioError);
        results.push({
          id: audio.id,
          title: audio.title,
          success: false,
          error: audioError instanceof Error ? audioError.message : 'Erro desconhecido'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`✅ API migrate-audios: Migração concluída - ${successCount} sucessos, ${failCount} falhas`);

    return NextResponse.json({
      success: true,
      total: audios.length,
      succeeded: successCount,
      failed: failCount,
      results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ API migrate-audios: Erro geral:', {
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

