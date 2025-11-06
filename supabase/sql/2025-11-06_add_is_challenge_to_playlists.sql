-- Adicionar coluna is_challenge na tabela playlists
ALTER TABLE public.playlists 
ADD COLUMN IF NOT EXISTS is_challenge boolean DEFAULT false;

-- Criar índice para performance em consultas de desafios
CREATE INDEX IF NOT EXISTS idx_playlists_is_challenge 
ON public.playlists(is_challenge) 
WHERE is_challenge = true;

-- Migrar dados existentes da tabela challenge (se houver)
UPDATE public.playlists p
SET is_challenge = true
WHERE EXISTS (
  SELECT 1 FROM public.challenge c 
  WHERE c.playlist_id = p.id
);

-- Comentário na coluna
COMMENT ON COLUMN public.playlists.is_challenge IS 'Indica se a playlist é um desafio para a jornada do WhatsApp';

