-- Create admin_forms table to store configurable admin/onboarding forms
create table if not exists public.admin_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  form_type text not null default 'onboarding', -- e.g., onboarding, survey, nps
  schema jsonb not null default '[]'::jsonb, -- array of field definitions
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Helpful indexes
create index if not exists idx_admin_forms_type on public.admin_forms(form_type);
create index if not exists idx_admin_forms_active on public.admin_forms(is_active);

-- Trigger to update updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_admin_forms_updated_at on public.admin_forms;
create trigger trg_admin_forms_updated_at
before update on public.admin_forms
for each row execute function set_updated_at();

-- RLS: allow read for authenticated users; insert/update/delete for service role only
alter table public.admin_forms enable row level security;

drop policy if exists "admin_forms_read" on public.admin_forms;
create policy "admin_forms_read"
on public.admin_forms for select
to authenticated, anon
using (true);

drop policy if exists "admin_forms_write_service" on public.admin_forms;
create policy "admin_forms_write_service"
on public.admin_forms for all
to service_role
using (true)
with check (true);

-- Allow authenticated admins (profiles.role = 'admin') to manage forms via client
drop policy if exists "admin_forms_write_admins" on public.admin_forms;
create policy "admin_forms_write_admins"
on public.admin_forms for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.role, 'user') = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and coalesce(p.role, 'user') = 'admin'
  )
);

comment on table public.admin_forms is 'Administrative forms like onboarding; schema holds field definitions.';
comment on column public.admin_forms.schema is 'JSON Schema-like array of fields: [{ id, label, type, required, options[] }]';


