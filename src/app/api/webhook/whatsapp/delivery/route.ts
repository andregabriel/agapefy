import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📬 Webhook DELIVERY recebido:', JSON.stringify(body, null, 2));

    // Log do status de entrega
    if (body.status) {
      console.log(`📋 Status de entrega: ${body.status} para ${body.phone}`);
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