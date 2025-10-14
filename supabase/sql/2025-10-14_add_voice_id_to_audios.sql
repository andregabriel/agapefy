-- Add voice_id column to audios table (nullable)
alter table public.audios
add column if not exists voice_id text;

-- Optional: index if frequently filtered
-- create index if not exists audios_voice_id_idx on public.audios (voice_id);


