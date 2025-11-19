-- Adicionar campos necessários para perfil e notificações na tabela profiles
-- Garante colunas sem quebrar ambientes já existentes

alter table if exists public.profiles
  add column if not exists whatsapp text;

alter table if exists public.profiles
  add column if not exists notification_novidades boolean not null default true;

-- Comentários para documentação
comment on column public.profiles.whatsapp is 'Número de WhatsApp do usuário';
comment on column public.profiles.notification_novidades is 'Preferência de notificação para novidades da Agapefy';



