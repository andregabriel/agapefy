import { NextRequest, NextResponse } from 'next/server';
import { requireWebhookSecret } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const webhookAuth = requireWebhookSecret(request, 'WHATSAPP_WEBHOOK_SECRET');
    if (webhookAuth) return webhookAuth;

    const body = await request.json();
    console.log('🔌 Webhook DISCONNECT recebido:', JSON.stringify(body, null, 2));

    console.log('❌ WhatsApp desconectado!');

    return NextResponse.json({ 
      status: 'success',
      message: 'Desconexão registrada',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro no webhook disconnect:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
