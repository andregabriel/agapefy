-- Adicionar campos para permitir campo "Outros" customizável nos formulários
alter table if exists public.admin_forms
add column if not exists allow_other_option boolean not null default false;

alter table if exists public.admin_forms
add column if not exists other_option_label text;

comment on column public.admin_forms.allow_other_option is 'Se true, permite que usuários preencham um campo "Outros" customizável';
comment on column public.admin_forms.other_option_label is 'Label customizado para o campo "Outros" (padrão: "Outros")';


