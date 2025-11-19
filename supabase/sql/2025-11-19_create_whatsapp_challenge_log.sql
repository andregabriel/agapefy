-- Log de envios diários de desafio por usuário / playlist / áudio
-- Usado para controlar progresso (1..N áudios) e garantir idempotência diária

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

comment on table public.whatsapp_challenge_log is 'Tracks WhatsApp challenge progress per user/playlist/audio and day.';
comment on column public.whatsapp_challenge_log.user_phone is 'Digits-only WhatsApp phone (E.164 without +).';
comment on column public.whatsapp_challenge_log.sequence_index is '1-based index of the audio within the playlist for the challenge journey.';



