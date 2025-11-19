-- Tabela para armazenar preferências da Bíblia do usuário
-- Inclui última leitura, tema e escala de fonte

CREATE TABLE IF NOT EXISTS public.bible_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_book TEXT,
  last_read_chapter INTEGER,
  last_read_verse INTEGER,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  font_scale NUMERIC(4, 2) DEFAULT 1.0 CHECK (font_scale >= 0.90 AND font_scale <= 1.30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bible_preferences_user_id ON public.bible_preferences(user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_bible_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bible_preferences_updated_at
  BEFORE UPDATE ON public.bible_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_bible_preferences_updated_at();

-- RLS: usuários autenticados podem ler e atualizar apenas seus próprios dados
ALTER TABLE public.bible_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bible_preferences_select_own" ON public.bible_preferences;
CREATE POLICY "bible_preferences_select_own"
  ON public.bible_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bible_preferences_insert_own" ON public.bible_preferences;
CREATE POLICY "bible_preferences_insert_own"
  ON public.bible_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bible_preferences_update_own" ON public.bible_preferences;
CREATE POLICY "bible_preferences_update_own"
  ON public.bible_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE public.bible_preferences IS 'Preferências de leitura da Bíblia do usuário';
COMMENT ON COLUMN public.bible_preferences.last_read_book IS 'Código do último livro lido (ex: GEN, EXO)';
COMMENT ON COLUMN public.bible_preferences.last_read_chapter IS 'Último capítulo lido';
COMMENT ON COLUMN public.bible_preferences.last_read_verse IS 'Último versículo lido';
COMMENT ON COLUMN public.bible_preferences.theme IS 'Tema preferido: light ou dark';
COMMENT ON COLUMN public.bible_preferences.font_scale IS 'Escala da fonte (0.90 a 1.30)';

