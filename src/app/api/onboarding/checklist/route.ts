import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/api-auth';

type StepItem = { stepNumber: number; label: string; completed: boolean };

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
const logPrefix = '[onboarding-checklist]';

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
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;

    console.info(`${logPrefix} start`, { userId });

    if (!hasServiceRoleKey) {
      if (!hasWarnedMissingServiceRole) {
        // Log apenas uma vez para evitar ruído no console durante o desenvolvimento.
        console.warn(
          `${logPrefix} service role key missing, returning empty (dev fallback).`
        );
        hasWarnedMissingServiceRole = true;
      }
      return NextResponse.json({
        steps: [{ stepNumber: 1, label: 'Onboarding pendente', completed: false }],
        hasPending: true,
        nextStep: 1,
        error: 'missing_service_role',
      });
    }

    const supabase = getAdminSupabase();
    const stepsOrder = await getStepsOrderAdmin();

    const formSteps = stepsOrder.filter(
      (s) => (s.type === 'form' || s.type === 'info') && s.isActive && s.formData
    );

    const formIds = formSteps.map((f) => f.id).filter(Boolean);

    // Respostas (via service role, ignora RLS)
    let answeredIds = new Set<string>();
    if (formIds.length > 0) {
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
          {
            steps: [{ stepNumber: 1, label: 'Onboarding pendente', completed: false }],
            hasPending: true,
            nextStep: 1,
            error: 'responses_error',
          },
          { status: 200 }
        );
      }
      answeredIds = new Set((responses || []).map((r: any) => r.form_id));
    }

    // WhatsApp - busca por user_id primeiro
    let wa: any = null;
    const { data: waByUserId, error: waError } = await supabase
      .from('whatsapp_users')
      .select('phone_number, receives_daily_verse')
      .eq('user_id', userId)
      .maybeSingle();
    if (waError) {
      console.error(`${logPrefix} whatsapp_users by user_id error`, {
        message: waError.message,
        details: waError.details,
        hint: waError.hint,
      });
    }
    wa = waByUserId;
    
    // Se não encontrou por user_id, busca registros sem user_id (para compatibilidade com registros antigos)
    // Considera que se o usuário salvou o WhatsApp antes da correção, pode não ter user_id
    if (!wa || !wa.phone_number) {
      const { data: waWithoutUserId, error: waNullError } = await supabase
        .from('whatsapp_users')
        .select('phone_number, receives_daily_verse, user_id')
        .is('user_id', null)
        .not('phone_number', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (waNullError) {
        console.error(`${logPrefix} whatsapp_users without user_id error`, {
          message: waNullError.message,
          details: waNullError.details,
          hint: waNullError.hint,
        });
      }

      // Se encontrou registros sem user_id, usa o mais recente
      // Isso assume que registros antigos sem user_id podem ser do usuário atual
      if (waWithoutUserId && waWithoutUserId.length > 0) {
        wa = waWithoutUserId[0];
      }
    }
    
    const hasPhone = Boolean(wa?.phone_number && String(wa.phone_number).trim().length > 0);
    const versePrefSet = typeof (wa as any)?.receives_daily_verse === 'boolean';

    // Rotina - verifica se existe playlist E se tem áudios
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id')
      .eq('created_by', userId)
      .eq('title', 'Minha Rotina')
      .eq('is_public', false)
      .maybeSingle();
    if (playlistError) {
      console.error(`${logPrefix} playlists lookup error`, {
        message: playlistError.message,
        details: playlistError.details,
        hint: playlistError.hint,
      });
    }
    
    let hasRoutine = false;
    if (playlist?.id) {
      // Verificar se a playlist tem pelo menos um áudio
      const { count, error: playlistAudioError } = await supabase
        .from('playlist_audios')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);
      if (playlistAudioError) {
        console.error(`${logPrefix} playlist_audios count error`, {
          message: playlistAudioError.message,
          details: playlistAudioError.details,
          hint: playlistAudioError.hint,
        });
      }
      hasRoutine = (count || 0) > 0;
    }

    const steps: StepItem[] = [];

    // Montar checklist seguindo a ordem real (apenas passos ativos)
    const activeSteps = stepsOrder.filter((s) => s.isActive);
    activeSteps.sort((a, b) => a.position - b.position);

    // Ajuda: passo1 (para completude do preview)
    const step1Id = formSteps.find((s) => s.position === 1)?.id;
    const step1Completed = step1Id ? answeredIds.has(step1Id) : true;

    activeSteps.forEach((step, idx) => {
      let completed = false;
      if (step.type === 'form' || step.type === 'info') {
        completed = answeredIds.has(step.id);
      } else if (step.type === 'static' && step.staticKind === 'preview') {
        completed = step1Completed;
      } else if (step.type === 'static' && step.staticKind === 'whatsapp') {
        completed = hasPhone;
      } else if (step.type === 'hardcoded') {
        if (step.hardcodedKind === 'routine') completed = hasRoutine;
        else if (step.hardcodedKind === 'whatsapp-final') completed = hasPhone;
        else if (step.hardcodedKind === 'daily-verse') completed = versePrefSet;
      }
      steps.push({
        stepNumber: idx + 1,
        label: step.title || `Passo ${step.position}`,
        completed,
      });
    });

    const hasPending = steps.some((s) => !s.completed);
    const nextStep = hasPending ? steps.find((s) => !s.completed)?.stepNumber ?? null : null;

    console.info(`${logPrefix} result`, {
      userId,
      hasPending,
      nextStep,
      firstPending: steps.find((s) => !s.completed)?.stepNumber ?? null,
    });

    return NextResponse.json({ steps, hasPending, nextStep });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`${logPrefix} unexpected error`, {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(
      {
        steps: [{ stepNumber: 1, label: 'Onboarding pendente', completed: false }],
        hasPending: true,
        nextStep: 1,
        error: 'unexpected',
      },
      { status: 200 }
    );
  }
}
