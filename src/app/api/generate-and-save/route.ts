import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ELEVENLABS_VOICES } from '@/constants/elevenlabsVoices';

type ReqBody = {
  title?: string;
  base_biblica?: string;
  tema_central?: string;
  category_id?: string;
  playlists?: string[];
  voice_id?: string;
  job_id?: string;
};

type FieldKey = 'title' | 'subtitle' | 'description' | 'preparation' | 'text' | 'final_message' | 'image_prompt';

const FIELD_TO_SETTING_KEY: Record<FieldKey, string> = {
  title: 'gmanual_title_prompt',
  subtitle: 'gmanual_subtitle_prompt',
  description: 'gmanual_description_prompt',
  preparation: 'gmanual_preparation_prompt',
  text: 'gmanual_text_prompt',
  final_message: 'gmanual_final_message_prompt',
  image_prompt: 'gmanual_image_prompt_prompt',
};

function applyPlaceholders(template: string, context: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = context[key];
    return typeof v === 'string' ? v : '';
  });
}

async function generateField(field: FieldKey, context: Record<string, string>): Promise<{ value: string; model?: string }> {
  const admin = getAdminSupabase();
  const settingKey = FIELD_TO_SETTING_KEY[field];
  const { data } = await admin.from('app_settings').select('key,value').eq('key', settingKey).limit(1);
  const rawValue = data?.[0]?.value as unknown;
  const templateStr = typeof rawValue === 'string' ? rawValue : (rawValue == null ? '' : String(rawValue));
  if (!templateStr.trim()) return { value: '' };

  const rendered = applyPlaceholders(templateStr, context || {});
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const candidateModels = ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
  const temperature = 1;
  const maxTokens = field === 'text' ? 900 : 250;

  for (const model of candidateModels) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: rendered }], temperature, max_tokens: maxTokens })
    });
    if (resp.ok) {
      const j = await resp.json();
      return { value: (j?.choices?.[0]?.message?.content || '').trim(), model };
    }
    const txt = (await resp.text()).toLowerCase();
    if (resp.status === 401 || resp.status === 403 || resp.status === 429) break;
    const isModelIssue = resp.status === 404 || (txt.includes('model') && (txt.includes('not found') || txt.includes('invalid')));
    if (!isModelIssue) break;
  }
  return { value: '' };
}

async function generateAudio(origin: string, text: string, voice_id?: string): Promise<{ url: string | null; voiceIdUsed: string | null; durationSeconds: number | null }> {
  try {
    const resp = await fetch(`${origin}/api/generate-audio`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && typeof data?.audio_url === 'string') {
      return {
        url: data.audio_url as string,
        voiceIdUsed: (data.voice_id_used as string) || null,
        durationSeconds: (typeof data.duration_seconds === 'number' ? data.duration_seconds as number : null)
      };
    }
  } catch (_) {}
  return { url: null, voiceIdUsed: null, durationSeconds: null };
}

