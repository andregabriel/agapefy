-- Stores which challenge playlists a WhatsApp user (by phone) opted into
create table if not exists public.whatsapp_user_challenges (
  id bigserial primary key,
  phone_number text not null,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (phone_number, playlist_id)
);

alter table public.whatsapp_user_challenges enable row level security;

-- Read allowed to anon/auth (UI may render selections back to the same user)
drop policy if exists "whatsapp_user_challenges_select" on public.whatsapp_user_challenges;
create policy "whatsapp_user_challenges_select"
on public.whatsapp_user_challenges for select
to anon, authenticated
using (true);

-- Authenticated users can manage their selections (no strict ownership enforced; mirrors whatsapp_users)
drop policy if exists "whatsapp_user_challenges_write" on public.whatsapp_user_challenges;
create policy "whatsapp_user_challenges_write"
on public.whatsapp_user_challenges for all
to authenticated
using (true)
with check (true);

comment on table public.whatsapp_user_challenges is 'User phone to challenge playlist selections for WhatsApp Journeys';
comment on column public.whatsapp_user_challenges.phone_number is 'E.164 digits-only phone number used in whatsapp_users';
comment on column public.whatsapp_user_challenges.playlist_id is 'Challenge playlist (playlists.id).';


