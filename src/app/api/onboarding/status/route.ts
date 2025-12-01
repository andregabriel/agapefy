import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY);
let hasWarnedMissingServiceRole = false;
const logPrefix = '[onboarding-status]';

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

    // Buscar todos os passos de onboarding (inclui legados sem form_type definido),
    // ordenados por step e criação
    const { data: forms, error: formsError } = await supabase
      .from('admin_forms')
      .select('id, onboard_step, parent_form_id, created_at, is_active, form_type')
      .order('onboard_step', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (formsError) {
      console.error(`${logPrefix} admin_forms error`, {
        message: formsError.message,
        details: formsError.details,
        hint: formsError.hint,
      });
      return NextResponse.json(
        { pending: true, steps: [], nextStep: 1, error: 'forms_error' },
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
      onboard_step: number | null;
      parent_form_id: string | null;
      created_at: string | null;
      is_active?: boolean;
      form_type?: string | null;
    }>;

    console.info(`${logPrefix} forms fetched`, {
      total: forms?.length ?? 0,
      filtered: formsList.length,
    });

    if (formsList.length === 0) {
      // Sem passos configurados: considerar que não há pendências
      return NextResponse.json({ pending: false, steps: [], nextStep: null });
    }

    const processedSteps: Array<{ id: string; step: number; created_at: string | null }> = [];

    // Descobrir o formulário raiz (passo 1) replicando a lógica do admin
    const rootForm =
      formsList.find(
        f => f.onboard_step === 1 && (f.parent_form_id === null || f.parent_form_id === undefined)
      ) ||
      formsList.find(
        f =>
          (f.onboard_step === null || typeof f.onboard_step !== 'number') &&
          (f.parent_form_id === null || f.parent_form_id === undefined)
      ) ||
      formsList.find(f => f.onboard_step === 1) ||
      formsList.find(f => f.parent_form_id === null || f.parent_form_id === undefined);

    if (rootForm) {
      processedSteps.push({
        id: rootForm.id,
        step: 1,
        created_at: rootForm.created_at,
      });
    }

    // Inserir demais formulários com onboard_step definido (>=2)
    formsList.forEach(form => {
      const step = typeof form.onboard_step === 'number' ? form.onboard_step : null;
      if (step === null) return;
      if (processedSteps.some(p => p.id === form.id)) return;
      processedSteps.push({
        id: form.id,
        step,
        created_at: form.created_at,
      });
    });

    // Ordenar por step e, em caso de empate, pela criação mais antiga
    processedSteps.sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    if (processedSteps.length === 0) {
      return NextResponse.json({ pending: false, steps: [], nextStep: null });
    }

    const formIds = processedSteps.map(f => f.id).filter(Boolean);
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
    const pendingForms = processedSteps.filter(f => !answeredIds.has(f.id));

    console.info(`${logPrefix} result`, {
      userId,
      pendingCount: pendingForms.length,
      nextStep: pendingForms[0]?.step ?? null,
    });

    return NextResponse.json({
      pending: pendingForms.length > 0,
      steps: pendingForms.map(f => f.step),
      nextStep: pendingForms[0]?.step ?? null,
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
