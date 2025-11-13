import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

// Token de API do Digital Manager Guru (configurado no .env)
const DMG_API_TOKEN = process.env.DMG_API_TOKEN || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Webhook de assinatura recebido:', JSON.stringify(body, null, 2));

    // Validar token de API (aceita no header Authorization OU no corpo do JSON)
    if (DMG_API_TOKEN) {
      const authHeader = request.headers.get('Authorization');
      const headerToken = authHeader?.replace('Bearer ', '');
      const bodyToken = body.api_token;
      
      // Aceita token no header OU no corpo do JSON
      const isValid = headerToken === DMG_API_TOKEN || bodyToken === DMG_API_TOKEN;
      
      if (!isValid) {
        console.error('❌ Token de API inválido ou ausente');
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Token de API inválido ou ausente' },
          { status: 401 }
        );
      }
      
      console.log('✅ Token validado com sucesso');
    }

    // Validar se é um webhook de assinatura
    if (body.webhook_type !== 'subscription') {
      console.log('⚠️ Webhook ignorado - tipo não é subscription');
      return NextResponse.json({ 
        status: 'ignored', 
        reason: 'webhook_type_not_subscription' 
      });
    }

    // Extrair dados do webhook
    const subscriptionData = extractSubscriptionData(body);
    
    // Salvar/atualizar no Supabase
    const supabase = getAdminSupabase();
    
    // Verificar se já existe uma assinatura com esse subscription_id
    const { data: existingSubscription } = await supabase
      .from('assinaturas')
      .select('id')
      .eq('subscription_id', subscriptionData.subscription_id)
      .maybeSingle();

    if (existingSubscription) {
      // Atualizar assinatura existente
      console.log('🔄 Atualizando assinatura existente:', subscriptionData.subscription_id);
      const { error } = await supabase
        .from('assinaturas')
        .update(subscriptionData)
        .eq('subscription_id', subscriptionData.subscription_id);

      if (error) {
        console.error('❌ Erro ao atualizar assinatura:', error);
        throw error;
      }

      console.log('✅ Assinatura atualizada com sucesso');
    } else {
      // Criar nova assinatura
      console.log('➕ Criando nova assinatura:', subscriptionData.subscription_id);
      const { error } = await supabase
        .from('assinaturas')
        .insert(subscriptionData);

      if (error) {
        console.error('❌ Erro ao criar assinatura:', error);
        throw error;
      }

      console.log('✅ Assinatura criada com sucesso');
    }

    return NextResponse.json({
      status: 'success',
      message: 'Webhook processado com sucesso',
      subscription_id: subscriptionData.subscription_id,
      subscriber_email: subscriptionData.subscriber_email,
      status_assinatura: subscriptionData.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Erro ao processar webhook de assinatura:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Extrai e formata os dados mais importantes do webhook para a tabela assinaturas
 */
function extractSubscriptionData(body: any) {
  return {
    // IDs do sistema de pagamento
    subscription_id: body.id || '',
    subscription_internal_id: body.internal_id || null,
    subscription_code: body.subscription_code || null,

    // Status da assinatura
    status: body.last_status || 'unknown',

    // Informações do assinante
    subscriber_id: body.subscriber?.id || '',
    subscriber_name: body.subscriber?.name || null,
    subscriber_email: body.subscriber?.email || null,
    subscriber_doc: body.subscriber?.doc || null,
    subscriber_phone: body.subscriber?.phone_number || null,
    subscriber_phone_local_code: body.subscriber?.phone_local_code || null,

    // Informações do produto/plano
    product_id: body.product?.id || null,
    product_internal_id: body.product?.internal_id || null,
    product_name: body.product?.name || body.name || null,
    product_offer_id: body.product?.offer?.id || null,
    product_offer_name: body.product?.offer?.name || null,

    // Informações de pagamento
    payment_method: body.payment_method || null,
    currency: body.current_invoice?.currency || body.last_transaction?.payment?.currency || 'BRL',
    next_cycle_value: body.next_cycle_value || null,
    charged_every_days: body.charged_every_days || null,

    // Informações de fatura atual
    current_invoice_id: body.current_invoice?.id || null,
    current_invoice_status: body.current_invoice?.status || null,
    current_invoice_value: body.current_invoice?.value || null,
    current_invoice_cycle: body.current_invoice?.cycle || null,
    current_invoice_charge_at: body.current_invoice?.charge_at || null,
    current_invoice_period_start: body.current_invoice?.period_start || null,
    current_invoice_period_end: body.current_invoice?.period_end || null,

    // Datas importantes
    started_at: body.dates?.started_at || null,
    cycle_start_date: body.dates?.cycle_start_date || null,
    cycle_end_date: body.dates?.cycle_end_date || null,
    next_cycle_at: body.dates?.next_cycle_at || null,
    canceled_at: body.dates?.canceled_at || null,
    last_status_at: body.dates?.last_status_at || null,

    // Trial
    trial_days: body.trial_days || 0,
    trial_started_at: body.trial_started_at || null,
    trial_finished_at: body.trial_finished_at || null,

    // Cancelamento
    cancel_at_cycle_end: body.cancel_at_cycle_end === 1 || body.cancel_at_cycle_end === true,
    cancel_reason: body.cancel_reason || null,
    cancelled_by_email: body.cancelled_by?.email || null,
    cancelled_by_name: body.cancelled_by?.name || null,
    cancelled_by_date: body.cancelled_by?.date || null,

    // Provider
    provider: body.provider || null,

    // Cartão de crédito (informações básicas)
    credit_card_id: body.credit_card?.id || body.last_transaction?.payment?.credit_card?.id || null,
    credit_card_brand: body.credit_card?.brand || body.last_transaction?.payment?.credit_card?.brand || null,
    credit_card_last_four: body.credit_card?.last_four || body.last_transaction?.payment?.credit_card?.last_digits || null,
    credit_card_expiration_month: body.credit_card?.expiration_month || body.last_transaction?.payment?.credit_card?.expiration_month || null,
    credit_card_expiration_year: body.credit_card?.expiration_year || body.last_transaction?.payment?.credit_card?.expiration_year || null,

    // Webhook metadata
    webhook_type: body.webhook_type || 'subscription',
    api_token: body.api_token || null,

    // JSON completo do webhook
    raw_webhook_data: body
  };
}

// Método GET para testar se o endpoint está funcionando
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Endpoint de webhook de assinatura está funcionando',
    endpoint: '/api/webhook/subscription',
    method: 'POST',
    description: 'Recebe webhooks do Digital Manager Guru para gerenciar assinaturas',
    timestamp: new Date().toISOString()
  });
}

