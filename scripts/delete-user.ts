import 'dotenv/config';
import { getAdminSupabase } from '../src/lib/supabase-admin';

const USER_EMAIL = 'andre@agapepray.com';

async function deleteUser() {
  try {
    const adminSupabase = getAdminSupabase();
    
    console.log(`🔍 Buscando usuário com email: ${USER_EMAIL}`);
    
    // Buscar o usuário pelo email usando a API Admin
    const { data: users, error: listError } = await adminSupabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Erro ao listar usuários: ${listError.message}`);
    }
    
    const user = users.users.find(u => u.email === USER_EMAIL);
    
    if (!user) {
      console.log(`❌ Usuário com email ${USER_EMAIL} não encontrado`);
      return;
    }
    
    console.log(`✅ Usuário encontrado: ${user.id} (${user.email})`);
    console.log(`📅 Criado em: ${user.created_at}`);
    
    const userId = user.id;
    
    // Deletar dados relacionados manualmente antes de deletar o usuário
    console.log('\n🗑️  Deletando dados relacionados...');
    
    // 1. Deletar sugestões do usuário
    const { error: suggestionsError } = await adminSupabase
      .from('user_suggestions')
      .delete()
      .eq('user_id', userId);
    
    if (suggestionsError) {
      console.warn(`⚠️  Erro ao deletar sugestões: ${suggestionsError.message}`);
    } else {
      console.log('✅ Sugestões deletadas');
    }
    
    // 2. Deletar respostas de formulários
    const { error: formResponsesError } = await adminSupabase
      .from('admin_form_responses')
      .delete()
      .eq('user_id', userId);
    
    if (formResponsesError) {
      console.warn(`⚠️  Erro ao deletar respostas de formulários: ${formResponsesError.message}`);
    } else {
      console.log('✅ Respostas de formulários deletadas');
    }
    
    // 3. Limpar user_id de whatsapp_users (SET NULL)
    const { error: whatsappError } = await adminSupabase
      .from('whatsapp_users')
      .update({ user_id: null })
      .eq('user_id', userId);
    
    if (whatsappError) {
      console.warn(`⚠️  Erro ao atualizar whatsapp_users: ${whatsappError.message}`);
    } else {
      console.log('✅ WhatsApp users atualizados');
    }
    
    // 4. Deletar perfil
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) {
      console.warn(`⚠️  Erro ao deletar perfil: ${profileError.message}`);
    } else {
      console.log('✅ Perfil deletado');
    }
    
    // bible_preferences será deletado automaticamente pelo CASCADE quando deletarmos auth.users
    
    // 5. Deletar o usuário de auth.users usando a API Admin
    console.log('\n🗑️  Deletando usuário de auth.users...');
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      throw new Error(`Erro ao deletar usuário: ${deleteError.message}`);
    }
    
    console.log(`\n✅ Usuário ${USER_EMAIL} deletado com sucesso!`);
    
  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error);
    process.exit(1);
  }
}

deleteUser();

