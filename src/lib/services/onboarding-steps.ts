import { supabase } from '@/lib/supabase';

export interface OnboardingStep {
  id: string;
  position: number; // Posição real no fluxo (não o stepNumber de exibição)
  type: 'form' | 'static' | 'hardcoded' | 'info';
  title: string;
  description?: string;
  isActive: boolean;
  formData?: any;
  staticData?: {
    step2_title?: string;
    step2_subtitle?: string;
    step3_title?: string;
    step4_section_title?: string;
    step4_instruction?: string;
    step4_label?: string;
    step4_privacy_text?: string;
    step4_skip_button?: string;
    step4_complete_button?: string;
  };
  // Para identificar qual passo estático/hardcoded é
  staticKind?: 'preview' | 'whatsapp';
  hardcodedKind?: 'routine' | 'whatsapp-final' | 'daily-verse';
}

interface AppSettings {
  onboarding_step2_title?: string;
  onboarding_step2_subtitle?: string;
  onboarding_step3_title?: string;
  onboarding_step4_section_title?: string;
  onboarding_step4_instruction?: string;
  onboarding_step4_label?: string;
  onboarding_step4_privacy_text?: string;
  onboarding_step4_skip_button?: string;
  onboarding_step4_complete_button?: string;
  onboarding_static_preview_active?: string;
  onboarding_static_whatsapp_active?: string;
  onboarding_hardcoded_6_active?: string;
  onboarding_hardcoded_7_active?: string;
  onboarding_hardcoded_8_active?: string;
  onboarding_static_preview_position?: string;
  onboarding_static_whatsapp_position?: string;
  onboarding_hardcoded_6_position?: string;
  onboarding_hardcoded_7_position?: string;
  onboarding_hardcoded_8_position?: string;
}

/**
 * Determina a ordem real dos passos do onboarding, replicando a lógica do admin.
 * Retorna lista ordenada por posição real (não stepNumber de exibição).
 */
const REQUIRED_SETTINGS_KEYS: Array<keyof AppSettings> = [
  'onboarding_step2_title',
  'onboarding_step2_subtitle',
  'onboarding_step3_title',
  'onboarding_static_preview_active',
  'onboarding_static_whatsapp_active',
  'onboarding_hardcoded_6_active',
  'onboarding_hardcoded_7_active',
  'onboarding_hardcoded_8_active',
  'onboarding_static_preview_position',
  'onboarding_static_whatsapp_position',
  'onboarding_hardcoded_6_position',
  'onboarding_hardcoded_7_position',
  'onboarding_hardcoded_8_position',
];

