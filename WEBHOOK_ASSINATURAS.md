# Webhook de Assinaturas - Digital Manager Guru

Este documento descreve como configurar e usar o webhook de assinaturas do Digital Manager Guru.

## 📋 Visão Geral

O webhook recebe notificações do Digital Manager Guru sobre mudanças em assinaturas e armazena essas informações em uma tabela no Supabase para gestão completa de assinaturas SaaS.

## 🔧 Configuração

### 1. Configurar Variáveis de Ambiente

Adicione a variável no arquivo `.env.local`:

```bash
DMG_API_TOKEN=seu-token-aqui
```

> **Nota:** O token deve ser no formato: `{uuid}|{hash}`
> Exemplo: `a05987d5-8231-4dff-9e86-8ba830cce51c|z3HTsyksaKtdDAZcoaTbJcymHZUMCilmFXhcuHHK5aa92b70`

### 2. Criar a Tabela no Supabase

Execute o SQL no Supabase Dashboard:

1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo do arquivo `supabase/sql/create_assinaturas_table.sql`
4. Execute o SQL (Run)

### 3. Configurar o Webhook no Digital Manager Guru

1. Acesse seu painel do Digital Manager Guru
2. Vá em **Configurações → Webhooks**
3. Adicione um novo webhook:
   - **URL:** `https://seu-dominio.com/api/webhook/subscription`
   - **Eventos:** Marque todos os eventos de `subscription`
   - **Método:** POST
   - **Token:** Adicione o `Bearer Token` (seu DMG_API_TOKEN)

## 📊 Estrutura da Tabela

A tabela `assinaturas` armazena os seguintes campos principais:

### IDs e Identificação
- `subscription_id` - ID único da assinatura
- `subscription_internal_id` - ID interno
- `subscription_code` - Código da assinatura

### Status
- `status` - Status atual (active, canceled, past_due, etc.)

### Informações do Assinante
- `subscriber_id` - ID do assinante
- `subscriber_name` - Nome completo
- `subscriber_email` - Email
- `subscriber_doc` - CPF/CNPJ
- `subscriber_phone` - Telefone

### Informações do Produto/Plano
- `product_id` - ID do produto
- `product_name` - Nome do produto/plano
- `product_offer_id` - ID da oferta
- `product_offer_name` - Nome da oferta

### Pagamento
- `payment_method` - Método de pagamento (credit_card, boleto, pix)
- `currency` - Moeda (BRL, USD, etc.)
- `next_cycle_value` - Valor do próximo ciclo
- `charged_every_days` - Frequência de cobrança em dias

### Fatura Atual
- `current_invoice_status` - Status da fatura
- `current_invoice_value` - Valor da fatura
- `current_invoice_cycle` - Número do ciclo
- `current_invoice_charge_at` - Data de cobrança
- `current_invoice_period_start` - Início do período
- `current_invoice_period_end` - Fim do período

### Datas Importantes
- `started_at` - Data de início da assinatura
- `cycle_start_date` - Início do ciclo atual
- `cycle_end_date` - Fim do ciclo atual
- `next_cycle_at` - Data do próximo ciclo
- `canceled_at` - Data de cancelamento (se aplicável)

### Trial
- `trial_days` - Dias de trial
- `trial_started_at` - Início do trial
- `trial_finished_at` - Fim do trial

### Cancelamento
- `cancel_at_cycle_end` - Se cancela ao fim do ciclo
- `cancel_reason` - Motivo do cancelamento
- `cancelled_by_email` - Email de quem cancelou
- `cancelled_by_name` - Nome de quem cancelou

### Dados Completos
- `raw_webhook_data` - JSON completo do webhook (JSONB)

## 🔌 Endpoint

### POST `/api/webhook/subscription`

Recebe webhooks do Digital Manager Guru.

**Headers:**
```
Authorization: Bearer {DMG_API_TOKEN}
Content-Type: application/json
```

**Body:** JSON do webhook (conforme documentação do Digital Manager Guru)

