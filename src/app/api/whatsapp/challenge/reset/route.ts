import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const userAuth = await requireUser(request);
    if (!userAuth.ok) return userAuth.response;

    const body = await request.json().catch(() => ({}));
    const phoneRaw = body?.phone || body?.phone_number || '';
    const playlistId = body?.playlist_id || body?.playlistId || '';

    const cleanPhone = String(phoneRaw).replace(/\D/g, '');
    if (!cleanPhone) {
      return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 });
    }
    if (!playlistId || typeof playlistId !== 'string') {
      return NextResponse.json({ error: 'playlist_id inválido' }, { status: 400 });
    }

    const admin = getAdminSupabase();
    const [{ data: waRow }, { data: profile }] = await Promise.all([
      admin
        .from('whatsapp_users')
        .select('user_id')
        .eq('phone_number', cleanPhone)
        .maybeSingle(),
      admin.from('profiles').select('whatsapp').eq('id', userAuth.userId).maybeSingle(),
    ]);

    const profilePhone = typeof profile?.whatsapp === 'string'
      ? profile.whatsapp.replace(/\D/g, '')
      : '';
    const ownerMatch = waRow?.user_id === userAuth.userId || (profilePhone && profilePhone === cleanPhone);
    if (!ownerMatch) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { error } = await admin
      .from('whatsapp_challenge_log')
      .delete()
      .eq('user_phone', cleanPhone)
      .eq('playlist_id', playlistId);

    if (error) {
      return NextResponse.json({ error: 'reset_failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal_error' }, { status: 500 });
  }
}


