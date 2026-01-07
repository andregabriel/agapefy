import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireAdmin, requireUser } from '@/lib/api-auth';

const ZAPI_INSTANCE_NAME = process.env.ZAPI_INSTANCE_NAME as string;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN as string;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN as string;
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message } = body;

    const adminAuth = await requireAdmin(request);
    if (!adminAuth.ok) {
      const userAuth = await requireUser(request);
      if (!userAuth.ok) return userAuth.response;
      const phoneRaw = phone || '';
      const cleanPhone = String(phoneRaw).replace(/\D/g, '');
      if (!cleanPhone) {
        return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 });
      }

      const admin = getAdminSupabase();
      const [{ data: waRow }, { data: profile }] = await Promise.all([
        admin
          .from('whatsapp_users')
          .select('user_id')
          .eq('phone_number', cleanPhone)
          .maybeSingle(),
        admin.from('profiles').select('whatsapp').eq('id', userAuth.userId).maybeSingle(),
      ]);

      const profilePhone = typeof profile?.whatsapp === 'string'
        ? profile.whatsapp.replace(/\D/g, '')
        : '';
      const ownerMatch = waRow?.user_id === userAuth.userId || (profilePhone && profilePhone === cleanPhone);
      if (!ownerMatch) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    if (!ZAPI_INSTANCE_NAME || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      return NextResponse.json({ error: 'Z-API credentials not configured' }, { status: 500 });
    }

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'Telefone e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    // Limpar número do telefone
    const cleanPhone = phone.replace(/\D/g, '');
    const maskedPhone = cleanPhone.replace(/\d(?=\d{4})/g, 'x');
    const messagePreview =
      message && message.length > 0
        ? `${message.substring(0, 50)}${message.length > 50 ? '...' : ''} [len=${message.length}]`
        : '';

    console.log(`Enviando mensagem de teste para ${maskedPhone}: "${messagePreview}"`);

    // Enviar mensagem via Z-API
    const response = await fetch(`${ZAPI_BASE_URL}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    });

    const responseData = await response.json();

    if (response.ok) {
      console.log('✅ Mensagem enviada com sucesso:', responseData);
      
      return NextResponse.json({
        success: true,
        message: 'Mensagem enviada com sucesso!',
        data: responseData,
        phone: cleanPhone,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ Erro ao enviar mensagem:', responseData);
      
      return NextResponse.json(
        { 
          error: responseData.message || 'Erro ao enviar mensagem via Z-API',
          details: responseData,
          phone: cleanPhone
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Erro no teste de mensagem:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
