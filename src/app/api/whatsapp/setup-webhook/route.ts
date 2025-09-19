import { NextRequest, NextResponse } from 'next/server';

const ZAPI_TOKEN = "9F677316F38A3D2FA08EEB09";
const ZAPI_CLIENT_TOKEN = "F3adb78efb3ba40888e8c090e6b90aea4S";
const ZAPI_INSTANCE_NAME = "3E60EE9AC55FD0C647E46EB3E4757B57";
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`;

export async function POST(request: NextRequest) {
  try {
    const { webhookUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'URL do webhook é obrigatória' },
        { status: 400 }
      );
    }

    // Configurar webhook no Z-API
    const response = await fetch(`${ZAPI_BASE_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN
      },
      body: JSON.stringify({
        url: webhookUrl,
        enabled: true,
        webhookByEvents: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro ao configurar webhook Z-API:', error);
      return NextResponse.json(
        { error: 'Erro ao configurar webhook' },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log('Webhook configurado com sucesso:', data);

    return NextResponse.json({
      message: 'Webhook configurado com sucesso',
      data: data
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na configuração do webhook:', errorMessage);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Verificar status do webhook
    const response = await fetch(`${ZAPI_BASE_URL}/webhook`, {
      method: 'GET',
      headers: {
        'Client-Token': ZAPI_CLIENT_TOKEN
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro ao verificar webhook Z-API:', error);
      return NextResponse.json(
        { error: 'Erro ao verificar webhook' },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      message: 'Status do webhook obtido com sucesso',
      data: data
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao verificar webhook:', errorMessage);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}