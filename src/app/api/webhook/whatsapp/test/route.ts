import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { type, phone, message } = await request.json();

    console.log(`🧪 Testando webhook: ${type}`);

    // Simular diferentes tipos de webhook
    const testData = {
      receive: {
        phone: phone || '5511999999999',
        message: { conversation: message || 'Olá, teste do sistema!' },
        senderName: 'Teste Sistema',
        fromMe: false,
        timestamp: Date.now()
      },
      delivery: {
        phone: phone || '5511999999999',
        status: 'delivered',
        timestamp: Date.now()
      },
      status: {
        phone: phone || '5511999999999',
        status: 'read',
        timestamp: Date.now()
      },
      connect: {
        status: 'connected',
        timestamp: Date.now()
      },
      disconnect: {
        status: 'disconnected',
        timestamp: Date.now()
      }
    };

    const webhookData = testData[type as keyof typeof testData];
    
    if (!webhookData) {
      return NextResponse.json({
        error: 'Tipo de webhook inválido',
        valid_types: Object.keys(testData)
      }, { status: 400 });
    }

    // Fazer requisição para o webhook correspondente
    const webhookUrl = `${request.nextUrl.origin}/api/webhook/whatsapp/${type}`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      webhook_type: type,
      webhook_url: webhookUrl,
      test_data: webhookData,
      webhook_response: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro no teste de webhook:', error);
    return NextResponse.json({
      error: 'Erro ao testar webhook',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API de teste de webhooks WhatsApp',
    available_tests: [
      'receive - Testar recebimento de mensagem',
      'delivery - Testar status de entrega',
      'status - Testar status da mensagem',
      'connect - Testar conexão',
      'disconnect - Testar desconexão'
    ],
    usage: 'POST /api/webhook/whatsapp/test com { "type": "receive", "phone": "5511999999999", "message": "teste" }',
    webhook_urls: {
      receive: '/api/webhook/whatsapp/receive',
      delivery: '/api/webhook/whatsapp/delivery',
      status: '/api/webhook/whatsapp/status',
      connect: '/api/webhook/whatsapp/connect',
      disconnect: '/api/webhook/whatsapp/disconnect'
    }
  });
}