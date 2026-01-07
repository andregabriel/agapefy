import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { user_id, phone_number } = await request.json();

    if (!user_id || !phone_number) {
      return NextResponse.json(
        { error: 'user_id e phone_number são obrigatórios' },
        { status: 400 }
      );
    }

    // Limpar número do telefone
    const cleanPhone = phone_number.replace(/\D/g, '');

    // Validar formato básico do telefone (deve ter pelo menos 10 dígitos)
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Número de telefone inválido. Deve ter pelo menos 10 dígitos.' },
        { status: 400 }
      );
    }

    const maskedPhone = cleanPhone.replace(/\d(?=\d{4})/g, 'x');
    console.log(`Atualizando número do usuário ${user_id} para ${maskedPhone}`);

    // Verificar se o número já está em uso por outro usuário
    const { data: existingUser } = await supabase
      .from('whatsapp_users')
      .select('id')
      .eq('phone_number', cleanPhone)
      .neq('id', user_id)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este número de telefone já está em uso por outro usuário' },
        { status: 400 }
      );
    }

    // Atualizar número do telefone
    const { data, error } = await supabase
      .from('whatsapp_users')
      .update({ 
        phone_number: cleanPhone,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar número:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar número de telefone', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Número de telefone atualizado com sucesso',
      data: {
        id: data.id,
        phone_number: cleanPhone,
        updated_at: data.updated_at
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar número:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
