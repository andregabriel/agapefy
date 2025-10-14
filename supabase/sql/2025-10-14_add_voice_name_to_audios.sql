-- Add voice_name column to audios table (nullable)
alter table public.audios
add column if not exists voice_name text;

-- Optional: index if frequently filtered
-- create index if not exists audios_voice_name_idx on public.audios (voice_name);


