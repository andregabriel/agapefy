-- Add ai_engine column to audios table (nullable, short text)
alter table public.audios
add column if not exists ai_engine text;

-- Optional: index if frequently filtered
-- create index if not exists audios_ai_engine_idx on public.audios (ai_engine);

