import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔗 Webhook CONNECT recebido:', JSON.stringify(body, null, 2));

    console.log('✅ WhatsApp conectado com sucesso!');

    return NextResponse.json({ 
      status: 'success',
      message: 'Conexão estabelecida',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro no webhook connect:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}