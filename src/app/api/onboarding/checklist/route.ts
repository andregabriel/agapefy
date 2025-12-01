import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

type StepItem = { stepNumber: number; label: string; completed: boolean };

const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY);
let hasWarnedMissingServiceRole = false;
const logPrefix = '[onboarding-checklist]';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || null;
    if (!userId) return NextResponse.json({ steps: [], hasPending: false, nextStep: null });

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

    // Buscar forms de onboarding (inclui legados sem form_type definido)
    const { data: forms, error: formsError } = await supabase
      .from('admin_forms')
      .select('id, name, onboard_step, is_active, parent_form_id, form_type, created_at')
      .order('onboard_step', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (formsError) {
      console.error(`${logPrefix} admin_forms error`, {
        message: formsError.message,
        details: formsError.details,
        hint: formsError.hint,
      });
      return NextResponse.json(
        {
          steps: [{ stepNumber: 1, label: 'Onboarding pendente', completed: false }],
          hasPending: true,
          nextStep: 1,
          error: 'forms_error',
        },
        { status: 200 }
      );
    }

    const formsList = (forms || []).filter((form: any) => {
      const type = form.form_type;
      const isOnboarding =
        type === 'onboarding' || type === null || typeof type === 'undefined' || type === '';
      const isActive = form.is_active !== false; // tratar null/undefined como ativo (compat legada)
      return isOnboarding && isActive;
    }) as Array<{
      id: string;
      name: string;
      onboard_step: number | null;
      is_active?: boolean;
      parent_form_id?: string | null;
      form_type?: string | null;
      created_at?: string | null;
    }>;

    console.info(`${logPrefix} forms fetched`, {
      total: forms?.length ?? 0,
      filtered: formsList.length,
    });

    // Mapear passo 1 com fallback para formulários legados sem onboard_step
    const byStep = new Map<number, { id: string; name: string }>();
    const rootForm =
      formsList.find(
        (f) =>
          f.onboard_step === 1 && (f.parent_form_id === null || f.parent_form_id === undefined)
      ) ||
      formsList.find(
        (f) =>
          (f.onboard_step === null || typeof f.onboard_step !== 'number') &&
          (f.parent_form_id === null || f.parent_form_id === undefined)
      ) ||
      formsList.find((f) => f.parent_form_id === null || f.parent_form_id === undefined);

    if (rootForm) {
      byStep.set(1, { id: rootForm.id, name: rootForm.name || 'Passo 1' });
    }

    // Passos dinâmicos (>=2), mantendo o primeiro encontrado para cada posição
    const dynamicForms = formsList.filter(
      (f) => typeof f.onboard_step === 'number' && (f.onboard_step as number) >= 2
    );
    for (const f of dynamicForms) {
      const step = Number((f as any).onboard_step);
      if (!Number.isFinite(step)) continue;
      if (!byStep.has(step)) {
        byStep.set(step, { id: (f as any).id, name: (f as any).name || `Passo ${step}` });
      }
    }

    const formIds = Array.from(byStep.values())
      .map((x) => x.id)
      .filter(Boolean);

    if (formIds.length === 0) {
      console.warn(`${logPrefix} no formIds, returning fallback pending`, { userId });
      return NextResponse.json({
        steps: [{ stepNumber: 1, label: 'Onboarding pendente', completed: false }],
        hasPending: true,
        nextStep: 1,
      });
    }

    // Respostas (via service role, ignora RLS)
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
    const answeredIds = new Set((responses || []).map((r: any) => r.form_id));

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

    const label1 = byStep.get(1)?.name || 'Responder pergunta inicial';
    const label4 = byStep.get(4)?.name || 'Preferências';
    const label5 = byStep.get(5)?.name || 'Montar rotina';

    steps.push({ stepNumber: 1, label: label1, completed: byStep.has(1) ? answeredIds.has(byStep.get(1)!.id) : true });
    steps.push({ stepNumber: 2, label: 'Prévia da categoria', completed: steps[0].completed });
    steps.push({ stepNumber: 3, label: 'Conectar WhatsApp', completed: hasPhone });
    steps.push({ stepNumber: 4, label: label4, completed: byStep.has(4) ? answeredIds.has(byStep.get(4)!.id) : true });
    steps.push({ stepNumber: 5, label: label5, completed: byStep.has(5) ? answeredIds.has(byStep.get(5)!.id) : true });
    steps.push({ stepNumber: 6, label: 'Rotina pronta', completed: steps[4].completed || hasRoutine });
    steps.push({ stepNumber: 7, label: 'Conectar WhatsApp', completed: hasPhone });
    steps.push({ stepNumber: 8, label: 'Versículo diário', completed: versePrefSet });

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
