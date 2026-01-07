import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;

    const supabase = getAdminSupabase();

    // Buscar todos os formulários de onboarding ativos
    const { data: forms, error: formsError } = await supabase
      .from('admin_forms')
      .select('id')
      .eq('form_type', 'onboarding')
      .eq('is_active', true);
    
    if (formsError) throw formsError;

    if (!forms || forms.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const formIds = forms.map(f => f.id);

    // Deletar todas as respostas do usuário para esses formulários
    const { error: deleteError } = await supabase
      .from('admin_form_responses')
      .delete()
      .eq('user_id', userId)
      .in('form_id', formIds);

    if (deleteError) throw deleteError;

    return NextResponse.json({ 
      success: true, 
      deleted: formIds.length,
      message: 'Respostas do onboarding resetadas com sucesso' 
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('POST /api/onboarding/reset error', e);
    return NextResponse.json({ error: 'failed_to_reset' }, { status: 500 });
  }
}
