import { NextRequest, NextResponse } from 'next/server';
import { requireWebhookSecret } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const webhookAuth = requireWebhookSecret(request, 'WHATSAPP_WEBHOOK_SECRET');
    if (webhookAuth) return webhookAuth;

    const body = await request.json();
    const safeBody = {
      ...body,
      phone: body?.phone ? String(body.phone).replace(/\d(?=\d{4})/g, 'x') : body?.phone,
    };
    console.log('📬 Webhook DELIVERY recebido:', JSON.stringify(safeBody, null, 2));

    // Log do status de entrega
    if (body.status) {
      const maskedPhone = body?.phone ? String(body.phone).replace(/\d(?=\d{4})/g, 'x') : '';
      console.log(`📋 Status de entrega: ${body.status} para ${maskedPhone}`);
    }

    return NextResponse.json({ 
      status: 'success',
      message: 'Status de entrega recebido',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro no webhook delivery:', error);
    return NextResponse.json({ 
      error: 'Erro interno',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
