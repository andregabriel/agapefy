import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

type StepItem = { stepNumber: number; label: string; completed: boolean };

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || null;
    if (!userId) return NextResponse.json({ steps: [], hasPending: false, nextStep: null });

    const supabase = getAdminSupabase();

    // Buscar forms de onboarding com steps
    const { data: forms, error: formsError } = await supabase
      .from('admin_forms')
      .select('id, name, onboard_step, is_active')
      .eq('form_type', 'onboarding')
      .not('onboard_step', 'is', null);
    if (formsError) throw formsError;

    const activeForms = (forms || []).filter((f: any) => f.is_active === true);
    const byStep = new Map<number, { id: string; name: string }>();
    for (const f of activeForms) {
      const step = Number((f as any).onboard_step);
      if (!Number.isFinite(step)) continue;
      // em caso de duplicidade, manter o primeiro nome
      if (!byStep.has(step)) byStep.set(step, { id: (f as any).id, name: (f as any).name || `Passo ${step}` });
    }

    const formIds = Array.from(byStep.values()).map((x) => x.id);

    // Respostas (via service role, ignora RLS)
    const { data: responses, error: respError } = await supabase
      .from('admin_form_responses')
      .select('form_id')
      .eq('user_id', userId)
      .in('form_id', formIds);
    if (respError) throw respError;
    const answeredIds = new Set((responses || []).map((r: any) => r.form_id));

    // WhatsApp
    const { data: wa } = await supabase
      .from('whatsapp_users')
      .select('phone_number, receives_daily_verse')
      .eq('user_id', userId)
      .maybeSingle();
    const hasPhone = Boolean(wa?.phone_number);
    const versePrefSet = typeof (wa as any)?.receives_daily_verse === 'boolean';

    // Rotina
    const { data: playlist } = await supabase
      .from('playlists')
      .select('id')
      .eq('created_by', userId)
      .eq('title', 'Minha Rotina')
      .eq('is_public', false)
      .maybeSingle();
    const hasRoutine = Boolean(playlist?.id);

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

    return NextResponse.json({ steps, hasPending, nextStep });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('GET /api/onboarding/checklist error', e);
    return NextResponse.json({ error: 'failed_to_check' }, { status: 500 });
  }
}


