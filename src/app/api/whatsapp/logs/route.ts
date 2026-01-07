import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // Buscar últimas conversas para debug
    const { data: conversations, error } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Buscar usuários registrados
    const { data: users } = await supabase
      .from('whatsapp_users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      recent_conversations: conversations || [],
      recent_users: users || [],
      total_conversations: conversations?.length || 0,
      total_users: users?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar logs' },
      { status: 500 }
    );
  }
}
