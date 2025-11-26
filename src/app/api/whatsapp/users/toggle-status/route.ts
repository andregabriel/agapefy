import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { phone_number, is_active } = await request.json();

    if (!phone_number || typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'phone_number e is_active são obrigatórios' },
        { status: 400 }
      );
    }

    // Limpar número do telefone
    const cleanPhone = phone_number.replace(/\D/g, '');
    const maskedPhone = cleanPhone.replace(/\d(?=\d{4})/g, 'x');

    console.log(`Atualizando status do usuário ${maskedPhone} para ${is_active ? 'ativo' : 'inativo'}`);

    // Atualizar status do usuário
    const { data, error } = await supabase
      .from('whatsapp_users')
      .update({ 
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('phone_number', cleanPhone)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar status:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar status do usuário', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Usuário ${is_active ? 'ativado' : 'desativado'} com sucesso`,
      data: {
        phone_number: cleanPhone,
        is_active,
        updated_at: data.updated_at
      }
    });

  } catch (error) {
    console.error('Erro no toggle de status:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

