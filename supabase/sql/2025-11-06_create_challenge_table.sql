-- Create table to mark playlists that are challenges
create table if not exists public.challenge (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  unique (playlist_id)
);

-- Helpful indexes
create index if not exists idx_challenge_created_at on public.challenge(created_at desc);

-- Enable RLS
alter table public.challenge enable row level security;

-- Read access for everyone (clients need to know which playlists are challenges)
drop policy if exists "challenge_select_all" on public.challenge;
create policy "challenge_select_all"
on public.challenge for select
to anon, authenticated
using (true);

-- Full access for service role
drop policy if exists "challenge_all_service" on public.challenge;
create policy "challenge_all_service"
on public.challenge for all
to service_role
using (true)
with check (true);

-- Allow authenticated admins (profiles.role = 'admin') to manage via client
drop policy if exists "challenge_write_admins" on public.challenge;
create policy "challenge_write_admins"
on public.challenge for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.role, 'user') = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.role, 'user') = 'admin'
  )
);

comment on table public.challenge is 'Marks playlists that are considered challenges';
comment on column public.challenge.playlist_id is 'References playlists(id); unique means one row per challenge playlist';


