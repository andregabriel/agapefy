-- Preferências adicionais para WhatsApp
-- Garante colunas sem quebrar ambientes já existentes

alter table if exists public.whatsapp_users
  add column if not exists receives_daily_prayer boolean not null default false;

alter table if exists public.whatsapp_users
  add column if not exists receives_daily_routine boolean not null default false;

-- Opcional: garantir is_active existe e default true (não altera se já existir)
alter table if exists public.whatsapp_users
  add column if not exists is_active boolean not null default true;

