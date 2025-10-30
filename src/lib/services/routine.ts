import { supabase } from '@/lib/supabase';

function normalize(input: string): string {
  return (input || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function mapTimeLabel(label: string): 'Wakeup' | 'Lunch' | 'Dinner' | 'Sleep' | null {
  const key = normalize(label);
  if (/(^|\s)acordar/.test(key) || /ao acordar/.test(key)) return 'Wakeup';
  if (/almoco/.test(key) || /no almoco/.test(key)) return 'Lunch';
  if (/jantar/.test(key) || /no jantar/.test(key)) return 'Dinner';
  if (/dormir/.test(key) || /ao dormir/.test(key)) return 'Sleep';
  return null;
}

export async function buildRoutinePlaylistFromOnboarding(params: { userId: string; rootFormId: string }) {
  const { userId, rootFormId } = params;
  if (!userId) return { ok: false, reason: 'no_user' } as const;

  let formsQuery = await supabase
    .from('admin_forms')
    .select('id,onboard_step')
    .eq('form_type', 'onboarding')
    .eq('parent_form_id', rootFormId)
    .in('onboard_step', [4, 5]);

  if (formsQuery.error && (formsQuery.error.code === '42703' || /parent_form_id/i.test(String(formsQuery.error.message || '')))) {
    formsQuery = await supabase
      .from('admin_forms')
      .select('id,onboard_step')
      .eq('form_type', 'onboarding')
      .in('onboard_step', [4, 5]);
  }
  if (formsQuery.error) throw formsQuery.error;

  const step4 = (formsQuery.data || []).find((f: any) => Number(f.onboard_step) === 4);
  const step5 = (formsQuery.data || []).find((f: any) => Number(f.onboard_step) === 5);
  if (!step4 || !step5) return { ok: false, reason: 'steps_not_found' } as const;

  const [r4, r5] = await Promise.all([
    supabase
      .from('admin_form_responses')
      .select('answers, created_at')
      .eq('user_id', userId)
      .eq('form_id', step4.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('admin_form_responses')
      .select('answers, created_at')
      .eq('user_id', userId)
      .eq('form_id', step5.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const step4Answers: any = (r4.data as any)?.answers || {};
  const timeLabels: string[] = Array.isArray(step4Answers?.options)
    ? step4Answers.options
    : [step4Answers?.option ?? step4Answers?.text].filter(Boolean);
  const goalLabel: string = (r5.data as any)?.answers?.option ?? (r5.data as any)?.answers?.text ?? '';

  const timeEnums = Array.from(
    new Set(
      (timeLabels || [])
        .map((lbl) => mapTimeLabel(String(lbl)))
        .filter((v): v is 'Wakeup' | 'Lunch' | 'Dinner' | 'Sleep' => Boolean(v))
    )
  );

  if (timeEnums.length === 0 || !goalLabel) return { ok: false, reason: 'missing_answers' } as const;

  // Buscar um áudio aleatório por horário selecionado
  const preferredOrder: Array<'Wakeup' | 'Lunch' | 'Dinner' | 'Sleep'> = ['Wakeup', 'Lunch', 'Dinner', 'Sleep'];
  const orderedTimes = [...timeEnums].sort((a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b));

  const chosenAudioIds: string[] = [];
  for (const t of orderedTimes) {
    const { data, error } = await supabase
      .from('audios')
      .select('id')
      .eq('time', t)
      .eq('spiritual_goal', goalLabel)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const ids = (data || []).map((a: any) => a.id);
    if (ids.length > 0) {
      const idx = Math.floor(Math.random() * ids.length);
      const picked = ids[idx];
      if (!chosenAudioIds.includes(picked)) chosenAudioIds.push(picked);
    }
  }

  let { data: playlist, error: pErr } = await supabase
    .from('playlists')
    .select('*')
    .eq('created_by', userId)
    .eq('title', 'Minha Rotina')
    .eq('is_public', false)
    .maybeSingle();

  if (pErr && pErr.code === 'PGRST116') {
    const created = await supabase
      .from('playlists')
      .insert({ title: 'Minha Rotina', description: 'Suas orações e práticas diárias personalizadas', created_by: userId, is_public: false })
      .select('*')
      .single();
    if (created.error) throw created.error;
    playlist = created.data;
  } else if (pErr) {
    throw pErr;
  }

  if (!playlist) return { ok: false, reason: 'no_playlist' } as const;

  const del = await supabase.from('playlist_audios').delete().eq('playlist_id', playlist.id);
  if (del.error) throw del.error;

  if (chosenAudioIds.length > 0) {
    const rows = chosenAudioIds.map((id, idx) => ({ playlist_id: playlist.id, audio_id: id, position: idx }));
    const ins = await supabase.from('playlist_audios').insert(rows);
    if (ins.error) throw ins.error;
  }

  return { ok: true, audioCount: chosenAudioIds.length, playlistId: playlist.id } as const;
}


