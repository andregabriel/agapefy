import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || null;
    if (!userId) {
      return NextResponse.json({ pending: false, steps: [] });
    }

    const supabase = getAdminSupabase();

    // Buscar todos os passos de onboarding ativos, ordenados por passo
    const { data: forms, error: formsError } = await supabase
      .from('admin_forms')
      .select('id, onboard_step')
      .eq('form_type', 'onboarding')
      .eq('is_active', true)
      .not('onboard_step', 'is', null)
      .order('onboard_step', { ascending: true });
    if (formsError) throw formsError;

    if (!forms || forms.length === 0) {
      return NextResponse.json({ pending: false, steps: [] });
    }

    const formIds = forms.map(f => f.id);

    // Buscar respostas do usuário para esses formulários
    const { data: responses, error: respError } = await supabase
      .from('admin_form_responses')
      .select('form_id')
      .eq('user_id', userId)
      .in('form_id', formIds);
    if (respError) throw respError;

    const answeredIds = new Set((responses || []).map(r => r.form_id));
    const pendingForms = forms.filter(f => !answeredIds.has(f.id));

    return NextResponse.json({
      pending: pendingForms.length > 0,
      steps: pendingForms.map(f => f.onboard_step).filter((s): s is number => typeof s === 'number'),
      nextStep: pendingForms[0]?.onboard_step ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('GET /api/onboarding/status error', e);
    return NextResponse.json({ error: 'failed_to_check' }, { status: 500 });
  }
}


