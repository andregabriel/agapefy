-- Devocional diario: tabelas de conteudo, progresso e streak
-- Escopo: cria apenas novas tabelas e politicas RLS associadas

create table if not exists public.devotionals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text,
  theme text,
  citation_text text,
  citation_reference text,
  citation_phrase_id bigint references public.phrases(id) on delete set null,
  passage_ref text,
  passage_intro text,
  passage_verses jsonb,
  reflection_text text,
  reflection_audio_id uuid references public.audios(id) on delete set null,
  prayer_text text,
  prayer_audio_id uuid references public.audios(id) on delete set null,
  created_at timestamptz not null default now()
);

-- UNIQUE(date) + indice para busca diaria
create unique index if not exists idx_devotionals_date on public.devotionals(date);

create table if not exists public.user_devotional_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  block_type text not null check (block_type in ('citation','verse','reflection','prayer')),
  completed_at timestamptz not null default now(),
  unique (user_id, devotional_id, block_type)
);

create index if not exists idx_user_devotional_progress_user_devotional
  on public.user_devotional_progress(user_id, devotional_id);

create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  total_days_with_god int not null default 0,
  trophies int not null default 0,
  last_completed_date date,
  updated_at timestamptz not null default now()
);

-- UNIQUE(user_id) ja garante indice para lookup por usuario
create unique index if not exists idx_user_streaks_user_id on public.user_streaks(user_id);

alter table public.devotionals enable row level security;
alter table public.user_devotional_progress enable row level security;
alter table public.user_streaks enable row level security;

drop policy if exists "devotionals_select_authenticated" on public.devotionals;
create policy "devotionals_select_authenticated"
  on public.devotionals
  for select
  to authenticated
  using (true);

drop policy if exists "user_devotional_progress_select_own" on public.user_devotional_progress;
create policy "user_devotional_progress_select_own"
  on public.user_devotional_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_devotional_progress_insert_own" on public.user_devotional_progress;
create policy "user_devotional_progress_insert_own"
  on public.user_devotional_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_streaks_select_own" on public.user_streaks;
create policy "user_streaks_select_own"
  on public.user_streaks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_streaks_insert_own" on public.user_streaks;
create policy "user_streaks_insert_own"
  on public.user_streaks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_streaks_update_own" on public.user_streaks;
create policy "user_streaks_update_own"
  on public.user_streaks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
