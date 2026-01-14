-- Fix: allow authenticated users to save their own WhatsApp settings (RLS)
-- Context: client-side onboarding/whatsapp setup upserts into public.whatsapp_users.
-- After enabling/tightening RLS, those writes started failing with 42501 (insufficient privilege).
--
-- Goal (surgical):
-- - authenticated users can SELECT their own row (user_id = auth.uid())
-- - authenticated users can INSERT their own row (user_id = auth.uid())
-- - authenticated users can UPDATE their own row, and can "claim" legacy rows with user_id IS NULL
--   by setting user_id = auth.uid()
--
-- Notes:
-- - Service role (Edge Functions / server admin routes) bypasses RLS.
-- - This file is idempotent and safe to re-run.

alter table if exists public.whatsapp_users enable row level security;

-- Ensure base privileges exist for authenticated role (policies alone are not enough).
-- If privileges were revoked during recent hardening, PostgREST will fail with 42501 even with correct RLS.
grant usage on schema public to authenticated;
grant select, insert, update on table public.whatsapp_users to authenticated;

-- If whatsapp_users has a serial/bigserial id, inserts may require USAGE on its sequence.
do $$
declare
  seq regclass;
begin
  seq := pg_get_serial_sequence('public.whatsapp_users', 'id')::regclass;
  if seq is not null then
    execute format('grant usage, select on sequence %s to authenticated', seq);
  end if;
exception
  when undefined_table then
    -- table doesn't exist in this environment
    null;
  when undefined_column then
    -- no serial id column; nothing to grant
    null;
end $$;

-- SELECT: only own row
drop policy if exists "whatsapp_users_select_own" on public.whatsapp_users;
create policy "whatsapp_users_select_own"
on public.whatsapp_users
for select
to authenticated
using (user_id = auth.uid());

-- INSERT: must be own row
drop policy if exists "whatsapp_users_insert_own" on public.whatsapp_users;
create policy "whatsapp_users_insert_own"
on public.whatsapp_users
for insert
to authenticated
with check (user_id = auth.uid());

-- UPDATE: own row OR legacy row with NULL user_id (must set user_id to auth.uid())
drop policy if exists "whatsapp_users_update_own_or_claim_legacy" on public.whatsapp_users;
create policy "whatsapp_users_update_own_or_claim_legacy"
on public.whatsapp_users
for update
to authenticated
using (user_id = auth.uid() or user_id is null)
with check (user_id = auth.uid());

