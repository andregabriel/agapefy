import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

type OnboardingStep = {
  id: string;
  position: number;
  type: 'form' | 'static' | 'hardcoded' | 'info';
  title: string;
  description?: string;
  isActive: boolean;
  formData?: any;
  staticKind?: 'preview' | 'whatsapp';
  hardcodedKind?: 'routine' | 'whatsapp-final' | 'daily-verse';
};

const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY);
let hasWarnedMissingServiceRole = false;
const logPrefix = '[onboarding-status]';

const SETTINGS_KEYS = [
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
] as const;

const SETTINGS_DEFAULTS: Record<string, string> = {
  onboarding_static_preview_position: '2',
  onboarding_static_whatsapp_position: '3',
  onboarding_hardcoded_6_position: '6',
  onboarding_hardcoded_7_position: '7',
  onboarding_hardcoded_8_position: '8',
  onboarding_static_preview_active: 'true',
  onboarding_static_whatsapp_active: 'true',
  onboarding_hardcoded_6_active: 'true',
  onboarding_hardcoded_7_active: 'true',
  onboarding_hardcoded_8_active: 'true',
  onboarding_step2_title: '',
  onboarding_step2_subtitle: '',
  onboarding_step3_title: '',
};

async function getStepsOrderAdmin(): Promise<OnboardingStep[]> {
  const supabase = getAdminSupabase();

  const { data: settingsData } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', SETTINGS_KEYS as any);

  const settings = { ...SETTINGS_DEFAULTS } as Record<string, string>;
  settingsData?.forEach((s: any) => {
    settings[s.key] = s.value;
  });

  const { data: forms } = await supabase
    .from('admin_forms')
    .select('*')
    .order('onboard_step', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  const formsList = (forms || []) as any[];

  let rootForm =
    formsList.find(
      (f) => f.onboard_step === 1 && (f.parent_form_id === null || f.parent_form_id === undefined)
    ) ||
    formsList.find(
      (f) =>
        (f.onboard_step === null || typeof f.onboard_step !== 'number') &&
        (f.parent_form_id === null || f.parent_form_id === undefined)
    ) ||
    formsList.find((f) => !f.parent_form_id || f.parent_form_id === null);

  type Entry = { position: number; data: Omit<OnboardingStep, 'position'> };
  const entries: Entry[] = [];

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

  const dynamicForms = formsList.filter(
    (f) => typeof f.onboard_step === 'number' && (f.onboard_step as number) >= 2
  );
  const occupied = new Set<number>(
    dynamicForms.map((f) => f.onboard_step as number).concat(rootForm ? [1] : [])
  );

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

  const findNextFree = (start: number) => {
    let s = start;
    while (occupied.has(s)) s += 1;
    occupied.add(s);
    return s;
  };

  const previewPosition = Number.parseInt(settings.onboarding_static_preview_position || '2', 10) || 2;
  const previewSlot = findNextFree(previewPosition);
  const previewActive = settings.onboarding_static_preview_active !== 'false';
  entries.push({
    position: previewSlot,
    data: {
      id: 'static-step-preview',
      type: 'static',
      title: 'Preview da Categoria',
      description: settings.onboarding_step2_subtitle,
      isActive: previewActive,
      staticKind: 'preview',
    },
  });

  const whatsappPosition = Number.parseInt(settings.onboarding_static_whatsapp_position || '3', 10) || 3;
  const whatsappSlot = findNextFree(whatsappPosition);
  const whatsappActive = settings.onboarding_static_whatsapp_active !== 'false';
  entries.push({
    position: whatsappSlot,
    data: {
      id: 'static-step-whatsapp',
      type: 'static',
      title: 'Conectar WhatsApp',
      description: settings.onboarding_step3_title,
      isActive: whatsappActive,
      staticKind: 'whatsapp',
    },
  });

  const hard6Position = Number.parseInt(settings.onboarding_hardcoded_6_position || '6', 10) || 6;
  const hard6 = findNextFree(hard6Position);
  const hard6Active = settings.onboarding_hardcoded_6_active !== 'false';
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

  const hard7Position = Number.parseInt(settings.onboarding_hardcoded_7_position || '7', 10) || 7;
  const hard7 = findNextFree(hard7Position);
  const hard7Active = settings.onboarding_hardcoded_7_active !== 'false';
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

  const hard8Position = Number.parseInt(settings.onboarding_hardcoded_8_position || '8', 10) || 8;
  const hard8 = findNextFree(hard8Position);
  const hard8Active = settings.onboarding_hardcoded_8_active !== 'false';
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

  const ordered = entries.sort((a, b) => a.position - b.position);
  return ordered.map((e) => ({
    ...e.data,
    position: e.position,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || null;
    if (!userId) {
      return NextResponse.json({ pending: false, steps: [] });
    }

    console.info(`${logPrefix} start`, { userId });

    if (!hasServiceRoleKey) {
      if (!hasWarnedMissingServiceRole) {
        console.warn(
          `${logPrefix} service role key missing, returning empty (dev fallback).`
        );
        hasWarnedMissingServiceRole = true;
      }
      return NextResponse.json(
        { pending: true, steps: [], nextStep: 1, error: 'missing_service_role' },
        { status: 200 }
      );
    }

    const supabase = getAdminSupabase();
    const stepsOrder = await getStepsOrderAdmin();

    const formSteps = stepsOrder.filter(
      (s) => (s.type === 'form' || s.type === 'info') && s.isActive && s.formData
    );

    if (formSteps.length === 0) {
      return NextResponse.json({ pending: false, steps: [], nextStep: null });
    }

    const formIds = formSteps.map(f => f.id).filter(Boolean);
    if (formIds.length === 0) {
      console.warn(`${logPrefix} no formIds after processing`, { userId });
      return NextResponse.json({ pending: false, steps: [], nextStep: null });
    }

    // Buscar respostas do usuário para esses formulários
    const { data: responses, error: respError } = await supabase
      .from('admin_form_responses')
      .select('form_id')
      .eq('user_id', userId)
      .in('form_id', formIds);
    if (respError) {
      console.error(`${logPrefix} admin_form_responses error`, {
        message: respError.message,
        details: respError.details,
        hint: respError.hint,
      });
      return NextResponse.json(
        { pending: true, steps: [], nextStep: 1, error: 'responses_error' },
        { status: 200 }
      );
    }

    const answeredIds = new Set((responses || []).map(r => r.form_id));
    const pendingForms = formSteps.filter(f => !answeredIds.has(f.id));

    console.info(`${logPrefix} result`, {
      userId,
      pendingCount: pendingForms.length,
      nextStep: pendingForms[0]?.position ?? null,
    });

    return NextResponse.json({
      pending: pendingForms.length > 0,
      steps: pendingForms.map(f => f.position),
      nextStep: pendingForms[0]?.position ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`${logPrefix} unexpected error`, {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(
      { pending: true, steps: [], nextStep: 1, error: 'unexpected' },
      { status: 200 }
    );
  }
}
