-- Tabela para controlar limites de áudios grátis por dia (anônimos / não assinantes)
CREATE TABLE IF NOT EXISTS free_play_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_key TEXT NOT NULL, -- pode ser user_id ou combinação de IP + user agent
  context TEXT NOT NULL, -- anonymous | no_subscription | other
  play_date DATE NOT NULL,
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garante unicidade por chave + dia
CREATE UNIQUE INDEX IF NOT EXISTS idx_free_play_limits_key_date
  ON free_play_limits (limit_key, play_date);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_free_play_limits_date
  ON free_play_limits (play_date);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_free_play_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_free_play_limits_updated_at
  BEFORE UPDATE ON free_play_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_free_play_limits_updated_at();




