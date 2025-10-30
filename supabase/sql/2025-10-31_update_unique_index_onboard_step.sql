-- Ajusta unicidade do passo do onboarding para ser por "raiz" do formulário
-- Em vez de global (um único número para todos), passará a ser por grupo:
-- - Para etapas filhas: (parent_form_id, onboard_step) único
-- - Para o formulário raiz (parent_form_id é null): (id, onboard_step) único

-- Remover índice único anterior (se existir)
drop index if exists ux_admin_forms_onboard_step;

-- Criar índice único por grupo usando coalesce(parent_form_id, id)
create unique index if not exists ux_admin_forms_grouped_onboard_step
on public.admin_forms (coalesce(parent_form_id, id), onboard_step)
where form_type = 'onboarding' and onboard_step is not null;