export async function getOnboardingStepsOrder(
  settings?: AppSettings
): Promise<OnboardingStep[]> {
  // Buscar todos os formulários
  const { data: forms, error: formsError } = await supabase
    .from('admin_forms')
    .select('id, name, description, schema, onboard_step, is_active, form_type, parent_form_id')
    .order('onboard_step', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  if (formsError) {
    console.error('Erro ao buscar formulários:', formsError);
    return [];
  }

  const formsList = (forms || []) as any[];

  // Buscar settings se não foram fornecidos ou se vieram incompletos
  let appSettings: AppSettings = settings || {};

  const missingKeys = REQUIRED_SETTINGS_KEYS.filter(
    (key) => typeof (appSettings as any)[key] === 'undefined'
  );

  if (!settings || missingKeys.length > 0) {
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', missingKeys.length ? missingKeys : REQUIRED_SETTINGS_KEYS);

    if (settingsData) {
      settingsData.forEach((s: any) => {
        (appSettings as any)[s.key] = s.value;
      });
    }
  }

  type Entry = { position: number; data: Omit<OnboardingStep, 'position'> };
  const entries: Entry[] = [];

  // Passo 1: Formulário raiz
  let rootForm = formsList.find(
    (f) => f.onboard_step === 1 && (!f.parent_form_id || f.parent_form_id === null)
  );

  if (!rootForm) {
    rootForm = formsList.find(
      (f) =>
        (!f.onboard_step || f.onboard_step === null) &&
        (!f.parent_form_id || f.parent_form_id === null)
    );
  }

  if (!rootForm) {
    rootForm = formsList.find((f) => !f.parent_form_id || f.parent_form_id === null);
  }

  if (rootForm) {
    entries.push({
      position: 1,
      data: {
        id: rootForm.id,
        type: 'form',
        title: rootForm.name,
        description: rootForm.description,
        isActive: rootForm.is_active ?? true,
        formData: rootForm,
      },
    });
  }

  // Passos informativos e formulários dinâmicos (>= 2)
  // Replicar EXATAMENTE a lógica do admin: inserir TODOS os formulários (ativos e inativos)
  const dynamicForms = formsList.filter(
    (f) => typeof f.onboard_step === 'number' && (f.onboard_step as number) >= 2
  );
  const occupied = new Set<number>(
    dynamicForms.map((f) => f.onboard_step as number).concat(rootForm ? [1] : [])
  );

  // Inserir TODOS os formulários dinâmicos (ativos e inativos) com a posição igual ao onboard_step original
  // Isso replica exatamente a lógica do admin
  dynamicForms.forEach((form) => {
    if (form.onboard_step) {
      const isInfoStep =
        form.schema &&
        Array.isArray(form.schema) &&
        form.schema.length > 0 &&
        form.schema[0]?.type === 'info';

      entries.push({
        position: form.onboard_step,
        data: {
          id: form.id,
          type: isInfoStep ? 'info' : 'form',
          title: form.name,
          description: form.description,
          isActive: form.is_active ?? true,
          formData: form,
        },
      });
    }
  });

  // Função util para alocar primeiro slot livre a partir de um baseline
  const findNextFree = (start: number) => {
    let s = start;
    while (occupied.has(s)) s += 1;
    occupied.add(s);
    return s;
  };

  // Alocar estáticos usando posições de app_settings (ou defaults)
  const previewPosition = Number.parseInt(appSettings.onboarding_static_preview_position || '2', 10) || 2;
  const previewSlot = findNextFree(previewPosition);
  const previewActive =
    appSettings.onboarding_static_preview_active !== 'false'; // default true
  entries.push({
    position: previewSlot,
    data: {
      id: 'static-step-preview',
      type: 'static',
      title: 'Preview da Categoria',
      description: appSettings.onboarding_step2_subtitle,
      isActive: previewActive,
      staticData: {
        step2_title: appSettings.onboarding_step2_title,
        step2_subtitle: appSettings.onboarding_step2_subtitle,
      },
      staticKind: 'preview',
    },
  });

  const whatsappPosition = Number.parseInt(appSettings.onboarding_static_whatsapp_position || '3', 10) || 3;
  const whatsappSlot = findNextFree(whatsappPosition);
  const whatsappActive =
    appSettings.onboarding_static_whatsapp_active !== 'false'; // default true
  entries.push({
    position: whatsappSlot,
    data: {
      id: 'static-step-whatsapp',
      type: 'static',
      title: 'Conectar WhatsApp',
      description: appSettings.onboarding_step3_title,
      isActive: whatsappActive,
      staticData: {
        step3_title: appSettings.onboarding_step3_title,
        step4_section_title: appSettings.onboarding_step4_section_title,
        step4_instruction: appSettings.onboarding_step4_instruction,
        step4_label: appSettings.onboarding_step4_label,
        step4_privacy_text: appSettings.onboarding_step4_privacy_text,
        step4_skip_button: appSettings.onboarding_step4_skip_button,
        step4_complete_button: appSettings.onboarding_step4_complete_button,
      },
      staticKind: 'whatsapp',
    },
  });

  // Hardcoded usando posições de app_settings (ou defaults)
  const hard6Position = Number.parseInt(appSettings.onboarding_hardcoded_6_position || '6', 10) || 6;
  const hard6 = findNextFree(hard6Position);
  const hard6Active = appSettings.onboarding_hardcoded_6_active !== 'false'; // default true
  entries.push({
    position: hard6,
    data: {
      id: 'hardcoded-step-6',
      type: 'hardcoded',
      title: 'Sua rotina está pronta',
      description: 'Tela de exibição da playlist da rotina criada',
      isActive: hard6Active,
      hardcodedKind: 'routine',
    },
  });

  const hard7Position = Number.parseInt(appSettings.onboarding_hardcoded_7_position || '7', 10) || 7;
  const hard7 = findNextFree(hard7Position);
  const hard7Active = appSettings.onboarding_hardcoded_7_active !== 'false'; // default true
  entries.push({
    position: hard7,
    data: {
      id: 'hardcoded-step-7',
      type: 'hardcoded',
      title: 'Conectar WhatsApp (final)',
      description: 'Tela de configuração do WhatsApp para receber versículos diários',
      isActive: hard7Active,
      hardcodedKind: 'whatsapp-final',
    },
  });

  const hard8Position = Number.parseInt(appSettings.onboarding_hardcoded_8_position || '8', 10) || 8;
  const hard8 = findNextFree(hard8Position);
  const hard8Active = appSettings.onboarding_hardcoded_8_active !== 'false'; // default true
  entries.push({
    position: hard8,
    data: {
      id: 'hardcoded-step-8',
      type: 'hardcoded',
      title: 'Versículo Diário',
      description: 'Tela de opt-in para receber versículos diários via WhatsApp',
      isActive: hard8Active,
      hardcodedKind: 'daily-verse',
    },
  });

  // Ordenar por posição
  const ordered = entries.sort((a, b) => a.position - b.position);
  return ordered.map((e) => ({
    ...e.data,
    position: e.position,
  }));
}

/**
 * Gera URL para um passo específico baseado no tipo
 */
export function getStepUrl(
  step: OnboardingStep,
  params: {
    categoryId?: string;
    formId?: string;
  }
): string {
  const categoryParam = params.categoryId
    ? `&categoryId=${encodeURIComponent(params.categoryId)}`
    : '';
  const formParam = params.formId ? `&formId=${encodeURIComponent(params.formId)}` : '';

  if (step.type === 'static') {
    if (step.staticKind === 'preview') {
      return `/onboarding?step=${step.position}&showStatic=preview${categoryParam}${formParam}`;
    } else if (step.staticKind === 'whatsapp') {
      return `/onboarding?step=${step.position}&showStatic=whatsapp${categoryParam}${formParam}`;
    }
  }

  // Para passos dinâmicos e hardcoded
  return `/onboarding?step=${step.position}${categoryParam}${formParam}`;
}

/**
 * Encontra o próximo passo ativo após o passo atual
 */
export async function getNextStepUrl(
  currentStep: number,
  params: {
    categoryId?: string;
    formId?: string;
    settings?: AppSettings;
  }
): Promise<string> {
  const steps = await getOnboardingStepsOrder(params.settings);

  // Filtrar apenas passos ativos
  let activeSteps = steps.filter((s) => s.isActive);

  // Verificação especial para passo preview: só está disponível se tiver categoryId
  activeSteps = activeSteps.filter((s) => {
    if (s.type === 'static' && s.staticKind === 'preview') {
      return !!params.categoryId;
    }
    return true;
  });

  // Ordenar por position para garantir ordem correta
  activeSteps.sort((a, b) => a.position - b.position);

  // Sempre pegar o primeiro passo ativo com posição maior que a atual.
  // Esta regra simples garante avanço sequencial sem pular passos ativos.
  const nextStep = activeSteps.find((s) => s.position > currentStep);

  if (nextStep) {
    return getStepUrl(nextStep, params);
  }

  // Não há mais passos, finalizar onboarding
  return '/';
}

/**
 * Retorna o metadado do passo pela posição atual, considerando settings.
 * Útil para centralizar a decisão de renderização no cliente.
 */
export async function getStepByPosition(
  position: number,
  settings?: AppSettings
): Promise<OnboardingStep | null> {
  const steps = await getOnboardingStepsOrder(settings);
  const step = steps.find((s) => s.position === position);
  return step || null;
}
