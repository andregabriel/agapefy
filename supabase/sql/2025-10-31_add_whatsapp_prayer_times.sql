-- Add prayer time preferences per user for WhatsApp deliveries
-- Stores preferred times for: wake up, lunch, dinner, and sleep

alter table if exists public.whatsapp_users
  add column if not exists prayer_time_wakeup time;

alter table if exists public.whatsapp_users
  add column if not exists prayer_time_lunch time;

alter table if exists public.whatsapp_users
  add column if not exists prayer_time_dinner time;

alter table if exists public.whatsapp_users
  add column if not exists prayer_time_sleep time;

comment on column public.whatsapp_users.prayer_time_wakeup is 'Preferred time to receive prayer when waking up (HH:MM)';
comment on column public.whatsapp_users.prayer_time_lunch is 'Preferred time to receive prayer at lunch (HH:MM)';
comment on column public.whatsapp_users.prayer_time_dinner is 'Preferred time to receive prayer at dinner (HH:MM)';
comment on column public.whatsapp_users.prayer_time_sleep is 'Preferred time to receive prayer before sleeping (HH:MM)';