**Resposta de Sucesso (200):**
```json
{
  "status": "success",
  "message": "Webhook processado com sucesso",
  "subscription_id": "sub_BOAEj2WTKoclmg4X",
  "subscriber_email": "email@example.com",
  "status_assinatura": "active",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Resposta de Erro (401):**
```json
{
  "error": "Unauthorized",
  "message": "Token de API inválido"
}
```

### GET `/api/webhook/subscription`

Testa se o endpoint está funcionando.

**Resposta:**
```json
{
  "status": "ok",
  "message": "Endpoint de webhook de assinatura está funcionando",
  "endpoint": "/api/webhook/subscription",
  "method": "POST",
  "description": "Recebe webhooks do Digital Manager Guru para gerenciar assinaturas",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📈 Casos de Uso

### 1. Listar Assinaturas Ativas

```sql
SELECT 
  subscriber_name,
  subscriber_email,
  product_name,
  status,
  next_cycle_at,
  next_cycle_value
FROM assinaturas
WHERE status = 'active'
ORDER BY next_cycle_at;
```

### 2. Identificar Assinaturas Próximas da Renovação

```sql
SELECT 
  subscriber_name,
  subscriber_email,
  product_name,
  next_cycle_at,
  next_cycle_value
FROM assinaturas
WHERE status = 'active'
  AND next_cycle_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY next_cycle_at;
```

### 3. Relatório de Cancelamentos

```sql
SELECT 
  subscriber_name,
  subscriber_email,
  product_name,
  canceled_at,
  cancel_reason,
  DATE_PART('day', canceled_at - started_at) as dias_como_cliente
FROM assinaturas
WHERE status = 'canceled'
ORDER BY canceled_at DESC;
```

### 4. MRR (Monthly Recurring Revenue)

```sql
SELECT 
  SUM(next_cycle_value) as mrr_total,
  COUNT(*) as assinaturas_ativas,
  AVG(next_cycle_value) as ticket_medio
FROM assinaturas
WHERE status = 'active';
```

### 5. Taxa de Retenção

```sql
SELECT 
  DATE_TRUNC('month', started_at) as mes,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as ativas,
  COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceladas,
  ROUND(
    COUNT(CASE WHEN status = 'active' THEN 1 END)::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) as taxa_retencao
FROM assinaturas
GROUP BY mes
ORDER BY mes DESC;
```

## 🧪 Testar o Webhook

### Localmente

```bash
curl -X POST http://localhost:3000/api/webhook/subscription \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-token-aqui" \
  -d @webhook_example.json
```

### Em Produção

```bash
curl -X POST https://seu-dominio.com/api/webhook/subscription \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-token-aqui" \
  -d @webhook_example.json
```

## 🔒 Segurança

- ✅ Validação de token Bearer
- ✅ Validação de tipo de webhook
- ✅ Logs detalhados de todas as operações
- ✅ Armazenamento do JSON completo para auditoria
- ✅ Índices otimizados para consultas rápidas

## 📝 Logs

O webhook gera logs detalhados:

```
🔔 Webhook de assinatura recebido: {...}
🔄 Atualizando assinatura existente: sub_XXX
✅ Assinatura atualizada com sucesso
```

ou

```
🔔 Webhook de assinatura recebido: {...}
➕ Criando nova assinatura: sub_XXX
✅ Assinatura criada com sucesso
```

## 🐛 Troubleshooting

### Erro 401 - Unauthorized

- Verifique se a variável `DMG_API_TOKEN` está configurada corretamente
- Verifique se o header `Authorization` está sendo enviado
- Verifique se o formato do token está correto: `Bearer {token}`

### Erro 500 - Internal Server Error

- Verifique os logs do servidor
- Verifique se a tabela `assinaturas` foi criada corretamente
- Verifique as credenciais do Supabase

### Webhook ignorado

- Verifique se o `webhook_type` é `subscription`
- Verifique se o JSON está no formato correto

## 📚 Referências

- [Documentação Digital Manager Guru](https://digitalmanager.guru/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

