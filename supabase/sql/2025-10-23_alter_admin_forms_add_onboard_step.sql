-- Campo opcional para ordenar/exibir passos de onboarding
alter table if exists public.admin_forms
add column if not exists onboard_step integer;

-- Índice para ordenar por passo rapidamente
create index if not exists idx_admin_forms_onboard_step on public.admin_forms(onboard_step);

-- (Opcional) Unicidade apenas para formulários do tipo onboarding
create unique index if not exists ux_admin_forms_onboard_step
on public.admin_forms(onboard_step)
where form_type = 'onboarding' and onboard_step is not null;