async function generateImage(origin: string, prompt: string): Promise<string | null> {
  try {
    const attempt = async () => {
      const resp = await fetch(`${origin}/api/generate-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      let data: any = {};
      try { data = await resp.json(); } catch { data = {}; }
      if (resp.ok && typeof data?.image_url === 'string') return data.image_url as string;
      return null;
    };
    const first = await attempt();
    if (first) return first;
    // retry único
    return await attempt();
  } catch (_) { return null; }
}

async function ensurePlaylist(admin: any, title: string, categoryId?: string | null): Promise<string | null> {
  const needle = (title || '').toString().trim().toLowerCase();
  if (!needle) return null;
  const { data } = await admin.from('playlists').select('id,title,category_id').ilike('title', `%${title}%`);
  const rows: any[] = data || [];
  const exact = rows.find(r => (r.title || '').toString().trim().toLowerCase() === needle);
  if (exact?.id) return exact.id as string;
  const { data: created } = await admin.from('playlists').insert({ title, category_id: categoryId || null, is_public: true }).select().single();
  return created?.id || null;
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const body = await req.json() as ReqBody;
    const title = (body.title || '').trim();
    const base = (body.base_biblica || '').trim();
    const tema = (body.tema_central || '').trim();
    const categoryId = (body.category_id || '').trim();
    const playlists = Array.isArray(body.playlists) ? body.playlists.filter(s => typeof s === 'string' && s.trim()) : [];
    const voiceId = body.voice_id || '';

    if (!categoryId) return NextResponse.json({ ok: false, error: 'category_id obrigatório' }, { status: 400 });

    const ctxBase = { tema_central: tema, base_biblica: base } as Record<string,string>;
    // 1) texto
    const textRes = await generateField('text', ctxBase);
    const text = textRes.value;
    const modelUsed = textRes.model || null;
    if (!text.trim()) return NextResponse.json({ ok: false, error: 'Falha ao gerar texto' }, { status: 500 });

    const ctx = { ...ctxBase, texto: text };
    // 2) paralelos
    const [prepRes, finalMsgRes, genTitleRes, subtitleRes, descriptionRes, imagePromptRes] = await Promise.all([
      generateField('preparation', ctx),
      generateField('final_message', ctx),
      generateField('title', ctx),
      generateField('subtitle', ctx),
      generateField('description', ctx),
      generateField('image_prompt', ctx)
    ]);
    const prep = prepRes.value, finalMsg = finalMsgRes.value, genTitle = genTitleRes.value, subtitle = subtitleRes.value, description = descriptionRes.value, imagePrompt = imagePromptRes.value;

    // 3) áudio
    const audioText = [prep, text, finalMsg].filter(Boolean).join('\n\n');
    const audioGen = await generateAudio(origin, audioText, voiceId || undefined);
    const audioUrl = audioGen.url;
    const usedVoiceId = (voiceId || audioGen.voiceIdUsed || null) as string | null;
    const usedVoiceName = usedVoiceId ? (ELEVENLABS_VOICES.find(v => v.id === usedVoiceId)?.name || null) : null;
    const durationSeconds = (typeof audioGen.durationSeconds === 'number' ? Math.round(audioGen.durationSeconds) : null);
    if (!audioUrl) return NextResponse.json({ ok: false, error: 'Falha ao gerar áudio' }, { status: 500 });

    // 4) imagem (tolerante a falha)
    let imageUrl: string | null = null;
    if (typeof imagePrompt === 'string' && imagePrompt.trim().length >= 20) {
      imageUrl = await generateImage(origin, imagePrompt.trim());
    }

    // 5) salvar
    const admin = getAdminSupabase();
    const cookieStore = cookies();
    const userClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: auth } = await userClient.auth.getUser();
    const createdBy = auth?.user?.id || null;
    const insertRes = await admin.from('audios').insert({
      title: title || genTitle || '',
      subtitle: subtitle || null,
      description: description || null,
      audio_url: audioUrl,
      transcript: audioText,
      duration: durationSeconds,
      category_id: categoryId,
      cover_url: imageUrl || null,
      created_by: createdBy,
      ai_engine: modelUsed,
      voice_id: usedVoiceId,
      voice_name: usedVoiceName,
      biblical_base: base || null,
    }).select().single();
    if (insertRes.error) return NextResponse.json({ ok: false, error: insertRes.error.message }, { status: 500 });
    const audioId = insertRes.data?.id as string;

    // 6) playlists
    for (const p of playlists) {
      const plId = await ensurePlaylist(admin, p, categoryId);
      if (plId) {
        const { error: paErr } = await admin
          .from('playlist_audios')
          .insert({ audio_id: audioId, playlist_id: plId });
        // Não falhar o job por erro de playlist; apenas continue
      }
    }

    return NextResponse.json({ ok: true, audio_id: audioId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro desconhecido' }, { status: 500 });
  }
}


