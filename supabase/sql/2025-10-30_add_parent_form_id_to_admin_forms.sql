-- Add optional parent_form_id to link child steps to a main form
alter table if exists public.admin_forms
  add column if not exists parent_form_id uuid null references public.admin_forms(id) on delete cascade;

create index if not exists idx_admin_forms_parent_form on public.admin_forms(parent_form_id);

