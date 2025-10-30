import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('admin_forms')
      .select('*')
      .order('onboard_step', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('GET /api/forms error', e);
    return NextResponse.json({ error: 'failed_to_fetch' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name: string = (body?.name ?? 'Novo formulário').toString();
    const description: string | null = body?.description ?? 'Edite os campos depois';
    const form_type: string = (body?.form_type ?? 'onboarding').toString();
    const schema = Array.isArray(body?.schema) ? body?.schema : [];

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('admin_forms')
      .insert({ name, description, form_type, schema })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('POST /api/forms error', e);
    return NextResponse.json({ error: 'failed_to_create' }, { status: 500 });
  }
}


