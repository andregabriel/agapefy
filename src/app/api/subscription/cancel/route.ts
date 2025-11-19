import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = cookies();
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const admin = getAdminSupabase();

    // Buscar assinatura ativa do usuário
    const { data: subscriptions, error: fetchError } = await admin
      .from('assinaturas')
      .select('id, status, cancel_at_cycle_end')
      .eq('subscriber_email', user.email)
      .in('status', ['active', 'paid', 'authorized', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Erro ao buscar assinatura:', fetchError);
      return NextResponse.json(
        { error: 'Erro ao buscar assinatura' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma assinatura ativa encontrada' },
        { status: 404 }
      );
    }

    const subscription = subscriptions[0];

    // Se já está marcada para cancelar, retornar sucesso
    if (subscription.cancel_at_cycle_end) {
      return NextResponse.json({
        success: true,
        message: 'Assinatura já está marcada para cancelamento',
      });
    }

    // Marcar para cancelar no fim do ciclo
    const { error: updateError } = await admin
      .from('assinaturas')
      .update({ cancel_at_cycle_end: true })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Erro ao cancelar assinatura:', updateError);
      return NextResponse.json(
        { error: 'Erro ao cancelar assinatura' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
    });
  } catch (e) {
    console.error('Erro interno em /api/subscription/cancel:', e);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}



