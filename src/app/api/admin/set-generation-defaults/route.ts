import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { ELEVENLABS_VOICES } from '@/constants/elevenlabsVoices';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const desiredEngine = (body?.ai_engine as string)?.trim() || 'gpt-5';

    // Voz padrão solicitada: David - Epic Trailer
    const david = ELEVENLABS_VOICES.find(v => v.name === 'David - Epic Trailer');
    const fallbackVoiceId = '7i7dgyCkKt4c16dLtwT3';
    const voiceId = (body?.voice_id as string)?.trim() || david?.id || fallbackVoiceId;
    const voiceName = (body?.voice_name as string)?.trim() || david?.name || 'David - Epic Trailer';

    const admin = getAdminSupabase();
    const rows = [
      { key: 'gmanual_default_ai_engine', value: desiredEngine, type: 'text' as const },
      { key: 'gmanual_default_voice_id', value: voiceId, type: 'text' as const },
      { key: 'gmanual_default_voice_name', value: voiceName, type: 'text' as const },
    ];

    const { error } = await admin.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ai_engine: desiredEngine, voice_id: voiceId, voice_name: voiceName });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro desconhecido' }, { status: 500 });
  }
}


