-- Tabela para gerenciar assinaturas recebidas via webhook do Digital Manager Guru
CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- IDs do sistema de pagamento
  subscription_id TEXT NOT NULL, -- ID da assinatura (sub_BOAEj2WTKoclmg4X)
  subscription_internal_id TEXT, -- ID interno (9ad693fe-4366-487b-8ac3-ff4831864929)
  subscription_code TEXT, -- Código da assinatura (sub_9CFyWTuPwXdJUikS)
  
  -- Status da assinatura
  status TEXT NOT NULL, -- active, canceled, past_due, etc.
  
  -- Informações do assinante
  subscriber_id TEXT NOT NULL,
  subscriber_name TEXT,
  subscriber_email TEXT,
  subscriber_doc TEXT, -- CPF/CNPJ
  subscriber_phone TEXT,
  subscriber_phone_local_code TEXT,
  
  -- Informações do produto/plano
  product_id TEXT,
  product_internal_id TEXT,
  product_name TEXT,
  product_offer_id TEXT,
  product_offer_name TEXT,
  
  -- Informações de pagamento
  payment_method TEXT, -- credit_card, boleto, pix, etc.
  currency TEXT DEFAULT 'BRL',
  next_cycle_value DECIMAL(10,2),
  charged_every_days INTEGER,
  
  -- Informações de fatura atual
  current_invoice_id TEXT,
  current_invoice_status TEXT,
  current_invoice_value DECIMAL(10,2),
  current_invoice_cycle INTEGER,
  current_invoice_charge_at DATE,
  current_invoice_period_start DATE,
  current_invoice_period_end DATE,
  
  -- Datas importantes
  started_at TIMESTAMPTZ,
  cycle_start_date DATE,
  cycle_end_date DATE,
  next_cycle_at DATE,
  canceled_at TIMESTAMPTZ,
  last_status_at TIMESTAMPTZ,
  
  -- Trial
  trial_days INTEGER DEFAULT 0,
  trial_started_at TIMESTAMPTZ,
  trial_finished_at TIMESTAMPTZ,
  
  -- Cancelamento
  cancel_at_cycle_end BOOLEAN DEFAULT false,
  cancel_reason TEXT,
  cancelled_by_email TEXT,
  cancelled_by_name TEXT,
  cancelled_by_date TIMESTAMPTZ,
  
  -- Provider
  provider TEXT, -- guru, stripe, etc.
  
  -- Cartão de crédito (informações básicas)
  credit_card_id TEXT,
  credit_card_brand TEXT,
  credit_card_last_four TEXT,
  credit_card_expiration_month INTEGER,
  credit_card_expiration_year INTEGER,
  
  -- Webhook metadata
  webhook_type TEXT DEFAULT 'subscription',
  api_token TEXT, -- Token usado no webhook
  
  -- JSON completo do webhook (para não perder nenhum dado)
  raw_webhook_data JSONB,
  
  -- Timestamps de controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_subscription_id ON assinaturas(subscription_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_subscriber_id ON assinaturas(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_subscriber_email ON assinaturas(subscriber_email);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_next_cycle_at ON assinaturas(next_cycle_at);
CREATE INDEX IF NOT EXISTS idx_assinaturas_created_at ON assinaturas(created_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_assinaturas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_assinaturas_updated_at
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION update_assinaturas_updated_at();

-- Comentários na tabela
COMMENT ON TABLE assinaturas IS 'Tabela para gerenciar assinaturas recebidas via webhook do Digital Manager Guru';
COMMENT ON COLUMN assinaturas.subscription_id IS 'ID único da assinatura no gateway de pagamento';
COMMENT ON COLUMN assinaturas.status IS 'Status atual da assinatura (active, canceled, past_due, etc.)';
COMMENT ON COLUMN assinaturas.raw_webhook_data IS 'JSON completo do webhook para referência futura';

