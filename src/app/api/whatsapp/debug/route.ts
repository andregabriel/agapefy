import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const admin = getAdminSupabase();

    // Buscar últimas conversas
    const { data: conversations, error: convError } = await admin
      .from('whatsapp_conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (convError) throw convError;

    // Buscar usuários
    const { data: users, error: usersError } = await admin
      .from('whatsapp_users')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (usersError) throw usersError;

    // Verificar configuração OpenAI
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    const openaiKeyFormat = process.env.OPENAI_API_KEY?.startsWith('sk-') ? 'Válida' : 'Inválida';

    // Estatísticas
    const today = new Date().toDateString();
    const conversationsToday = conversations?.filter(c => 
      new Date(c.created_at).toDateString() === today
    ).length || 0;

    const lastConversation = conversations?.[0];
    const lastUser = users?.[0];

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      webhook_url: `${process.env.VERCEL_URL || 'localhost:3000'}/api/whatsapp/webhook`,
      openai: {
        configured: openaiConfigured,
        key_format: openaiKeyFormat,
        model: 'gpt-4o'
      },
      statistics: {
        total_conversations: conversations?.length || 0,
        conversations_today: conversationsToday,
        total_users: users?.length || 0,
        last_conversation_time: lastConversation?.created_at || 'Nenhuma',
        last_user_update: lastUser?.updated_at || 'Nenhum'
      },
      recent_conversations: conversations?.slice(0, 5).map(c => ({
        phone: c.user_phone,
        message: c.message_content,
        response: c.response_content,
        time: c.created_at,
        type: c.conversation_type
      })) || [],
      recent_users: users?.slice(0, 5).map(u => ({
        phone: u.phone_number,
        name: u.name,
        active: u.is_active,
        last_update: u.updated_at
      })) || []
    });

  } catch (error) {
    console.error('Erro no debug:', error);
    return NextResponse.json({
      error: 'Erro ao buscar dados de debug',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
