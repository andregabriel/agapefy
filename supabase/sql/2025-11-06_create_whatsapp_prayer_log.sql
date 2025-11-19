-- Log table for WhatsApp prayer sends to ensure idempotency per user/slot/day

create table if not exists public.whatsapp_prayer_log (
  id bigserial primary key,
  user_phone text not null,
  slot text not null check (slot in ('wakeup','lunch','dinner','sleep')),
  sent_date date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_prayer_log_unique_per_day
  on public.whatsapp_prayer_log (user_phone, slot, sent_date);

comment on table public.whatsapp_prayer_log is 'Records each prayer message sent per user/slot/day to avoid duplicates.';
comment on column public.whatsapp_prayer_log.user_phone is 'E.164 WhatsApp phone (digits only)';
comment on column public.whatsapp_prayer_log.slot is 'Prayer slot key (wakeup,lunch,dinner,sleep)';
comment on column public.whatsapp_prayer_log.sent_date is 'Local date (America/Sao_Paulo) of the send event';






