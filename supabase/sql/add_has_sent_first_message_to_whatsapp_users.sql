-- Adicionar coluna has_sent_first_message na tabela whatsapp_users
-- Esta coluna marca se o usuário já enviou a primeira mensagem via WhatsApp
-- Evita envio de mensagens não solicitadas (spam) antes do primeiro contato

alter table if exists public.whatsapp_users
  add column if not exists has_sent_first_message boolean not null default false;

-- Comentário na coluna para documentação
comment on column public.whatsapp_users.has_sent_first_message is 'Indica se o usuário já enviou a primeira mensagem via WhatsApp. Usado para evitar spam antes do primeiro contato.';






