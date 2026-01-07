import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

const ZAPI_INSTANCE_NAME = process.env.ZAPI_INSTANCE_NAME as string;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN as string;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN as string;
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    if (!ZAPI_INSTANCE_NAME || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      return NextResponse.json({ error: 'Z-API credentials not configured' }, { status: 500 });
    }

    // Verificar status da instância
    const statusResponse = await fetch(`${ZAPI_BASE_URL}/status`, {
      headers: {
        'Client-Token': ZAPI_CLIENT_TOKEN
      }
    });

    const statusData = await statusResponse.json();

    // Verificar webhook configurado
    const webhookResponse = await fetch(`${ZAPI_BASE_URL}/webhook`, {
      headers: {
        'Client-Token': ZAPI_CLIENT_TOKEN
      }
    });

    const webhookData = await webhookResponse.json();

    return NextResponse.json({
      instance_status: statusData,
      webhook_config: webhookData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao verificar status Z-API:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}
