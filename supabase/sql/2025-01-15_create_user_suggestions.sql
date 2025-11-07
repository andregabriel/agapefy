-- Tabela para armazenar sugestões dos usuários de múltiplas fontes
create table if not exists public.user_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  suggestion_text text not null,
  source text not null, -- valores: 'onboarding', 'nps', 'home', etc.
  source_id uuid, -- referencia form_id ou feedback_id
  form_id uuid references public.admin_forms(id) on delete set null,
  grouped_topic text, -- tópico agrupado manualmente ou automático
  created_at timestamptz not null default now()
);

-- Índices para performance
create index if not exists idx_user_suggestions_source on public.user_suggestions(source);
create index if not exists idx_user_suggestions_grouped_topic on public.user_suggestions(grouped_topic);
create index if not exists idx_user_suggestions_created_at on public.user_suggestions(created_at);
create index if not exists idx_user_suggestions_user_id on public.user_suggestions(user_id);
create index if not exists idx_user_suggestions_form_id on public.user_suggestions(form_id);

-- RLS
alter table public.user_suggestions enable row level security;

-- Inserir: qualquer usuário autenticado pode inserir sugestões
drop policy if exists "suggestions_insert_authenticated" on public.user_suggestions;
create policy "suggestions_insert_authenticated"
on public.user_suggestions for insert
to authenticated
with check (true);

-- Ler: apenas admins autenticados
drop policy if exists "suggestions_select_admins" on public.user_suggestions;
create policy "suggestions_select_admins"
on public.user_suggestions for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.role, 'user') = 'admin'
  )
);

comment on table public.user_suggestions is 'Sugestões dos usuários vindas de múltiplas fontes (onboarding, NPS, etc.)';


