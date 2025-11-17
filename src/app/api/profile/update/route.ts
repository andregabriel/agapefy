import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { full_name, whatsapp, avatar_url } = body;

    const admin = getAdminSupabase();

    // Atualizar perfil na tabela profiles
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: full_name || null,
        whatsapp: whatsapp || null,
        avatar_url: avatar_url || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Erro ao atualizar perfil:', profileError);
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil' },
        { status: 500 }
      );
    }

    // Atualizar metadata do usuário no auth (opcional)
    if (full_name || avatar_url) {
      const { error: authError } = await userClient.auth.updateUser({
        data: {
          ...(full_name && { full_name }),
          ...(avatar_url && { avatar_url }),
        }
      });

      if (authError) {
        console.warn('Erro ao atualizar metadata do auth:', authError);
        // Não falhar completamente se apenas o auth falhar
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
    });
  } catch (e) {
    console.error('Erro interno em /api/profile/update:', e);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

