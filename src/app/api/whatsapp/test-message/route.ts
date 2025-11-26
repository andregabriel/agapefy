import { NextRequest, NextResponse } from 'next/server';

const ZAPI_INSTANCE_NAME = process.env.ZAPI_INSTANCE_NAME as string;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN as string;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN as string;
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

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