import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const safeBody = {
      ...body,
      phone: body?.phone ? String(body.phone).replace(/\d(?=\d{4})/g, 'x') : body?.phone,
    };
    console.log('📊 Webhook STATUS recebido:', JSON.stringify(safeBody, null, 2));

    // Log do status da mensagem (enviada, entregue, lida, etc.)
    if (body.status) {
      const maskedPhone = body?.phone ? String(body.phone).replace(/\d(?=\d{4})/g, 'x') : '';
      console.log(`📱 Status da mensagem: ${body.status} - ${maskedPhone}`);
    }

    return NextResponse.json({ 
      status: 'success',
      message: 'Status da mensagem recebido',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro no webhook status:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}