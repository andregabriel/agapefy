-- Tabela para histórico de respostas dos formulários administrativos
create table if not exists public.admin_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.admin_forms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_form_responses_form on public.admin_form_responses(form_id);
create index if not exists idx_admin_form_responses_user on public.admin_form_responses(user_id);

alter table public.admin_form_responses enable row level security;

-- Inserir: qualquer usuário autenticado pode responder
drop policy if exists "responses_insert_authenticated" on public.admin_form_responses;
create policy "responses_insert_authenticated"
on public.admin_form_responses for insert
to authenticated
with check (true);

-- Ler: apenas admins autenticados
drop policy if exists "responses_select_admins" on public.admin_form_responses;
create policy "responses_select_admins"
on public.admin_form_responses for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.role, 'user') = 'admin'
  )
);


