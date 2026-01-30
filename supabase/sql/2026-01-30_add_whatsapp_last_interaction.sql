-- Track last inbound interaction from user (any message type)
-- Used to gate challenge sends until user interacts again.

alter table if exists public.whatsapp_users
  add column if not exists last_interaction_at timestamptz;

comment on column public.whatsapp_users.last_interaction_at is
  'Timestamp of last inbound message/interaction from the user (any type).';
