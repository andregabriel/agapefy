-- Fix: WhatsApp Challenge Cron schema prerequisites (idempotent)
-- Purpose:
-- - Ensure whatsapp_user_challenges has send_time (used by /api/cron-challenge)
-- - Ensure whatsapp_challenge_log exists (idempotency + progress tracking)
-- - Ensure PostgREST can join whatsapp_user_challenges -> whatsapp_users (FK on phone_number)
--
-- Safe to run multiple times.

-- 1) Column required by cron to filter by schedule window
alter table if exists public.whatsapp_user_challenges
  add column if not exists send_time time;

comment on column public.whatsapp_user_challenges.send_time is
  'Preferred time (America/Sao_Paulo) for WhatsApp challenge journey sends (HH:MM:SS).';

-- 2) Log table required by cron (insert BEFORE sending; deleted on send failure)
create table if not exists public.whatsapp_challenge_log (
  id bigserial primary key,
  user_phone text not null,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  audio_id uuid not null references public.audios(id) on delete cascade,
  sequence_index integer not null,
  sent_date date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_challenge_log_unique_per_day
  on public.whatsapp_challenge_log (user_phone, playlist_id, sent_date);

comment on table public.whatsapp_challenge_log is
  'Tracks WhatsApp challenge progress per user/playlist/audio and day (used by /api/cron-challenge).';

-- 3) Relationship required for PostgREST join:
--    whatsapp_user_challenges.select(..., whatsapp_users!inner(...))
-- Postgres requires referenced columns to be UNIQUE/PRIMARY KEY.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'whatsapp_users'
  ) then
    if not exists (
      select 1 from pg_indexes
      where schemaname = 'public' and indexname = 'whatsapp_users_phone_number_unique'
    ) then
      create unique index whatsapp_users_phone_number_unique
        on public.whatsapp_users (phone_number);
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'whatsapp_user_challenges'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'whatsapp_users'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_schema = 'public'
        and table_name = 'whatsapp_user_challenges'
        and constraint_name = 'whatsapp_user_challenges_phone_number_fkey'
    ) then
      alter table public.whatsapp_user_challenges
        add constraint whatsapp_user_challenges_phone_number_fkey
        foreign key (phone_number)
        references public.whatsapp_users(phone_number)
        on delete cascade;
    end if;
  end if;
end $$;


