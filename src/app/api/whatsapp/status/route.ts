import { NextResponse } from 'next/server';

const ZAPI_TOKEN = "9F677316F38A3D2FA08EEB09";
const ZAPI_CLIENT_TOKEN = "F3adb78efb3ba40888e8c090e6b90aea4S";
const ZAPI_INSTANCE_NAME = "3E60EE9AC55FD0C647E46EB3E4757B57";
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function GET() {
  try {
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