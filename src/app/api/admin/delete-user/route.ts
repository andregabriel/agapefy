import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api-auth';

// Usar o mesmo padrão das categorias - cliente normal do Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vvgqqlrujmyxzzygsizc.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2Z3FxbHJ1am15eHp6eWdzaXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDk1MDYsImV4cCI6MjA3MDU4NTUwNn0.RDBnrokuwaXoQri56NpCUU1HU_VYb6gXxm_AcWniwfo";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Usar cliente normal (mesmo padrão das categorias)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Buscar o usuário pelo email usando a API Admin (precisa de admin para listar usuários)
    const adminSupabase = getAdminSupabase();
    const { data: users, error: listError } = await adminSupabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Erro ao listar usuários: ${listError.message}`);
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      return NextResponse.json(
        { error: `Usuário com email ${email} não encontrado` },
        { status: 404 }
      );
    }
    
    console.log(`✅ Usuário encontrado: ${user.id} (${user.email})`);
    
    const userId = user.id;
    
    // Seguir o mesmo padrão das categorias: deletar dados relacionados primeiro
    console.log('\n🗑️  Deletando dados relacionados...');
    
    // 1. Deletar sugestões do usuário
    console.log('🗑️ Deletando sugestões...');
    const { error: suggestionsError } = await supabase
      .from('user_suggestions')
      .delete()
      .eq('user_id', userId);
    
    if (suggestionsError) {
      console.error('❌ Erro ao deletar sugestões:', suggestionsError);
      throw new Error(`Erro ao deletar sugestões: ${suggestionsError.message}`);
    }
    console.log('✅ Sugestões deletadas');
    
    // 2. Deletar respostas de formulários
    console.log('🗑️ Deletando respostas de formulários...');
    const { error: formResponsesError } = await supabase
      .from('admin_form_responses')
      .delete()
      .eq('user_id', userId);
    
    if (formResponsesError) {
      console.error('❌ Erro ao deletar respostas de formulários:', formResponsesError);
      throw new Error(`Erro ao deletar respostas de formulários: ${formResponsesError.message}`);
    }
    console.log('✅ Respostas de formulários deletadas');
    
    // 3. Limpar user_id de whatsapp_users (SET NULL)
    console.log('🔄 Atualizando whatsapp_users...');
    const { error: whatsappError } = await supabase
      .from('whatsapp_users')
      .update({ user_id: null })
      .eq('user_id', userId);
    
    if (whatsappError) {
      console.error('❌ Erro ao atualizar whatsapp_users:', whatsappError);
      throw new Error(`Erro ao atualizar whatsapp_users: ${whatsappError.message}`);
    }
    console.log('✅ WhatsApp users atualizados');
    
    // 4. Limpar created_by de playlists (SET NULL)
    console.log('🔄 Atualizando playlists...');
    const { error: playlistsError } = await supabase
      .from('playlists')
      .update({ created_by: null })
      .eq('created_by', userId);
    
    if (playlistsError) {
      console.error('❌ Erro ao atualizar playlists:', playlistsError);
      throw new Error(`Erro ao atualizar playlists: ${playlistsError.message}`);
    }
    console.log('✅ Playlists atualizadas');
    
    // 5. Limpar created_by de challenge (SET NULL)
    console.log('🔄 Atualizando challenge...');
    const { error: challengeError } = await supabase
      .from('challenge')
      .update({ created_by: null })
      .eq('created_by', userId);
    
    if (challengeError) {
      // Se a tabela não existir, apenas avisar mas continuar
      if (challengeError.message?.includes('schema cache') || challengeError.message?.includes('not found')) {
        console.warn('⚠️ Tabela challenge não encontrada ou sem acesso, pulando...');
      } else {
        console.error('❌ Erro ao atualizar challenge:', challengeError);
        throw new Error(`Erro ao atualizar challenge: ${challengeError.message}`);
      }
    } else {
      console.log('✅ Challenge atualizado');
    }
    
    // 6. Limpar created_by de admin_forms (SET NULL)
    console.log('🔄 Atualizando admin_forms...');
    const { error: adminFormsError } = await supabase
      .from('admin_forms')
      .update({ created_by: null })
      .eq('created_by', userId);
    
    if (adminFormsError) {
      console.error('❌ Erro ao atualizar admin_forms:', adminFormsError);
      throw new Error(`Erro ao atualizar admin_forms: ${adminFormsError.message}`);
    }
    console.log('✅ Admin forms atualizados');
    
    // 7. Deletar bible_preferences (se existir)
    console.log('🗑️ Deletando bible_preferences...');
    const { error: biblePrefsError } = await supabase
      .from('bible_preferences')
      .delete()
      .eq('user_id', userId);
    
    if (biblePrefsError) {
      // Se a tabela não existir ou não tiver acesso, apenas avisar mas continuar
      if (biblePrefsError.message?.includes('schema cache') || biblePrefsError.message?.includes('not found')) {
        console.warn('⚠️ Tabela bible_preferences não encontrada ou sem acesso, pulando...');
      } else {
        console.error('❌ Erro ao deletar bible_preferences:', biblePrefsError);
        throw new Error(`Erro ao deletar bible_preferences: ${biblePrefsError.message}`);
      }
    } else {
      console.log('✅ Bible preferences deletadas');
    }
    
    // 8. Deletar perfil (mesmo padrão das categorias)
    console.log('🗑️ Deletando perfil...');
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) {
      console.error('❌ Erro ao deletar perfil:', profileError);
      
      // Tratamento específico de erros (mesmo padrão das categorias)
      let errorMessage = 'Erro ao deletar perfil';
      
      if (profileError.code === '42501') {
        errorMessage = 'Você não tem permissão para deletar este usuário. Faça login como administrador.';
      } else if (profileError.code === '23503') {
        errorMessage = 'Este usuário ainda possui itens vinculados.';
      } else if (profileError.message) {
        errorMessage = `Erro: ${profileError.message}`;
      }
      
      throw new Error(errorMessage);
    }
    console.log('✅ Perfil deletado');
    
    // 9. Tentar deletar usando função SQL se existir
    console.log('\n🗑️ Tentando deletar via função SQL...');
    const { data: sqlResult, error: sqlError } = await supabase.rpc('delete_user_by_email', {
      user_email: email
    });
    
    if (!sqlError && sqlResult) {
      console.log(`✅ ${sqlResult}`);
      return NextResponse.json({
        success: true,
        message: sqlResult,
        userId
      });
    }
    
    // 10. Se a função não existir, tentar deletar via API Admin
    console.log('🗑️ Deletando usuário de auth.users via API Admin...');
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('❌ Erro ao deletar usuário de auth.users:', deleteError);
      
      // Se falhar, instruir a executar SQL manualmente
      return NextResponse.json({
        error: `Não foi possível deletar de auth.users automaticamente.`,
        message: `Dados relacionados foram deletados com sucesso. Para completar a deleção, execute o SQL em scripts/delete-user.sql no Supabase SQL Editor.`,
        userId,
        email,
        sqlError: sqlError?.message,
        deleteError: deleteError.message
      }, { status: 500 });
    }
    
    console.log(`\n✅ Usuário ${email} deletado com sucesso!`);
    
    return NextResponse.json({
      success: true,
      message: `Usuário ${email} deletado com sucesso`,
      userId
    });
    
  } catch (error: any) {
    console.error('❌ Erro ao deletar usuário:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar usuário' },
      { status: 500 }
    );
  }
}
