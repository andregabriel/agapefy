-- Adicionar coluna user_id na tabela whatsapp_users para vincular ao usuário logado
-- Isso permite buscar dados do usuário incluindo WhatsApp e email

alter table if exists public.whatsapp_users
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Criar índice para melhorar performance nas buscas por user_id
create index if not exists idx_whatsapp_users_user_id on public.whatsapp_users(user_id);

-- Comentário explicativo
comment on column public.whatsapp_users.user_id is 'ID do usuário logado vinculado ao número do WhatsApp. Permite buscar dados do usuário incluindo WhatsApp e email.';



