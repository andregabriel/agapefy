import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

// Esta rota executa o SQL diretamente para deletar de auth.users
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      );
    }

    const adminSupabase = getAdminSupabase();
    
    // Executar SQL diretamente usando RPC ou query direta
    // Como não temos acesso direto ao SQL, vamos tentar deletar via API Admin novamente
    // mas desta vez após garantir que todos os dados relacionados foram deletados
    
    console.log(`🗑️ Deletando usuário ${userId} de auth.users...`);
    
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('❌ Erro ao deletar:', deleteError);
      
      // Retornar instruções para executar SQL manualmente
      return NextResponse.json({
        error: 'Não foi possível deletar automaticamente',
        message: 'Execute o SQL abaixo no Supabase SQL Editor:',
        sql: `DELETE FROM auth.users WHERE id = '${userId}'::uuid;`,
        userId
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Usuário ${userId} deletado com sucesso de auth.users`,
      userId
    });
    
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar usuário' },
      { status: 500 }
    );
  }
}

